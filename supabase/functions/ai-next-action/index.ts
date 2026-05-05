import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-client.ts";
import { computeOpportunitySignature } from "../_shared/opportunity-signature.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { opportunityId, force_refresh = false } = body || {};

    if (!opportunityId) {
      throw new Error('opportunityId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Cache check based on context signature
    const { signature: currentSignature } = await computeOpportunitySignature(supabase, opportunityId);

    const { data: existingPending } = await supabase
      .from('ai_suggestions')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .eq('suggestion_type', 'next_action')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    const cacheValid =
      !force_refresh &&
      existingPending &&
      existingPending.length > 0 &&
      existingPending.every((s: any) => s.context_signature === currentSignature);

    if (cacheValid) {
      console.log(`[ai-next-action] cache HIT (sig=${currentSignature}, n=${existingPending.length})`);
      const meta = (existingPending[0]?.current_value || {}) as any;
      const actions = existingPending.map((s: any) => s.suggested_value);
      return new Response(
        JSON.stringify({
          actions,
          urgency_level: meta.urgency_level || 'medium',
          overall_strategy: meta.overall_strategy || '',
          from_cache: true,
          signature: currentSignature,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`[ai-next-action] cache MISS (sig=${currentSignature}, force=${force_refresh})`);

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

    const { data: timeline } = await supabase
      .from('unified_timeline')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('timestamp', { ascending: false })
      .limit(10);

    const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

    const prompt = `CONTEXTO TEMPORAL CRÍTICO: Hoje é ${todayISO} (timezone America/Sao_Paulo). Qualquer data sugerida DEVE ser >= ${todayISO}. NUNCA sugira datas no passado.

Com base no contexto desta oportunidade, sugira as 3-5 próximas melhores ações que o vendedor deve tomar para avançar a venda.

Dados da Oportunidade:
- Título: ${opportunity.title}
- Valor: R$ ${opportunity.valor_previsto || 0}
- Stage atual: ${opportunity.stage?.name}
- Status: ${opportunity.status}
- Temperatura: ${opportunity.temperature}
- Dias sem contato: ${opportunity.days_since_contact || 0}
- Último contato: ${opportunity.last_contact_date || 'Nunca'}
- Próximo follow-up: ${opportunity.next_followup_date || 'Não agendado'}

Conta: ${opportunity.account?.razao_social} (${opportunity.account?.segmento})
Contato: ${opportunity.contact?.nome} (${opportunity.contact?.cargo})

Atividades recentes: ${opportunity.activities?.length || 0}
Última interação: ${timeline?.[0]?.title || 'Nenhuma'}

Retorne EXATAMENTE neste formato JSON:
{
  "actions": [
    {
      "priority": "<high|medium|low>",
      "type": "<call|email|meeting|proposal|follow-up>",
      "title": "<título da ação>",
      "description": "<descrição detalhada do que fazer>",
      "reason": "<por que esta ação é importante agora>",
      "timing": "<when to do it: now|today|this-week|next-week>",
      "estimated_impact": "<low|medium|high>"
    }
  ],
  "urgency_level": "<low|medium|high>",
  "overall_strategy": "<resumo da estratégia geral em 2-3 linhas>"
}`;

    const aiResult = await callAI({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em estratégia de vendas B2B. Sugira ações práticas e acionáveis baseadas no contexto da oportunidade. Seja conciso e direto.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      reasoning_effort: 'low',
      feature: 'ai-next-action',
      organization_id: opportunity.organization_id,
    });

    const aiResponse = JSON.parse(aiResult.content);
    console.log(`[ai-next-action] generated ${aiResponse.actions?.length || 0} actions in ${aiResult.latency_ms}ms`);

    // Expire ONLY previous next_action suggestions (don't touch field_update etc.)
    await supabase
      .from('ai_suggestions')
      .update({ status: 'expired', action_taken_at: new Date().toISOString() })
      .eq('opportunity_id', opportunityId)
      .eq('suggestion_type', 'next_action')
      .eq('status', 'pending');

    // Persist new suggestions with context_signature
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const inserts = (aiResponse.actions || []).map((action: any, index: number) => ({
      organization_id: opportunity.organization_id,
      user_id: opportunity.owner_user_id,
      opportunity_id: opportunityId,
      suggestion_type: 'next_action',
      entity_type: 'opportunity',
      entity_id: opportunityId,
      suggested_value: action,
      current_value: index === 0
        ? { overall_strategy: aiResponse.overall_strategy, urgency_level: aiResponse.urgency_level }
        : null,
      reasoning: action.reason,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
      context_signature: currentSignature,
    }));

    if (inserts.length > 0) {
      const { error: insertErr } = await supabase.from('ai_suggestions').insert(inserts);
      if (insertErr) console.warn('[ai-next-action] insert error:', insertErr);
    }

    return new Response(
      JSON.stringify({ ...aiResponse, from_cache: false, signature: currentSignature }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in ai-next-action:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
