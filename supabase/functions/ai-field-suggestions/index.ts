import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize temperature values
function normalizeTemperature(value: any): string {
  if (!value) return 'warm';
  
  const normalized = String(value).toLowerCase().trim();
  const tempMap: Record<string, string> = {
    'cold': 'cold',
    'frio': 'cold',
    'warm': 'warm',
    'morno': 'warm',
    'hot': 'hot',
    'quente': 'hot',
    'burning': 'burning',
    'fervendo': 'burning',
    'ardente': 'burning'
  };
  
  return tempMap[normalized] || 'warm';
}

// Validate suggestion before storing
function validateSuggestion(
  suggestion: any, 
  currentValues: Record<string, any>,
  stageIds: string[]
): { valid: boolean; reason?: string; normalizedValue?: any } {
  const { field_name, suggested_value } = suggestion;
  
  if (!field_name || suggested_value === undefined || suggested_value === null) {
    return { valid: false, reason: 'Missing field_name or suggested_value' };
  }

  // Temperature validation
  if (field_name === 'temperature') {
    const normalized = normalizeTemperature(suggested_value);
    const currentNormalized = normalizeTemperature(currentValues.temperature);
    
    if (normalized === currentNormalized) {
      return { valid: false, reason: 'Suggested value same as current' };
    }
    
    return { valid: true, normalizedValue: normalized };
  }

  // Probability validation
  if (field_name === 'prob') {
    const probValue = typeof suggested_value === 'number' 
      ? suggested_value 
      : parseInt(String(suggested_value), 10);
    
    if (isNaN(probValue) || probValue < 0 || probValue > 100) {
      return { valid: false, reason: 'Invalid probability value' };
    }
    
    // Skip if change is less than 5 percentage points
    const currentProb = currentValues.prob || 0;
    if (Math.abs(probValue - currentProb) < 5) {
      return { valid: false, reason: 'Change too small (< 5pp)' };
    }
    
    return { valid: true, normalizedValue: probValue };
  }

  // Value validation
  if (field_name === 'valor_previsto') {
    let numValue: number;
    
    if (typeof suggested_value === 'number') {
      numValue = suggested_value;
    } else {
      const cleaned = String(suggested_value).replace(/[^\d.,]/g, '').replace(',', '.');
      numValue = parseFloat(cleaned);
    }
    
    if (isNaN(numValue) || numValue <= 0) {
      return { valid: false, reason: 'Invalid value' };
    }
    
    // Skip if same as current
    if (numValue === currentValues.valor_previsto) {
      return { valid: false, reason: 'Suggested value same as current' };
    }
    
    return { valid: true, normalizedValue: numValue };
  }

  // Stage ID validation
  if (field_name === 'stage_id') {
    // Check if it's a valid UUID
    const isUUID = typeof suggested_value === 'string' && /^[0-9a-f-]{36}$/i.test(suggested_value);
    
    if (isUUID) {
      if (!stageIds.includes(suggested_value)) {
        return { valid: false, reason: 'Invalid stage ID' };
      }
      if (suggested_value === currentValues.stage_id) {
        return { valid: false, reason: 'Suggested value same as current' };
      }
      return { valid: true, normalizedValue: suggested_value };
    }
    
    // If it's a name, we'll skip (can't validate without lookup)
    return { valid: false, reason: 'Stage ID should be UUID, not name' };
  }

  // Close date validation
  if (field_name === 'close_date_prevista') {
    const dateStr = String(suggested_value);
    const dateRegex = /^\d{4}-\d{2}-\d{2}/;
    
    if (!dateRegex.test(dateStr)) {
      return { valid: false, reason: 'Invalid date format' };
    }
    
    const normalizedDate = dateStr.split('T')[0];
    if (normalizedDate === currentValues.close_date_prevista) {
      return { valid: false, reason: 'Suggested value same as current' };
    }
    
    return { valid: true, normalizedValue: normalizedDate };
  }

  return { valid: true, normalizedValue: suggested_value };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { opportunityId } = await req.json();
    
    if (!opportunityId) {
      throw new Error('opportunityId is required');
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Invalid token');

    // Fetch opportunity with related data
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        account:accounts(*),
        contact:contacts(*),
        stage:stages(*),
        activities(*)
      `)
      .eq('id', opportunityId)
      .single();

    if (oppError) throw oppError;

    // Fetch stages for the pipeline (for validation and prompt context)
    const { data: pipelineStages } = await supabase
      .from('stages')
      .select('id, name, position')
      .eq('pipeline_id', opportunity.pipeline_id)
      .order('position', { ascending: true });

    const stageIds = pipelineStages?.map(s => s.id) || [];

    // Fetch recent notes and emails
    const { data: notes } = await supabase
      .from('opportunity_notes')
      .select('content, created_at')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: emails } = await supabase
      .from('opportunity_emails')
      .select('subject, body, created_at')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })
      .limit(3);

    // Expire any old pending suggestions for this opportunity before generating new ones
    await supabase
      .from('ai_suggestions')
      .update({ status: 'expired', action_taken_at: new Date().toISOString() })
      .eq('opportunity_id', opportunityId)
      .eq('status', 'pending');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Get current values (normalized)
    const currentTemperature = normalizeTemperature(opportunity.temperatura || opportunity.temperature);
    const currentValues = {
      temperature: currentTemperature,
      valor_previsto: opportunity.valor_previsto || 0,
      prob: opportunity.prob || 50,
      close_date_prevista: opportunity.close_date_prevista,
      stage_id: opportunity.stage_id
    };

    const temperatureLabels: Record<string, string> = {
      cold: 'Frio (cold)',
      warm: 'Morno (warm)',
      hot: 'Quente (hot)',
      burning: 'Fervendo (burning)'
    };

    const stagesContext = pipelineStages?.map(s => `  - ID: ${s.id}, Nome: "${s.name}"`).join('\n') || 'Nenhum estágio disponível';

    const prompt = `Analise esta oportunidade e sugira atualizações de campos que o vendedor deveria considerar.

DADOS ATUAIS DA OPORTUNIDADE:
- Título: ${opportunity.title}
- Valor Previsto: R$ ${opportunity.valor_previsto || 0}
- Estágio Atual: ${opportunity.stage?.name} (ID: ${opportunity.stage_id})
- Probabilidade: ${opportunity.prob}%
- Temperatura: ${temperatureLabels[currentTemperature] || currentTemperature}
- Data prevista fechamento: ${opportunity.close_date_prevista || 'Não definida'}
- Dias sem contato: ${opportunity.days_since_contact || 0}

CONTA: ${opportunity.account?.razao_social || 'N/A'} (${opportunity.account?.segmento || 'Sem segmento'})
CONTATO: ${opportunity.contact?.nome || 'N/A'}

ATIVIDADES RECENTES: ${opportunity.activities?.length || 0}
ÚLTIMA ATIVIDADE: ${opportunity.activities?.[0]?.title || 'Nenhuma'}

NOTAS RECENTES:
${notes?.map(n => `- ${n.content.substring(0, 100)}...`).join('\n') || 'Nenhuma nota'}

EMAILS RECENTES:
${emails?.map(e => `- ${e.subject}`).join('\n') || 'Nenhum email'}

ESTÁGIOS DISPONÍVEIS NO PIPELINE:
${stagesContext}

REGRAS IMPORTANTES:
1. NÃO sugira valores que são IGUAIS aos atuais
2. Para temperatura, use APENAS: "cold", "warm", "hot" ou "burning"
3. Para stage_id, use APENAS o ID do estágio (UUID), não o nome
4. Para prob, use valores entre 0 e 100 (mudança mínima de 5 pontos)
5. Para valor_previsto, use apenas números
6. Para close_date_prevista, use formato YYYY-MM-DD

Retorne um JSON com até 3 sugestões RELEVANTES que realmente agreguem valor:
{
  "suggestions": [
    {
      "field_name": "nome_do_campo",
      "suggested_value": valor_sugerido,
      "confidence_score": 0.85,
      "reasoning": "explicação clara e objetiva do porquê desta mudança"
    }
  ]
}

Se não houver sugestões relevantes, retorne: {"suggestions": []}

Campos possíveis: temperature, prob, close_date_prevista, stage_id`;

    console.log(`[ai-field-suggestions] Generating suggestions for opportunity ${opportunityId}`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente de CRM especializado em análise de oportunidades de vendas. Retorne APENAS JSON válido, sem markdown ou texto adicional.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    let aiResponse;
    
    try {
      aiResponse = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', data.choices[0].message.content);
      throw new Error('Invalid AI response format');
    }

    console.log(`[ai-field-suggestions] AI returned ${aiResponse.suggestions?.length || 0} suggestions`);

    // Validate and store suggestions
    const validSuggestions = [];
    
    for (const suggestion of aiResponse.suggestions || []) {
      const validation = validateSuggestion(suggestion, currentValues, stageIds);
      
      if (!validation.valid) {
        console.log(`[ai-field-suggestions] Skipping invalid suggestion for ${suggestion.field_name}: ${validation.reason}`);
        continue;
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Get the actual current value for this field
      let actualCurrentValue = currentValues[suggestion.field_name as keyof typeof currentValues];
      
      const { data: stored, error: storeError } = await supabase
        .from('ai_suggestions')
        .insert({
          organization_id: opportunity.organization_id,
          user_id: opportunity.owner_user_id,
          opportunity_id: opportunityId,
          suggestion_type: 'field_update',
          entity_type: 'opportunity',
          entity_id: opportunityId,
          field_name: suggestion.field_name,
          current_value: actualCurrentValue, // Use DB value, not AI's claim
          suggested_value: validation.normalizedValue,
          confidence_score: Math.min(1, Math.max(0, suggestion.confidence_score || 0.7)),
          reasoning: suggestion.reasoning,
          status: 'pending',
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (!storeError && stored) {
        validSuggestions.push(stored);
        console.log(`[ai-field-suggestions] Stored suggestion: ${suggestion.field_name} = ${validation.normalizedValue}`);
      } else {
        console.warn(`[ai-field-suggestions] Failed to store suggestion:`, storeError);
      }
    }

    console.log(`[ai-field-suggestions] Created ${validSuggestions.length} valid suggestions for opportunity ${opportunityId}`);

    return new Response(JSON.stringify({ suggestions: validSuggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-field-suggestions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
