import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { callOpenAIWithGuardrails } from '../_shared/openai-client.ts';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function sanitizeUsageErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? 'unknown_error');
  return message.slice(0, 500);
}

async function logAIUsage(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
) {
  try {
    const { error } = await supabase.from('ai_usage_logs').insert(payload);
    if (error) {
      console.warn('[ai-manager-coaching] ai_usage_logs insert failed:', error.message);
    }
  } catch (err) {
    console.warn('[ai-manager-coaching] ai_usage_logs insert exception:', sanitizeUsageErrorMessage(err));
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { organizationId, teamMemberIds } = await req.json();

    if (!organizationId) {
      return new Response(JSON.stringify({ error: 'organizationId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: userOrgId, error: userOrgError } = await supabaseAuth
      .rpc('get_user_organization_id');

    if (userOrgError || !userOrgId || userOrgId !== organizationId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[ai-manager-coaching] Generating coaching insights for manager: ${user.id}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get team members if not provided
    let memberIds = teamMemberIds;
    if (!memberIds || memberIds.length === 0) {
      const { data: teams } = await supabase
        .from('teams')
        .select('id')
        .eq('manager_id', user.id)
        .eq('organization_id', organizationId);

      if (teams && teams.length > 0) {
        const teamIds = teams.map(t => t.id);
        const { data: members } = await supabase
          .from('team_members')
          .select('user_id')
          .in('team_id', teamIds);
        memberIds = members?.map(m => m.user_id) || [];
      }
    }

    if (!memberIds || memberIds.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        insights: { 
          summary: 'Nenhum membro de equipe encontrado',
          team_members: [],
          recommendations: [],
        } 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch team profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', memberIds)
      .eq('organization_id', organizationId);

    const profilesMap = (profiles || []).reduce((acc, p) => {
      acc[p.user_id] = p.full_name;
      return acc;
    }, {} as Record<string, string>);

    // Fetch opportunities per member
    const { data: opportunities } = await supabase
      .from('opportunities')
      .select('id, owner_user_id, status, valor_previsto, created_at')
      .in('owner_user_id', memberIds)
      .eq('organization_id', organizationId)
      .gte('created_at', last30Days);

    // Fetch activities per member
    const { data: activities } = await supabase
      .from('activities')
      .select('id, owner_user_id, type, status, scheduled_date, completed_at')
      .in('owner_user_id', memberIds)
      .eq('organization_id', organizationId)
      .gte('created_at', last30Days);

    // Fetch proposals
    const { data: proposals } = await supabase
      .from('proposals')
      .select(`
        id, status, total_amount, created_at, sent_at, accepted_at,
        opportunity:opportunities!inner(owner_user_id)
      `)
      .eq('organization_id', organizationId)
      .gte('created_at', last30Days);

    // Calculate per-member stats
    const memberStats = memberIds.map((memberId: string) => {
      const memberName = profilesMap[memberId] || 'Vendedor';
      const memberOpps = opportunities?.filter(o => o.owner_user_id === memberId) || [];
      const memberActs = activities?.filter(a => a.owner_user_id === memberId) || [];
      const memberProposals = proposals?.filter(p => (p.opportunity as any)?.owner_user_id === memberId) || [];

      const won = memberOpps.filter(o => o.status === 'won').length;
      const lost = memberOpps.filter(o => o.status === 'lost').length;
      const total = won + lost;
      const winRate = total > 0 ? (won / total * 100).toFixed(1) : '0';
      const pipelineValue = memberOpps.filter(o => o.status === 'open').reduce((s, o) => s + (o.valor_previsto || 0), 0);
      const wonValue = memberOpps.filter(o => o.status === 'won').reduce((s, o) => s + (o.valor_previsto || 0), 0);

      const completedActs = memberActs.filter(a => a.status === 'completed').length;
      const overdueActs = memberActs.filter(a => a.status === 'pending' && a.scheduled_date && new Date(a.scheduled_date) < now).length;

      const sentProposals = memberProposals.filter(p => p.sent_at).length;
      const acceptedProposals = memberProposals.filter(p => p.status === 'accepted').length;

      return {
        user_id: memberId,
        name: memberName,
        opportunities: { total: memberOpps.length, won, lost, winRate: parseFloat(winRate), pipelineValue, wonValue },
        activities: { total: memberActs.length, completed: completedActs, overdue: overdueActs },
        proposals: { sent: sentProposals, accepted: acceptedProposals },
      };
    });

    // Build AI prompt
    const systemPrompt = `Você é um coach de vendas AI especializado em gestão de equipes comerciais.
Analise os dados da equipe e gere recomendações de coaching personalizadas para cada vendedor.
Identifique padrões, riscos e oportunidades de desenvolvimento.
Seja específico e prático. Foque em ações que o gerente pode tomar hoje.
Responda APENAS em JSON válido, sem markdown.`;

    type MemberStat = typeof memberStats[number];
    const teamSummary = memberStats.map((m: MemberStat) => 
      `${m.name}: ${m.opportunities.won} ganhos, ${m.opportunities.lost} perdidos, ${m.opportunities.winRate}% conversão, R$${m.opportunities.pipelineValue.toLocaleString('pt-BR')} pipeline, ${m.activities.overdue} atividades atrasadas`
    ).join('\n');

    const userPrompt = `Analise esta equipe de vendas (últimos 30 dias):

MEMBROS:
${teamSummary}

Total da equipe:
- Oportunidades ganhas: ${memberStats.reduce((s: number, m: MemberStat) => s + m.opportunities.won, 0)}
- Pipeline total: R$ ${memberStats.reduce((s: number, m: MemberStat) => s + m.opportunities.pipelineValue, 0).toLocaleString('pt-BR')}
- Receita fechada: R$ ${memberStats.reduce((s: number, m: MemberStat) => s + m.opportunities.wonValue, 0).toLocaleString('pt-BR')}

Retorne JSON:
{
  "team_health_score": 0-100,
  "summary": "Resumo da saúde da equipe em 2-3 frases",
  "top_performers": [{"name": "Nome", "reason": "Motivo"}],
  "needs_attention": [{"name": "Nome", "issue": "Problema", "coaching_action": "Ação de coaching"}],
  "team_recommendations": [
    {"recommendation": "Recomendação", "priority": "alta|média|baixa", "impact": "Impacto esperado"}
  ],
  "individual_coaching": [
    {"name": "Nome", "strengths": ["força"], "development_areas": ["área"], "suggested_actions": ["ação"]}
  ],
  "risk_alerts": [{"member": "Nome", "risk": "Descrição do risco", "urgency": "alta|média|baixa"}],
  "weekly_focus": "Foco sugerido para a semana"
}`;

    let aiResult;
    try {
      aiResult = await callOpenAIWithGuardrails({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_completion_tokens: 1200,
        timeoutMs: 20000,
        maxRetries: 2,
      });
    } catch (err) {
      await logAIUsage(supabase, {
        organization_id: organizationId,
        user_id: user.id,
        feature: 'ai_manager_coaching',
        action: 'generate_coaching',
        entity_type: 'team',
        entity_id: organizationId,
        model_used: 'gpt-5-mini',
        success: false,
        error_message: sanitizeUsageErrorMessage(err),
        request_metadata: {
          function_name: 'ai-manager-coaching',
          max_completion_tokens: 1200,
          retry_count: 2,
          attempts: 3,
          timed_out: false,
        },
        response_metadata: { provider: 'openai' },
      });
      throw err;
    }
    const aiData = aiResult.data;
    const aiContent = aiResult.content;
    console.log('[ai-manager-coaching] AI transport metadata:', {
      model: aiResult.metadata.model,
      retryCount: aiResult.metadata.retryCount,
      timedOut: aiResult.metadata.timedOut,
      usage: aiResult.usage ?? null,
    });
    await logAIUsage(supabase, {
      organization_id: organizationId,
      user_id: user.id,
      feature: 'ai_manager_coaching',
      action: 'generate_coaching',
      entity_type: 'team',
      entity_id: organizationId,
      model_used: aiResult.metadata.model ?? 'gpt-5-mini',
      tokens_input: aiResult.usage?.prompt_tokens ?? null,
      tokens_output: aiResult.usage?.completion_tokens ?? null,
      tokens_total: aiResult.usage?.total_tokens ?? null,
      success: true,
      latency_ms: aiResult.metadata.durationMs ?? null,
      request_metadata: {
        function_name: 'ai-manager-coaching',
        max_completion_tokens: 1200,
        retry_count: aiResult.metadata.retryCount,
        attempts: (aiResult.metadata.retryCount ?? 0) + 1,
        timed_out: aiResult.metadata.timedOut ?? false,
      },
      response_metadata: {
        provider: 'openai',
        finish_reason: aiResult.metadata.finishReason ?? null,
      },
    });

    let insights;
    try {
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      insights = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('[ai-manager-coaching] Parse error:', parseError);
      insights = {
        team_health_score: 70,
        summary: 'Análise em andamento',
        top_performers: [],
        needs_attention: [],
        team_recommendations: [],
        individual_coaching: [],
        risk_alerts: [],
        weekly_focus: 'Foco em atividades de prospecção',
      };
    }

    // Add raw stats
    insights.team_stats = memberStats;

    console.log(`[ai-manager-coaching] Generated coaching insights for ${memberIds.length} team members`);

    return new Response(JSON.stringify({ success: true, insights }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ai-manager-coaching] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
