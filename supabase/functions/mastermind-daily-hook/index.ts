import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Support both API key auth and JWT auth
    const apiKey = req.headers.get('x-api-key');
    const authHeader = req.headers.get('Authorization');
    
    let organizationId: string | null = null;
    let userId: string | null = null;

    // API Key authentication for external agents
    if (apiKey) {
      // Validate API key against organization settings
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('settings->api_key', apiKey)
        .single();

      if (!org) {
        return new Response(JSON.stringify({ error: 'Invalid API key' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      organizationId = org.id;
    } 
    // JWT authentication for internal calls
    else if (authHeader) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );

      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      userId = user.id;

      // Get user's organization
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      organizationId = membership?.organization_id;
    } else {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!organizationId) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { scope = 'full' } = body; // 'full', 'summary', 'alerts'

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch organization data
    const { data: org } = await supabase
      .from('organizations')
      .select('name, settings')
      .eq('id', organizationId)
      .single();

    // Fetch team members
    const { data: members } = await supabase
      .from('organization_members')
      .select(`
        user_id, org_role,
        profiles!inner(full_name, email)
      `)
      .eq('organization_id', organizationId)
      .eq('status', 'active');

    // Fetch pipelines
    const { data: pipelines } = await supabase
      .from('pipelines')
      .select('id, name, pipeline_type')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    const salesPipelineIds = pipelines?.filter(p => p.pipeline_type === 'sales').map(p => p.id) || [];

    // Fetch opportunities
    const { data: opportunities } = await supabase
      .from('opportunities')
      .select(`
        id, titulo, valor_previsto, prob, temperature, status, 
        created_at, updated_at, close_date_prevista, owner_user_id, pipeline_id
      `)
      .eq('organization_id', organizationId);

    // Fetch activities
    const { data: activities } = await supabase
      .from('activities')
      .select('id, type, status, owner_user_id, scheduled_date, completed_at')
      .eq('organization_id', organizationId)
      .gte('scheduled_date', monthStart.toISOString());

    // Fetch recent AI alerts
    const { data: alerts } = await supabase
      .from('ai_alerts')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20);

    // Calculate KPIs
    const activeOpps = opportunities?.filter(o => !['won', 'lost'].includes(o.status)) || [];
    const salesOpps = activeOpps.filter(o => salesPipelineIds.includes(o.pipeline_id));
    const wonThisMonth = opportunities?.filter(o => 
      o.status === 'won' && 
      new Date(o.updated_at) >= monthStart
    ) || [];
    const lostThisMonth = opportunities?.filter(o => 
      o.status === 'lost' && 
      new Date(o.updated_at) >= monthStart
    ) || [];

    const totalPipeline = salesOpps.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
    const weightedPipeline = salesOpps.reduce((sum, o) => sum + ((o.valor_previsto || 0) * (o.prob || 0) / 100), 0);
    const closedRevenue = wonThisMonth.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
    const lostValue = lostThisMonth.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
    const winRate = (wonThisMonth.length + lostThisMonth.length) > 0
      ? wonThisMonth.length / (wonThisMonth.length + lostThisMonth.length)
      : 0;

    // Temperature breakdown
    const temperatureBreakdown = {
      burning: salesOpps.filter(o => o.temperature === 'burning').length,
      hot: salesOpps.filter(o => o.temperature === 'hot').length,
      warm: salesOpps.filter(o => o.temperature === 'warm').length,
      cold: salesOpps.filter(o => o.temperature === 'cold').length,
    };

    // At-risk deals (high value, low activity, close date approaching)
    const atRiskDeals = salesOpps
      .filter(o => {
        const closeDate = o.close_date_prevista ? new Date(o.close_date_prevista) : null;
        const daysUntilClose = closeDate ? Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
        return (o.valor_previsto || 0) > 10000 && 
               daysUntilClose !== null && 
               daysUntilClose <= 14 && 
               daysUntilClose > 0;
      })
      .map(o => ({
        id: o.id,
        title: o.titulo,
        value: o.valor_previsto,
        daysUntilClose: o.close_date_prevista ? 
          Math.ceil((new Date(o.close_date_prevista).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null,
        temperature: o.temperature,
      }));

    // Hot opportunities (burning/hot temperature, high probability)
    const hotOpportunities = salesOpps
      .filter(o => ['burning', 'hot'].includes(o.temperature || '') && (o.prob || 0) >= 50)
      .sort((a, b) => (b.valor_previsto || 0) - (a.valor_previsto || 0))
      .slice(0, 10)
      .map(o => ({
        id: o.id,
        title: o.titulo,
        value: o.valor_previsto,
        probability: o.prob,
        temperature: o.temperature,
      }));

    // Team performance
    const teamPerformance = members?.map(m => {
      const memberOpps = opportunities?.filter(o => o.owner_user_id === m.user_id) || [];
      const memberWon = memberOpps.filter(o => o.status === 'won' && new Date(o.updated_at) >= monthStart);
      const memberLost = memberOpps.filter(o => o.status === 'lost' && new Date(o.updated_at) >= monthStart);
      const memberActivities = activities?.filter(a => a.owner_user_id === m.user_id) || [];
      const completedActivities = memberActivities.filter(a => a.status === 'completed');

      return {
        userId: m.user_id,
        name: (m.profiles as any)?.full_name || 'Unknown',
        role: m.org_role,
        metrics: {
          activeDeals: memberOpps.filter(o => !['won', 'lost'].includes(o.status)).length,
          pipelineValue: memberOpps.filter(o => !['won', 'lost'].includes(o.status))
            .reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
          wonThisMonth: memberWon.length,
          wonValue: memberWon.reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
          winRate: (memberWon.length + memberLost.length) > 0 
            ? memberWon.length / (memberWon.length + memberLost.length) 
            : 0,
          activitiesCompleted: completedActivities.length,
          activitiesPending: memberActivities.filter(a => a.status === 'pending').length,
        },
      };
    }) || [];

    // Pending tasks today
    const pendingTodayActivities = activities?.filter(a => {
      const scheduled = a.scheduled_date ? new Date(a.scheduled_date) : null;
      return a.status === 'pending' && 
             scheduled && 
             scheduled >= todayStart && 
             scheduled < new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    }) || [];

    // Build response based on scope
    let response: any = {
      timestamp: now.toISOString(),
      organization: {
        id: organizationId,
        name: org?.name,
      },
    };

    if (scope === 'full' || scope === 'summary') {
      response.kpis = {
        totalPipeline,
        weightedPipeline,
        closedRevenue,
        lostValue,
        winRate: Math.round(winRate * 100),
        activeOpportunities: salesOpps.length,
        temperatureBreakdown,
      };

      response.forecast = {
        pessimistic: closedRevenue + (weightedPipeline * 0.6),
        realistic: closedRevenue + (weightedPipeline * 0.85),
        optimistic: closedRevenue + (weightedPipeline * 1.1),
      };
    }

    if (scope === 'full') {
      response.teamPerformance = teamPerformance;
      response.hotOpportunities = hotOpportunities;
      response.atRiskDeals = atRiskDeals;
      response.pendingActivitiesToday = pendingTodayActivities.length;
    }

    if (scope === 'full' || scope === 'alerts') {
      response.alerts = alerts?.map(a => ({
        id: a.id,
        type: a.alert_type,
        priority: a.priority,
        title: a.title,
        message: a.message,
        createdAt: a.created_at,
      })) || [];
    }

    // Log API usage
    await supabase.from('ai_usage_logs').insert({
      organization_id: organizationId,
      user_id: userId,
      feature: 'mastermind',
      action: 'daily_hook',
      model_used: 'api',
      success: true,
      request_metadata: { scope },
    });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in mastermind-daily-hook:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
