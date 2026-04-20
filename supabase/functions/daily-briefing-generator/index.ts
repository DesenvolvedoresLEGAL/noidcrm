import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";


const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BriefingRequest {
  briefingType?: 'owner' | 'manager' | 'sales';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Get user's profile and organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, full_name')
      .eq('user_id', user.id)
      .single();

    if (!profile?.organization_id) {
      throw new Error('User has no organization');
    }

    // Get user's role
    const { data: membership } = await supabase
      .from('organization_members')
      .select('org_role')
      .eq('user_id', user.id)
      .eq('organization_id', profile.organization_id)
      .single();

    const orgRole = membership?.org_role || 'sales';
    
    // Parse request body for optional briefing type override
    let requestBody: BriefingRequest = {};
    try {
      requestBody = await req.json();
    } catch {
      // No body provided, use role-based default
    }

    // Determine briefing type based on role
    let briefingType = requestBody.briefingType || 'sales';
    if (!requestBody.briefingType) {
      if (orgRole === 'owner' || orgRole === 'admin') {
        briefingType = 'owner';
      } else if (orgRole === 'manager') {
        briefingType = 'manager';
      } else {
        briefingType = 'sales';
      }
    }

    const organizationId = profile.organization_id;
    const today = new Date().toISOString().split('T')[0];

    // Check if briefing already exists for today (unique constraint is org_id + user_id + date)
    const { data: existing } = await supabase
      .from('daily_briefings')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .eq('briefing_date', today)
      .single();

    if (existing) {
      // If exists but different type requested, update it
      if (existing.briefing_type !== briefingType) {
        const briefingData = await generateBriefing(supabase, {
          organizationId,
          userId: user.id,
          userName: profile.full_name || 'Usuário',
          briefingType,
          orgRole,
        });

        const { data: updated, error: updateError } = await supabase
          .from('daily_briefings')
          .update({
            briefing_type: briefingType,
            priority_actions: briefingData.priority_actions || [],
            hot_opportunities: briefingData.hot_opportunities || [],
            at_risk_deals: briefingData.at_risk_deals || [],
            summary: briefingData.summary,
            coaching_insights: briefingData.coaching_insights || [],
            strategic_recommendations: briefingData.strategic_recommendations || [],
            team_highlights: briefingData.team_highlights || [],
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return new Response(JSON.stringify(updated), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify(existing), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate role-specific briefing
    const briefingData = await generateBriefing(supabase, {
      organizationId,
      userId: user.id,
      userName: profile.full_name || 'Usuário',
      briefingType,
      orgRole,
    });

    // Create new briefing record
    const { data: briefing, error: briefingError } = await supabase
      .from('daily_briefings')
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        briefing_date: today,
        briefing_type: briefingType,
        priority_actions: briefingData.priority_actions || [],
        hot_opportunities: briefingData.hot_opportunities || [],
        at_risk_deals: briefingData.at_risk_deals || [],
        summary: briefingData.summary,
        coaching_insights: briefingData.coaching_insights || [],
        strategic_recommendations: briefingData.strategic_recommendations || [],
        team_highlights: briefingData.team_highlights || [],
        tasks_created: 0
      })
      .select()
      .single();

    if (briefingError) throw briefingError;

    console.log(`[daily-briefing] Created ${briefingType} briefing for user:`, user.id);

    return new Response(JSON.stringify(briefing), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in daily-briefing-generator:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function generateBriefing(supabase: any, context: {
  organizationId: string;
  userId: string;
  userName: string;
  briefingType: string;
  orgRole: string;
}) {
  const { organizationId, userId, userName, briefingType } = context;

  // Fetch common data
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  if (briefingType === 'owner') {
    return await generateOwnerBriefing(supabase, organizationId, userName);
  } else if (briefingType === 'manager') {
    return await generateManagerBriefing(supabase, organizationId, userId, userName);
  } else {
    return await generateSalesBriefing(supabase, organizationId, userId, userName);
  }
}

async function generateOwnerBriefing(supabase: any, organizationId: string, userName: string) {
  // Fetch organization-wide metrics
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const [
    { count: totalOpportunities },
    { data: wonDeals },
    { data: atRiskOpps },
    { data: sellerPerformance },
    { data: recentProposals }
  ] = await Promise.all([
    supabase.from('opportunities').select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId).eq('status', 'new'),
    supabase.from('opportunities').select('valor_previsto')
      .eq('organization_id', organizationId).eq('status', 'won')
      .gte('updated_at', startOfMonth),
    supabase.from('opportunities').select('id, title, valor_previsto, days_since_contact')
      .eq('organization_id', organizationId).eq('status', 'new')
      .gt('days_since_contact', 7).limit(5),
    supabase.from('sellers').select('id, name, total_xp')
      .eq('organization_id', organizationId).eq('is_active', true)
      .order('total_xp', { ascending: false }).limit(5),
    supabase.from('proposals').select('id, title, status, total_amount')
      .eq('organization_id', organizationId)
      .gte('created_at', startOfMonth).limit(10)
  ]);

  const totalWonRevenue = wonDeals?.reduce((sum: number, d: any) => sum + (d.valor_previsto || 0), 0) || 0;
  const proposalsSent = recentProposals?.filter((p: any) => p.status === 'sent' || p.status === 'viewed').length || 0;
  const proposalsAccepted = recentProposals?.filter((p: any) => p.status === 'accepted').length || 0;

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    // Return fallback briefing without AI
    return {
      summary: `Bom dia, ${userName}! Sua operação tem ${totalOpportunities || 0} oportunidades ativas com R$ ${(totalWonRevenue / 1000).toFixed(0)}k fechados este mês.`,
      priority_actions: [
        { action: 'Revisar pipeline de vendas', priority: 'high', reason: 'Acompanhamento estratégico' },
        { action: 'Analisar deals em risco', priority: 'medium', reason: `${atRiskOpps?.length || 0} oportunidades paradas` }
      ],
      hot_opportunities: [],
      at_risk_deals: atRiskOpps?.map((o: any) => ({ id: o.id, title: o.title, value: o.valor_previsto })) || [],
      strategic_recommendations: [
        { area: 'Pipeline', insight: 'Foque em oportunidades com maior probabilidade de fechamento' },
        { area: 'Time', insight: 'Acompanhe vendedores com baixa atividade' }
      ],
      team_highlights: sellerPerformance?.map((s: any) => ({ name: s.name, xp: s.total_xp })) || [],
      coaching_insights: []
    };
  }

  const prompt = `Você é um consultor estratégico de vendas. Gere um briefing executivo CONCISO para o CEO/Owner.

DADOS DA OPERAÇÃO:
- Oportunidades ativas: ${totalOpportunities || 0}
- Receita fechada no mês: R$ ${totalWonRevenue.toLocaleString('pt-BR')}
- Deals em risco (sem contato >7 dias): ${atRiskOpps?.length || 0}
- Propostas enviadas: ${proposalsSent}, aceitas: ${proposalsAccepted}
- Top vendedores: ${sellerPerformance?.slice(0, 3).map((s: any) => s.name).join(', ') || 'N/A'}

Gere um JSON com:
{
  "summary": "Resumo executivo em 2 linhas focando em resultados e próximos passos",
  "strategic_recommendations": [
    {"area": "Pipeline|Time|Processo", "insight": "recomendação estratégica"}
  ],
  "priority_actions": [
    {"action": "ação específica", "priority": "high|medium", "reason": "impacto esperado"}
  ]
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: 'Responda apenas com JSON válido, sem markdown.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) throw new Error('AI API error');

    const data = await response.json();
    const aiResponse = JSON.parse(data.choices[0].message.content);

    return {
      summary: aiResponse.summary || `Operação com ${totalOpportunities} oportunidades ativas.`,
      priority_actions: aiResponse.priority_actions || [],
      strategic_recommendations: aiResponse.strategic_recommendations || [],
      hot_opportunities: [],
      at_risk_deals: atRiskOpps?.map((o: any) => ({ id: o.id, title: o.title, value: o.valor_previsto })) || [],
      team_highlights: sellerPerformance?.map((s: any) => ({ name: s.name, xp: s.total_xp })) || [],
      coaching_insights: []
    };
  } catch (error) {
    console.error('AI error for owner briefing:', error);
    return {
      summary: `Bom dia, ${userName}! Sua operação tem ${totalOpportunities || 0} oportunidades ativas.`,
      priority_actions: [],
      strategic_recommendations: [],
      hot_opportunities: [],
      at_risk_deals: [],
      team_highlights: [],
      coaching_insights: []
    };
  }
}

async function generateManagerBriefing(supabase: any, organizationId: string, userId: string, userName: string) {
  // Get manager's team members
  const { data: teamMembers } = await supabase
    .from('team_members')
    .select('user_id, teams(name)')
    .eq('teams.organization_id', organizationId);

  const teamUserIds = teamMembers?.map((t: any) => t.user_id) || [];

  // Fetch team performance data
  const [
    { data: teamOpportunities },
    { data: teamActivities },
    { data: teamSellers }
  ] = await Promise.all([
    supabase.from('opportunities').select('id, title, owner_user_id, status, valor_previsto')
      .eq('organization_id', organizationId)
      .in('owner_user_id', teamUserIds.length ? teamUserIds : [userId]),
    supabase.from('activities').select('id, owner_user_id, status, type')
      .eq('organization_id', organizationId)
      .in('owner_user_id', teamUserIds.length ? teamUserIds : [userId])
      .eq('status', 'scheduled'),
    supabase.from('sellers').select('id, user_id, name, total_xp, current_level')
      .eq('organization_id', organizationId)
      .in('user_id', teamUserIds.length ? teamUserIds : [userId])
  ]);

  const openOpps = teamOpportunities?.filter((o: any) => o.status === 'new').length || 0;
  const pendingActivities = teamActivities?.length || 0;
  
  // Identify sellers needing attention
  const sellersNeedingAttention = teamSellers?.filter((s: any) => (s.total_xp || 0) < 100) || [];

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return {
      summary: `Bom dia, ${userName}! Seu time tem ${openOpps} oportunidades abertas e ${pendingActivities} atividades agendadas.`,
      priority_actions: [
        { action: 'Fazer 1:1 com vendedores', priority: 'high', reason: 'Acompanhamento semanal' }
      ],
      coaching_insights: sellersNeedingAttention.map((s: any) => ({
        seller: s.name,
        insight: 'Precisa de acompanhamento mais próximo',
        action: 'Agendar sessão de coaching'
      })),
      team_highlights: teamSellers?.slice(0, 3).map((s: any) => ({ name: s.name, level: s.current_level })) || [],
      hot_opportunities: [],
      at_risk_deals: [],
      strategic_recommendations: []
    };
  }

  const prompt = `Você é um coach de gestão de vendas. Gere um briefing de coaching para o gerente.

DADOS DO TIME:
- Oportunidades abertas do time: ${openOpps}
- Atividades agendadas: ${pendingActivities}
- Vendedores no time: ${teamSellers?.length || 0}
- Vendedores precisando atenção: ${sellersNeedingAttention.map((s: any) => s.name).join(', ') || 'Nenhum'}

Gere um JSON com:
{
  "summary": "Resumo focado em coaching do time em 2 linhas",
  "coaching_insights": [
    {"seller": "nome", "insight": "observação", "action": "ação sugerida"}
  ],
  "priority_actions": [
    {"action": "ação de gestão", "priority": "high|medium", "reason": "motivo"}
  ]
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: 'Responda apenas com JSON válido, sem markdown.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) throw new Error('AI API error');

    const data = await response.json();
    const aiResponse = JSON.parse(data.choices[0].message.content);

    return {
      summary: aiResponse.summary || `Time com ${openOpps} oportunidades abertas.`,
      priority_actions: aiResponse.priority_actions || [],
      coaching_insights: aiResponse.coaching_insights || [],
      team_highlights: teamSellers?.slice(0, 3).map((s: any) => ({ name: s.name, level: s.current_level })) || [],
      hot_opportunities: [],
      at_risk_deals: [],
      strategic_recommendations: []
    };
  } catch (error) {
    console.error('AI error for manager briefing:', error);
    return {
      summary: `Bom dia, ${userName}! Seu time tem ${openOpps} oportunidades abertas.`,
      priority_actions: [],
      coaching_insights: [],
      team_highlights: [],
      hot_opportunities: [],
      at_risk_deals: [],
      strategic_recommendations: []
    };
  }
}

async function generateSalesBriefing(supabase: any, organizationId: string, userId: string, userName: string) {
  const today = new Date().toISOString();
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: opportunities },
    { data: activities },
    { data: proposals }
  ] = await Promise.all([
    supabase.from('opportunities').select('id, title, valor_previsto, temperature, stage:stages(name), days_since_contact')
      .eq('organization_id', organizationId)
      .eq('owner_user_id', userId)
      .eq('status', 'new')
      .order('urgency_score', { ascending: false })
      .limit(10),
    supabase.from('activities').select('id, title, type, scheduled_date')
      .eq('organization_id', organizationId)
      .eq('owner_user_id', userId)
      .eq('status', 'scheduled')
      .gte('scheduled_date', today)
      .lte('scheduled_date', weekFromNow)
      .order('scheduled_date', { ascending: true })
      .limit(10),
    supabase.from('proposals').select('id, title, status, total_amount')
      .eq('organization_id', organizationId)
      .in('status', ['sent', 'viewed'])
      .limit(5)
  ]);

  const hotOpps = opportunities?.filter((o: any) => o.temperature === 'burning' || o.temperature === 'hot') || [];
  const atRiskDeals = opportunities?.filter((o: any) => o.days_since_contact > 5) || [];
  const todayActivities = activities?.filter((a: any) => 
    new Date(a.scheduled_date).toDateString() === new Date().toDateString()
  ) || [];

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return {
      summary: `Bom dia, ${userName}! Você tem ${todayActivities.length} atividades hoje e ${hotOpps.length} oportunidades quentes.`,
      priority_actions: todayActivities.slice(0, 3).map((a: any) => ({
        action: a.title,
        priority: 'high',
        reason: 'Agendado para hoje'
      })),
      hot_opportunities: hotOpps.map((o: any) => ({
        id: o.id,
        title: o.title,
        value: o.valor_previsto,
        temperature: o.temperature
      })),
      at_risk_deals: atRiskDeals.map((o: any) => ({
        id: o.id,
        title: o.title,
        value: o.valor_previsto,
        days_since_contact: o.days_since_contact
      })),
      coaching_insights: [],
      strategic_recommendations: [],
      team_highlights: []
    };
  }

  const prompt = `Você é um assistente de vendas. Gere um briefing diário PRÁTICO para o vendedor.

DADOS DO VENDEDOR:
- Atividades hoje: ${todayActivities.length}
- Oportunidades quentes: ${hotOpps.length}
- Deals em risco (sem contato >5 dias): ${atRiskDeals.length}
- Propostas aguardando resposta: ${proposals?.length || 0}

Atividades de hoje:
${todayActivities.slice(0, 5).map((a: any) => `- ${a.title}`).join('\n') || 'Nenhuma'}

Oportunidades quentes:
${hotOpps.slice(0, 3).map((o: any) => `- ${o.title}: R$ ${o.valor_previsto}`).join('\n') || 'Nenhuma'}

Gere um JSON com:
{
  "summary": "Resumo motivacional e prático do dia em 2 linhas",
  "priority_actions": [
    {"action": "tarefa específica", "priority": "high|medium", "reason": "motivo"}
  ]
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: 'Responda apenas com JSON válido, sem markdown.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) throw new Error('AI API error');

    const data = await response.json();
    const aiResponse = JSON.parse(data.choices[0].message.content);

    return {
      summary: aiResponse.summary || `Você tem ${todayActivities.length} atividades hoje.`,
      priority_actions: aiResponse.priority_actions || [],
      hot_opportunities: hotOpps.map((o: any) => ({
        id: o.id,
        title: o.title,
        value: o.valor_previsto,
        temperature: o.temperature
      })),
      at_risk_deals: atRiskDeals.map((o: any) => ({
        id: o.id,
        title: o.title,
        value: o.valor_previsto,
        days_since_contact: o.days_since_contact
      })),
      coaching_insights: [],
      strategic_recommendations: [],
      team_highlights: []
    };
  } catch (error) {
    console.error('AI error for sales briefing:', error);
    return {
      summary: `Bom dia, ${userName}! Foco nas atividades do dia.`,
      priority_actions: [],
      hot_opportunities: [],
      at_risk_deals: [],
      coaching_insights: [],
      strategic_recommendations: [],
      team_highlights: []
    };
  }
}
