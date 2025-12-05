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

    const { userId, organizationId } = await req.json();
    const targetUserId = userId || user.id;

    console.log(`[ai-rep-insights] Generating insights for user: ${targetUserId}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch seller data
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get opportunities
    const { data: opportunities } = await supabase
      .from('opportunities')
      .select('id, title, status, valor_previsto, created_at, close_date_prevista, stage_id, temperature')
      .eq('owner_user_id', targetUserId)
      .gte('created_at', last30Days);

    // Get activities
    const { data: activities } = await supabase
      .from('activities')
      .select('id, type, status, scheduled_date, completed_at')
      .eq('owner_user_id', targetUserId)
      .gte('created_at', last30Days);

    // Get proposals
    const { data: proposals } = await supabase
      .from('proposals')
      .select('id, status, total_amount, created_at, sent_at, viewed_at, accepted_at')
      .eq('organization_id', organizationId)
      .gte('created_at', last30Days);

    // Calculate metrics
    const totalOpportunities = opportunities?.length || 0;
    const wonOpportunities = opportunities?.filter(o => o.status === 'won').length || 0;
    const lostOpportunities = opportunities?.filter(o => o.status === 'lost').length || 0;
    const openOpportunities = opportunities?.filter(o => o.status === 'open').length || 0;
    const winRate = totalOpportunities > 0 ? ((wonOpportunities / (wonOpportunities + lostOpportunities)) * 100).toFixed(1) : '0';
    const pipelineValue = opportunities?.filter(o => o.status === 'open').reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;
    const wonValue = opportunities?.filter(o => o.status === 'won').reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;

    const totalActivities = activities?.length || 0;
    const completedActivities = activities?.filter(a => a.status === 'completed').length || 0;
    const pendingActivities = activities?.filter(a => a.status === 'pending').length || 0;
    const overdueActivities = activities?.filter(a => 
      a.status === 'pending' && a.scheduled_date && new Date(a.scheduled_date) < now
    ).length || 0;

    const totalProposals = proposals?.length || 0;
    const sentProposals = proposals?.filter(p => p.sent_at).length || 0;
    const acceptedProposals = proposals?.filter(p => p.status === 'accepted').length || 0;
    const proposalConversion = sentProposals > 0 ? ((acceptedProposals / sentProposals) * 100).toFixed(1) : '0';

    // Build AI prompt
    const systemPrompt = `Você é um coach de vendas AI especializado em análise de performance individual de vendedores.
Analise os dados fornecidos e gere insights acionáveis e personalizados para o vendedor melhorar sua performance.
Seja específico, direto e motivacional. Foque em ações que podem ser tomadas hoje.
Responda APENAS em JSON válido, sem markdown.`;

    const userPrompt = `Analise a performance deste vendedor nos últimos 30 dias:

OPORTUNIDADES:
- Total: ${totalOpportunities}
- Ganhas: ${wonOpportunities}
- Perdidas: ${lostOpportunities}
- Em aberto: ${openOpportunities}
- Taxa de conversão: ${winRate}%
- Valor pipeline: R$ ${pipelineValue.toLocaleString('pt-BR')}
- Valor ganho: R$ ${wonValue.toLocaleString('pt-BR')}

ATIVIDADES:
- Total: ${totalActivities}
- Concluídas: ${completedActivities}
- Pendentes: ${pendingActivities}
- Atrasadas: ${overdueActivities}

PROPOSTAS:
- Total: ${totalProposals}
- Enviadas: ${sentProposals}
- Aceitas: ${acceptedProposals}
- Taxa de conversão: ${proposalConversion}%

Retorne JSON:
{
  "performance_score": 0-100,
  "summary": "Resumo em 1-2 frases",
  "strengths": ["força 1", "força 2", "força 3"],
  "improvements": ["melhoria 1 com ação específica", "melhoria 2", "melhoria 3"],
  "priority_actions": [
    {"action": "Ação específica", "impact": "alto|médio|baixo", "timeframe": "hoje|esta semana|este mês"}
  ],
  "motivational_message": "Mensagem motivacional personalizada",
  "risk_alerts": ["alerta se houver"],
  "opportunity_highlights": ["destaque se houver"]
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
      console.error('[ai-rep-insights] AI error:', errorText);
      throw new Error('AI insights generation failed');
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;

    let insights;
    try {
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      insights = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('[ai-rep-insights] Parse error:', parseError);
      insights = {
        performance_score: 70,
        summary: 'Análise em andamento',
        strengths: ['Dados insuficientes para análise completa'],
        improvements: ['Continue registrando atividades'],
        priority_actions: [],
        motivational_message: 'Continue trabalhando!',
        risk_alerts: [],
        opportunity_highlights: [],
      };
    }

    // Add raw metrics to response
    insights.metrics = {
      opportunities: { total: totalOpportunities, won: wonOpportunities, lost: lostOpportunities, open: openOpportunities, winRate, pipelineValue, wonValue },
      activities: { total: totalActivities, completed: completedActivities, pending: pendingActivities, overdue: overdueActivities },
      proposals: { total: totalProposals, sent: sentProposals, accepted: acceptedProposals, conversionRate: proposalConversion },
    };

    console.log(`[ai-rep-insights] Generated insights for user: ${targetUserId}`);

    return new Response(JSON.stringify({ success: true, insights }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ai-rep-insights] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
