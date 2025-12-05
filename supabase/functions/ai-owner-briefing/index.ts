import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { organizationId } = await req.json();

    console.log(`[ai-owner-briefing] Generating executive briefing for org: ${organizationId}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch organization data
    const { data: org } = await supabase
      .from('organizations')
      .select('name, monthly_goal')
      .eq('id', organizationId)
      .single();

    // Fetch all opportunities
    const { data: allOpportunities } = await supabase
      .from('opportunities')
      .select('id, status, valor_previsto, created_at, close_date_prevista, owner_user_id, pipeline_id, prob')
      .eq('organization_id', organizationId);

    // Fetch year opportunities for trends
    const { data: yearOpportunities } = await supabase
      .from('opportunities')
      .select('id, status, valor_previsto, created_at')
      .eq('organization_id', organizationId)
      .gte('created_at', startOfYear);

    // Fetch profiles for seller names
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .eq('organization_id', organizationId);

    const profilesMap = (profiles || []).reduce((acc, p) => {
      acc[p.user_id] = p.full_name;
      return acc;
    }, {} as Record<string, string>);

    // Fetch pipelines
    const { data: pipelines } = await supabase
      .from('pipelines')
      .select('id, name, pipeline_type')
      .eq('organization_id', organizationId);

    // Fetch loss reasons
    const { data: lossReasons } = await supabase
      .from('loss_reasons')
      .select('id, name')
      .eq('organization_id', organizationId);

    // Calculate metrics
    const monthlyGoal = org?.monthly_goal || 100000;
    const monthOpps = allOpportunities?.filter(o => new Date(o.created_at) >= new Date(startOfMonth)) || [];
    const monthWon = monthOpps.filter(o => o.status === 'won');
    const monthLost = monthOpps.filter(o => o.status === 'lost');
    const monthRevenue = monthWon.reduce((s, o) => s + (o.valor_previsto || 0), 0);
    const monthGoalProgress = (monthRevenue / monthlyGoal * 100).toFixed(1);

    // Pipeline value
    const openOpps = allOpportunities?.filter(o => o.status === 'open') || [];
    const pipelineValue = openOpps.reduce((s, o) => s + (o.valor_previsto || 0), 0);
    const weightedPipeline = openOpps.reduce((s, o) => s + (o.valor_previsto || 0) * (o.prob || 50) / 100, 0);

    // Win rate
    const totalClosedMonth = monthWon.length + monthLost.length;
    const monthWinRate = totalClosedMonth > 0 ? (monthWon.length / totalClosedMonth * 100).toFixed(1) : '0';

    // Avg ticket
    const avgTicket = monthWon.length > 0 ? monthRevenue / monthWon.length : 0;

    // Top sellers
    const sellerStats = Object.entries(
      (monthWon || []).reduce((acc, o) => {
        acc[o.owner_user_id] = (acc[o.owner_user_id] || 0) + (o.valor_previsto || 0);
        return acc;
      }, {} as Record<string, number>)
    ).map(([userId, revenue]) => ({
      name: profilesMap[userId] || 'Vendedor',
      revenue,
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // High value opportunities (>R$20k)
    const highValueOpps = openOpps
      .filter(o => (o.valor_previsto || 0) >= 20000)
      .sort((a, b) => (b.valor_previsto || 0) - (a.valor_previsto || 0))
      .slice(0, 10)
      .map(o => ({
        title: `Oportunidade ${o.id.slice(0, 8)}`,
        value: o.valor_previsto,
        owner: profilesMap[o.owner_user_id] || 'Vendedor',
        probability: o.prob,
      }));

    // YoY trend (simplified)
    const yearWon = yearOpportunities?.filter(o => o.status === 'won') || [];
    const yearRevenue = yearWon.reduce((s, o) => s + (o.valor_previsto || 0), 0);
    const monthsElapsed = now.getMonth() + 1;
    const projectedAnnualRevenue = (monthRevenue / (now.getDate() / 30)) * 12;
    const runRate = monthRevenue * 12;

    // Build AI prompt
    const systemPrompt = `Você é o HUMANOID, um AI executivo especializado em análise estratégica de negócios.
Gere um briefing executivo diário para o CEO/Owner com insights acionáveis e visão estratégica.
Seja direto, conciso e foque em decisões de alto impacto.
Identifique riscos, oportunidades estratégicas e recomendações para crescimento.
Responda APENAS em JSON válido, sem markdown.`;

    const userPrompt = `BRIEFING EXECUTIVO - ${org?.name || 'Organização'}

RESULTADOS DO MÊS:
- Meta: R$ ${monthlyGoal.toLocaleString('pt-BR')}
- Realizado: R$ ${monthRevenue.toLocaleString('pt-BR')} (${monthGoalProgress}%)
- Oportunidades ganhas: ${monthWon.length}
- Oportunidades perdidas: ${monthLost.length}
- Taxa de conversão: ${monthWinRate}%
- Ticket médio: R$ ${avgTicket.toLocaleString('pt-BR')}

PIPELINE:
- Valor total: R$ ${pipelineValue.toLocaleString('pt-BR')}
- Pipeline ponderado: R$ ${weightedPipeline.toLocaleString('pt-BR')}
- Oportunidades em aberto: ${openOpps.length}
- High-value (>R$20k): ${highValueOpps.length}

PROJEÇÕES:
- Run rate anual: R$ ${runRate.toLocaleString('pt-BR')}
- Receita anual projetada: R$ ${projectedAnnualRevenue.toLocaleString('pt-BR')}
- Receita YTD: R$ ${yearRevenue.toLocaleString('pt-BR')}

TOP VENDEDORES (por receita):
${sellerStats.map((s, i) => `${i + 1}. ${s.name}: R$ ${s.revenue.toLocaleString('pt-BR')}`).join('\n')}

Retorne JSON:
{
  "executive_summary": "Resumo executivo em 3-4 frases",
  "health_score": 0-100,
  "key_metrics": {
    "goal_status": "on_track|at_risk|behind",
    "trend": "up|stable|down",
    "confidence": 0-100
  },
  "strategic_insights": [
    {"insight": "Insight estratégico", "impact": "alto|médio", "action": "Ação recomendada"}
  ],
  "risk_alerts": [
    {"risk": "Descrição do risco", "severity": "crítico|alto|médio", "mitigation": "Mitigação sugerida"}
  ],
  "opportunities": [
    {"opportunity": "Oportunidade identificada", "potential_value": "R$ X", "recommendation": "Recomendação"}
  ],
  "ai_recommendations": [
    {"recommendation": "Recomendação da IA", "rationale": "Justificativa", "expected_impact": "Impacto esperado"}
  ],
  "forecast_scenarios": {
    "pessimistic": {"revenue": 0, "probability": 0},
    "realistic": {"revenue": 0, "probability": 0},
    "optimistic": {"revenue": 0, "probability": 0}
  },
  "ceo_priorities": ["Prioridade 1", "Prioridade 2", "Prioridade 3"],
  "closing_thought": "Pensamento final motivacional ou estratégico"
}`;

    const aiResponse = await fetch(LOVABLE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[ai-owner-briefing] AI error:', errorText);
      throw new Error('AI briefing generation failed');
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;

    let briefing;
    try {
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      briefing = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('[ai-owner-briefing] Parse error:', parseError);
      briefing = {
        executive_summary: 'Briefing em processamento',
        health_score: 70,
        key_metrics: { goal_status: 'on_track', trend: 'stable', confidence: 70 },
        strategic_insights: [],
        risk_alerts: [],
        opportunities: [],
        ai_recommendations: [],
        forecast_scenarios: { pessimistic: { revenue: 0, probability: 30 }, realistic: { revenue: 0, probability: 50 }, optimistic: { revenue: 0, probability: 20 } },
        ceo_priorities: ['Revisar pipeline', 'Acompanhar equipe', 'Analisar métricas'],
        closing_thought: 'Continue focado nos resultados.',
      };
    }

    // Add raw data
    briefing.raw_metrics = {
      monthlyGoal,
      monthRevenue,
      monthGoalProgress: parseFloat(monthGoalProgress),
      pipelineValue,
      weightedPipeline,
      monthWinRate: parseFloat(monthWinRate),
      avgTicket,
      runRate,
      projectedAnnualRevenue,
      yearRevenue,
      topSellers: sellerStats,
      highValueOpportunities: highValueOpps,
    };

    briefing.generated_at = now.toISOString();

    console.log(`[ai-owner-briefing] Generated executive briefing for org: ${organizationId}`);

    return new Response(JSON.stringify({ success: true, briefing }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ai-owner-briefing] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
