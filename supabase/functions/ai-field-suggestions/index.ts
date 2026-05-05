import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAI, getTodayISO, dateContextPrompt } from "../_shared/ai-client.ts";
import { computeOpportunitySignature } from "../_shared/opportunity-signature.ts";

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

// Defensive parse of custom_field_values.value (can be JSON string, raw string, object, etc.)
function parseCustomValue(raw: any): any {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

// Try to extract an ISO date (YYYY-MM-DD) from arbitrary value
function extractISODate(value: any): string | null {
  if (!value) return null;
  const s = typeof value === 'string' ? value : (typeof value === 'object' && value.value ? String(value.value) : String(value));
  const match = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  // Try Date parse fallback (e.g., "13/05/2026")
  const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  return null;
}

const DATE_FIELD_REGEX = /(data|date|prazo|vencimento|validade|entrega|evento|inicio|retirada|devolucao|devolu)/i;

// Subtract N days from YYYY-MM-DD
function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

// Validate suggestion before storing
function validateSuggestion(
  suggestion: any, 
  currentValues: Record<string, any>,
  stageIds: string[],
  anchors: { eventDate: string | null; proposalExpiresAt: string | null; today: string }
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
    
    if (numValue === currentValues.valor_previsto) {
      return { valid: false, reason: 'Suggested value same as current' };
    }
    
    return { valid: true, normalizedValue: numValue };
  }

  // Stage ID validation
  if (field_name === 'stage_id') {
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
    
    return { valid: false, reason: 'Stage ID should be UUID, not name' };
  }

  // Close date validation — with temporal anchors
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

    // Anti-time-travel guard
    if (normalizedDate < anchors.today) {
      return { valid: false, reason: `Suggested date ${normalizedDate} is in the past (today=${anchors.today})` };
    }

    // Event/delivery anchor — must close at least 1 day before event
    if (anchors.eventDate) {
      const maxByEvent = addDaysISO(anchors.eventDate, -1);
      if (normalizedDate > maxByEvent) {
        return { valid: false, reason: `Suggested date ${normalizedDate} is after event/delivery date ${anchors.eventDate} (max allowed: ${maxByEvent})` };
      }
    }

    // Proposal expiration anchor
    if (anchors.proposalExpiresAt && normalizedDate > anchors.proposalExpiresAt) {
      return { valid: false, reason: `Suggested date ${normalizedDate} is after active proposal expiration ${anchors.proposalExpiresAt}` };
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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Invalid token');

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

    // Parallel fetches for additional context
    const [
      { data: pipelineStages },
      { data: notes },
      { data: emails },
      { data: customFieldValues },
      { data: activeProposals },
    ] = await Promise.all([
      supabase
        .from('stages')
        .select('id, name, position')
        .eq('pipeline_id', opportunity.pipeline_id)
        .order('position', { ascending: true }),
      supabase
        .from('opportunity_notes')
        .select('content, created_at')
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('opportunity_emails')
        .select('subject, body, created_at')
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('custom_field_values')
        .select('value, custom_fields!inner(field_key, label, field_type)')
        .eq('entity_type', 'opportunity')
        .eq('entity_id', opportunityId),
      supabase
        .from('proposals')
        .select('id, status, expires_at, total_amount, created_at')
        .eq('opportunity_id', opportunityId)
        .in('status', ['draft', 'sent', 'viewed'])
        .order('created_at', { ascending: false }),
    ]);

    const stageIds = pipelineStages?.map(s => s.id) || [];

    // Expire any old pending suggestions
    await supabase
      .from('ai_suggestions')
      .update({ status: 'expired', action_taken_at: new Date().toISOString() })
      .eq('opportunity_id', opportunityId)
      .eq('status', 'pending');

    // Compute temporal anchors
    const today = getTodayISO();

    // Parse custom fields
    const customFieldsParsed = (customFieldValues || []).map((cv: any) => {
      const meta = cv.custom_fields;
      const parsed = parseCustomValue(cv.value);
      return {
        field_key: meta?.field_key,
        label: meta?.label,
        field_type: meta?.field_type,
        value: parsed,
      };
    });

    // Find earliest event/delivery date from custom fields
    const dateCandidates: { label: string; date: string }[] = [];
    for (const cf of customFieldsParsed) {
      const isDateType = cf.field_type === 'date' || cf.field_type === 'datetime';
      const isDateNamed = cf.field_key && DATE_FIELD_REGEX.test(cf.field_key);
      if (!isDateType && !isDateNamed) continue;
      const iso = extractISODate(cf.value);
      if (iso && iso >= today) {
        dateCandidates.push({ label: cf.label || cf.field_key, date: iso });
      }
    }
    dateCandidates.sort((a, b) => a.date.localeCompare(b.date));
    const eventDate = dateCandidates[0]?.date || null;

    // Most recent active proposal expiration
    const proposalExpiresAt = activeProposals?.[0]?.expires_at
      ? String(activeProposals[0].expires_at).split('T')[0]
      : null;

    // Max reasonable close date
    const candidates: string[] = [];
    if (eventDate) candidates.push(addDaysISO(eventDate, -1));
    if (proposalExpiresAt) candidates.push(proposalExpiresAt);
    const maxReasonableCloseDate = candidates.length ? candidates.sort()[0] : null;

    const anchors = { eventDate, proposalExpiresAt, today };

    console.log('[ai-field-suggestions] anchors:', { ...anchors, maxReasonableCloseDate, dateCandidates });

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

    // Render anchors block
    const anchorsBlock = [
      `- Hoje: ${today}`,
      `- Data prevista de fechamento atual: ${opportunity.close_date_prevista || 'Não definida'}`,
      eventDate ? `- Data do evento/entrega mais próxima: ${eventDate} (campo "${dateCandidates[0]?.label}")` : '- Data de evento/entrega: NÃO INFORMADA',
      proposalExpiresAt ? `- Proposta ativa expira em: ${proposalExpiresAt} (status: ${activeProposals?.[0]?.status}, valor: R$ ${activeProposals?.[0]?.total_amount ?? 'n/d'})` : '- Proposta ativa: NENHUMA',
      maxReasonableCloseDate ? `- TETO MÁXIMO razoável para close_date_prevista: ${maxReasonableCloseDate}` : '- Sem teto máximo definido',
    ].join('\n');

    const customFieldsBlock = customFieldsParsed.length
      ? customFieldsParsed
          .filter(cf => cf.value !== null && cf.value !== '' && cf.value !== undefined)
          .slice(0, 20)
          .map(cf => `- ${cf.label || cf.field_key}: ${typeof cf.value === 'object' ? JSON.stringify(cf.value) : cf.value}`)
          .join('\n')
      : 'Nenhum campo personalizado preenchido';

    const proposalsBlock = activeProposals?.length
      ? activeProposals.map((p: any) => `- Proposta ${p.status} criada em ${String(p.created_at).split('T')[0]}, expira ${p.expires_at ? String(p.expires_at).split('T')[0] : 'sem data'}, valor R$ ${p.total_amount ?? 'n/d'}`).join('\n')
      : 'Nenhuma proposta ativa';

    const prompt = `${dateContextPrompt()}

Analise esta oportunidade e sugira atualizações de campos que o vendedor deveria considerar.

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

CAMPOS PERSONALIZADOS DA OPORTUNIDADE:
${customFieldsBlock}

PROPOSTAS ATIVAS VINCULADAS:
${proposalsBlock}

ÂNCORAS TEMPORAIS (use como restrições RÍGIDAS):
${anchorsBlock}

ESTÁGIOS DISPONÍVEIS NO PIPELINE:
${stagesContext}

REGRAS DE COERÊNCIA TEMPORAL (OBRIGATÓRIAS — violações serão rejeitadas):
1. close_date_prevista DEVE ser >= hoje (${today}). NUNCA sugira datas no passado.
2. Se houver "Data do evento/entrega", close_date_prevista DEVE ser <= (data do evento - 1 dia). Vendas relacionadas a eventos precisam fechar ANTES do evento acontecer — não faz sentido fechar a venda depois do cliente já ter usado o serviço.
3. Se houver proposta ativa com data de expiração, sugerir close_date_prevista > expires_at só faz sentido se você EXPLICITAMENTE justificar uma renovação/extensão da proposta. Caso contrário, fique <= expires_at.
4. NUNCA sugira uma data depois de uma âncora temporal sem justificar explicitamente o conflito no campo "reasoning".
5. Se a close_date_prevista atual JÁ está coerente com as âncoras (>= hoje E <= teto máximo), NÃO sugira mudança nesse campo.
${maxReasonableCloseDate ? `6. TETO ABSOLUTO para close_date_prevista nesta oportunidade: ${maxReasonableCloseDate}. Não ultrapasse.` : ''}

REGRAS GERAIS:
- NÃO sugira valores IGUAIS aos atuais.
- temperature: APENAS "cold", "warm", "hot" ou "burning". Justifique com sinal observável (último contato, atividade, resposta de email) — não chute.
- stage_id: APENAS UUID válido da lista acima.
- prob: 0-100, mudança mínima 5pp, justifique quantitativamente ("subir prob de X→Y porque [evento concreto da timeline]").
- valor_previsto: apenas números.
- PREFIRA RETORNAR 0 SUGESTÕES A SUGESTÕES FRACAS OU INCOERENTES.

Retorne JSON com no máximo 3 sugestões REALMENTE relevantes:
{
  "suggestions": [
    {
      "field_name": "nome_do_campo",
      "suggested_value": valor_sugerido,
      "confidence_score": 0.85,
      "reasoning": "explicação clara, objetiva e ancorada nos dados acima"
    }
  ]
}

Se nenhuma sugestão agregar valor real, retorne: {"suggestions": []}

Campos possíveis: temperature, prob, close_date_prevista, stage_id, valor_previsto`;

    console.log(`[ai-field-suggestions] Generating suggestions for opportunity ${opportunityId} (today=${today})`);

    const aiResult = await callAI({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: `${dateContextPrompt()}\n\nVocê é um assistente de CRM especializado em análise de oportunidades de vendas. Respeite RIGOROSAMENTE as âncoras temporais informadas. Retorne APENAS JSON válido, sem markdown ou texto adicional.`,
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      reasoning_effort: 'low',
      feature: 'ai-field-suggestions',
      organization_id: opportunity.organization_id,
    });

    console.log(`[ai-field-suggestions] AI latency: ${aiResult.latency_ms}ms`);

    let aiResponse;
    try {
      aiResponse = JSON.parse(aiResult.content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResult.content);
      throw new Error('Invalid AI response format');
    }

    console.log(`[ai-field-suggestions] AI returned ${aiResponse.suggestions?.length || 0} suggestions`);

    const validSuggestions = [];
    
    for (const suggestion of aiResponse.suggestions || []) {
      const validation = validateSuggestion(suggestion, currentValues, stageIds, anchors);
      
      if (!validation.valid) {
        console.log(`[ai-field-suggestions] Skipping invalid suggestion for ${suggestion.field_name}: ${validation.reason}`);
        continue;
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const actualCurrentValue = currentValues[suggestion.field_name as keyof typeof currentValues];
      
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
          current_value: actualCurrentValue,
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

    return new Response(JSON.stringify({ suggestions: validSuggestions, anchors: { eventDate, proposalExpiresAt, maxReasonableCloseDate } }), {
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
