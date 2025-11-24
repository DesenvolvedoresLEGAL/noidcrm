import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = `Com base no contexto desta oportunidade, sugira atualizações inteligentes de campos que o vendedor deveria considerar.

Dados da Oportunidade:
- Título: ${opportunity.title}
- Valor: R$ ${opportunity.valor_previsto || 0}
- Stage: ${opportunity.stage?.name}
- Probabilidade: ${opportunity.prob}%
- Temperatura: ${opportunity.temperature}
- Data prevista fechamento: ${opportunity.close_date_prevista || 'Não definida'}
- Dias sem contato: ${opportunity.days_since_contact || 0}

Conta: ${opportunity.account?.razao_social} (${opportunity.account?.segmento})
Contato: ${opportunity.contact?.nome}

Atividades recentes: ${opportunity.activities?.length || 0}
Última atividade: ${opportunity.activities?.[0]?.title || 'Nenhuma'}

Notas recentes:
${notes?.map(n => `- ${n.content.substring(0, 100)}...`).join('\n') || 'Nenhuma'}

Emails recentes:
${emails?.map(e => `- ${e.subject}`).join('\n') || 'Nenhum'}

Retorne EXATAMENTE neste formato JSON com até 3 sugestões mais relevantes:
{
  "suggestions": [
    {
      "field_name": "nome_do_campo",
      "current_value": valor_atual,
      "suggested_value": valor_sugerido,
      "confidence_score": 0.85,
      "reasoning": "explicação clara do porquê desta sugestão"
    }
  ]
}

Campos possíveis: valor_previsto, prob, temperature, close_date_prevista, stage_id`;

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
            content: 'Você é um assistente de CRM que analisa oportunidades e sugere atualizações inteligentes de campos.'
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
    const aiResponse = JSON.parse(data.choices[0].message.content);

    // Store suggestions in database
    const suggestions = [];
    for (const suggestion of aiResponse.suggestions || []) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expire in 7 days

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
          current_value: suggestion.current_value,
          suggested_value: suggestion.suggested_value,
          confidence_score: suggestion.confidence_score,
          reasoning: suggestion.reasoning,
          status: 'pending',
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (!storeError && stored) {
        suggestions.push(stored);
      }
    }

    console.log(`Created ${suggestions.length} field suggestions for opportunity ${opportunityId}`);

    return new Response(JSON.stringify({ suggestions }), {
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
