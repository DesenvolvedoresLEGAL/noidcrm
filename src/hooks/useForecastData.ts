import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, differenceInDays, format, parseISO } from 'date-fns';
import { parseDateOnly } from '@/lib/dateUtils';
import { calculateForecastScenarios } from '@/services/crm/forecast';

export interface ForecastFilters {
  periodType: 'monthly' | 'quarterly' | 'yearly';
  periodStart: Date;
  periodEnd: Date;
  pipelineId?: string;
  userId?: string;
}

export interface ForecastKPIs {
  goal: number;
  closedRevenue: number;
  closedPercentage: number;
  commitForecast: number;
  commitPercentage: number;
  bestCaseForecast: number;
  bestCasePercentage: number;
  pipelineCoverage: number;
  velocityPerDay: number;
  winRate: number;
  daysRemaining: number;
  totalPipeline: number;
  weightedPipeline: number;
  avgDealSize: number;
  avgCycleLength: number;
  slippageCount: number;
  atRiskCount: number;
}

export interface ForecastOpportunity {
  id: string;
  title: string;
  valor_previsto: number;
  prob: number;
  temperature: string;
  stage_name: string;
  stage_id: string;
  pipeline_name: string;
  owner_name: string;
  owner_id: string;
  close_date_prevista: string | null;
  days_in_stage: number;
  last_activity_date: string | null;
  days_since_activity: number;
  account_name: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  category: 'commit' | 'best_case' | 'pipeline' | 'closed';
  has_contact: boolean;
  has_next_step: boolean;
}

export interface SellerForecast {
  userId: string;
  name: string;
  avatar: string | null;
  goal: number;
  closed: number;
  closedPercentage: number;
  commit: number;
  bestCase: number;
  gap: number;
  winRate: number;
  dealCount: number;
}

export interface ForecastScenario {
  name: string;
  label: string;
  value: number;
  percentage: number;
  probability: number;
  meetsGoal: boolean;
  gap: number;
}

export function useForecastData(filters: ForecastFilters) {
  const { periodStart, periodEnd, pipelineId, userId } = filters;

  // Fetch sales goals from sales_goals table
  const goalsQuery = useQuery({
    queryKey: ['sales-goals', periodStart.toISOString(), periodEnd.toISOString(), pipelineId],
    queryFn: async () => {
      const { data: orgData } = await supabase.rpc('get_user_organization_id');
      if (!orgData) return null;

      const { data, error } = await supabase
        .from('sales_goals')
        .select('*')
        .eq('organization_id', orgData)
        .lte('period_start', format(periodEnd, 'yyyy-MM-dd'))
        .gte('period_end', format(periodStart, 'yyyy-MM-dd'));

      if (error) throw error;
      return data;
    },
  });

  // Fetch organization's global goal from sales_config
  const orgGoalQuery = useQuery({
    queryKey: ['org-goal'],
    queryFn: async () => {
      const { data: orgData } = await supabase.rpc('get_user_organization_id');
      if (!orgData) return 0;

      const { data } = await supabase
        .from('sales_config')
        .select('monthly_revenue_target')
        .eq('organization_id', orgData)
        .maybeSingle();

      return data?.monthly_revenue_target || 0;
    },
  });

  // Fetch seller goals from OTE config (sum of active sellers' monthly goals)
  const sellerGoalsQuery = useQuery({
    queryKey: ['seller-ote-goals'],
    queryFn: async () => {
      const { data: orgData } = await supabase.rpc('get_user_organization_id');
      if (!orgData) return 0;

      // Buscar metas dos vendedores ativos (não gerentes)
      const { data } = await supabase
        .from('ote_seller_config')
        .select(`
          user_id,
          ote_levels!inner(monthly_goal, is_team_target)
        `)
        .eq('organization_id', orgData)
        .is('end_date', null);

      // Somar apenas vendedores (is_team_target = false)
      return data?.filter((s: any) => !s.ote_levels?.is_team_target)
        .reduce((sum: number, s: any) => sum + (s.ote_levels?.monthly_goal || 0), 0) || 0;
    },
  });

  // Fetch individual seller OTE goal when userId filter is active
  const individualSellerGoalQuery = useQuery({
    queryKey: ['seller-individual-goal', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data: orgData } = await supabase.rpc('get_user_organization_id');
      if (!orgData) return null;

      // Buscar meta do vendedor específico
      const { data } = await supabase
        .from('ote_seller_config')
        .select(`
          user_id,
          custom_goal_override,
          ote_levels!inner(monthly_goal)
        `)
        .eq('organization_id', orgData)
        .eq('user_id', userId)
        .is('end_date', null)
        .maybeSingle();

      if (!data) return null;
      
      // Prioridade: custom_goal_override > ote_levels.monthly_goal
      return (data as any).custom_goal_override || (data as any).ote_levels?.monthly_goal || 0;
    },
    enabled: !!userId,
  });

  // Fetch open opportunities
  const opportunitiesQuery = useQuery({
    queryKey: ['forecast-opportunities', periodStart.toISOString(), periodEnd.toISOString(), pipelineId, userId],
    queryFn: async () => {
      // Get sales and renewal (pós-vendas) pipelines
      const { data: forecastPipelines } = await supabase
        .from('pipelines')
        .select('id')
        .in('pipeline_type', ['sales', 'renewal']);

      const forecastPipelineIds = forecastPipelines?.map(p => p.id) || [];

      let query = supabase
        .from('opportunities')
        .select(`
          id,
          title,
          valor_previsto,
          prob,
          temperature,
          stage_id,
          pipeline_id,
          owner_user_id,
          close_date_prevista,
          updated_at,
          last_contact_date,
          created_at,
          status,
          account_id,
          contact_id,
          account:accounts(id, razao_social, nome_fantasia),
          stage:stages(id, name),
          pipeline:pipelines(id, name, pipeline_type)
        `)
        .in('status', ['open', 'new', null])
        .not('pipeline_id', 'is', null);

      if (forecastPipelineIds.length > 0) {
        query = query.in('pipeline_id', forecastPipelineIds);
      }

      if (pipelineId) {
        query = query.eq('pipeline_id', pipelineId);
      }

      if (userId) {
        query = query.eq('owner_user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch owner names separately
      const ownerIds = [...new Set((data || []).map((o: any) => o.owner_user_id).filter(Boolean))];
      let ownersMap: Record<string, { full_name: string; avatar_url: string | null }> = {};
      
      if (ownerIds.length > 0) {
        const { data: owners } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', ownerIds);
        
        owners?.forEach(owner => {
          ownersMap[owner.user_id] = { full_name: owner.full_name || 'Sem nome', avatar_url: owner.avatar_url };
        });
      }

      // Buscar atividades pendentes/agendadas para cada oportunidade (próximo passo)
      const opportunityIds = (data || []).map((o: any) => o.id);
      let nextStepMap: Set<string> = new Set();
      
      if (opportunityIds.length > 0) {
        const { data: pendingActivities } = await supabase
          .from('activities')
          .select('opportunity_id')
          .in('opportunity_id', opportunityIds)
          .in('status', ['pending', 'scheduled']);
        
        pendingActivities?.forEach(activity => {
          if (activity.opportunity_id) {
            nextStepMap.add(activity.opportunity_id);
          }
        });
      }

      // Buscar última atividade por conta como fallback para oportunidades sem last_contact_date
      const accountIds = [...new Set((data || []).filter((o: any) => o.account_id && !o.last_contact_date).map((o: any) => o.account_id))];
      let accountActivityMap: Record<string, Date> = {};
      
      if (accountIds.length > 0) {
        const { data: accountActivities } = await supabase
          .from('activities')
          .select('account_id, completed_at, updated_at')
          .in('account_id', accountIds)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false });
        
        // Mapear última atividade por conta
        accountActivities?.forEach(activity => {
          if (activity.account_id && !accountActivityMap[activity.account_id]) {
            const activityDate = activity.completed_at || activity.updated_at;
            if (activityDate) {
              accountActivityMap[activity.account_id] = parseISO(activityDate);
            }
          }
        });
      }

      const now = new Date();
      return (data || []).map((opp: any) => {
        // Prioridade: last_contact_date direto > atividade da conta > 999 (sem atividade)
        let daysSinceActivity = 999;
        let lastActivityDate = opp.last_contact_date;
        
        if (opp.last_contact_date) {
          daysSinceActivity = differenceInDays(now, parseISO(opp.last_contact_date));
        } else if (opp.account_id && accountActivityMap[opp.account_id]) {
          // Fallback: usar última atividade da conta
          daysSinceActivity = differenceInDays(now, accountActivityMap[opp.account_id]);
          lastActivityDate = accountActivityMap[opp.account_id].toISOString();
        }
        
        const closeDate = opp.close_date_prevista ? parseDateOnly(opp.close_date_prevista) : null;
        const isSlipping = closeDate && closeDate < now;
        
        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (daysSinceActivity >= 14 || isSlipping) riskLevel = 'critical';
        else if (daysSinceActivity >= 7) riskLevel = 'high';
        else if (daysSinceActivity >= 3) riskLevel = 'medium';

        let category: 'commit' | 'best_case' | 'pipeline' | 'closed' = 'pipeline';
        if ((opp.prob || 0) >= 70) category = 'commit';
        else if ((opp.prob || 0) >= 50) category = 'best_case';

        const owner = opp.owner_user_id ? ownersMap[opp.owner_user_id] : null;

        return {
          id: opp.id,
          title: opp.title,
          valor_previsto: opp.valor_previsto || 0,
          prob: opp.prob || 0,
          temperature: opp.temperature || 'cold',
          stage_name: opp.stage?.name || 'Unknown',
          stage_id: opp.stage_id,
          pipeline_name: opp.pipeline?.name || 'Unknown',
          owner_name: owner?.full_name || 'Sem dono',
          owner_id: opp.owner_user_id,
          close_date_prevista: opp.close_date_prevista,
          days_in_stage: opp.updated_at ? differenceInDays(now, parseISO(opp.updated_at)) : 0,
          last_activity_date: lastActivityDate,
          days_since_activity: daysSinceActivity,
          account_name: opp.account?.nome_fantasia || opp.account?.razao_social || 'Sem conta',
          risk_level: riskLevel,
          category,
          has_contact: !!opp.contact_id,
          has_next_step: nextStepMap.has(opp.id),
        } as ForecastOpportunity;
      });
    },
  });

  // Fetch closed won opportunities this period
  const closedQuery = useQuery({
    queryKey: ['forecast-closed', periodStart.toISOString(), periodEnd.toISOString(), pipelineId, userId],
    queryFn: async () => {
      let query = supabase
        .from('opportunities')
        .select(`
          id,
          valor_previsto,
          owner_user_id,
          pipeline_id,
          created_at,
          updated_at
        `)
        .eq('status', 'won')
        .gte('updated_at', periodStart.toISOString())
        .lte('updated_at', periodEnd.toISOString());

      // Filter by sales and renewal pipelines
      const { data: forecastPipelines } = await supabase
        .from('pipelines')
        .select('id')
        .in('pipeline_type', ['sales', 'renewal']);

      if (forecastPipelines && forecastPipelines.length > 0) {
        const forecastPipelineIds = forecastPipelines.map(p => p.id);
        query = query.in('pipeline_id', forecastPipelineIds);
      }

      if (pipelineId) {
        query = query.eq('pipeline_id', pipelineId);
      }

      if (userId) {
        query = query.eq('owner_user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch lost opportunities for win rate
  const lostQuery = useQuery({
    queryKey: ['forecast-lost', periodStart.toISOString(), periodEnd.toISOString(), pipelineId],
    queryFn: async () => {
      let query = supabase
        .from('opportunities')
        .select('id')
        .eq('status', 'lost')
        .gte('updated_at', periodStart.toISOString())
        .lte('updated_at', periodEnd.toISOString());

      if (pipelineId) {
        query = query.eq('pipeline_id', pipelineId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch team members for seller breakdown
  const teamQuery = useQuery({
    queryKey: ['forecast-team'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url');

      if (error) throw error;
      return data || [];
    },
  });

  // Calculate KPIs
  const kpis: ForecastKPIs | null = (() => {
    if (!opportunitiesQuery.data || !closedQuery.data) return null;

    const opportunities = opportunitiesQuery.data;
    const closedOpps = closedQuery.data;
    const lostOpps = lostQuery.data || [];

    // When userId is selected, use individual seller goal from OTE
    // Otherwise: org global goal > OTE seller sum > sales_goals > 0
    const salesGoalsTotal = goalsQuery.data?.reduce((sum, g) => sum + (g.target_value || 0), 0) || 0;
    const totalGoal = userId && individualSellerGoalQuery.data 
      ? individualSellerGoalQuery.data 
      : (orgGoalQuery.data || sellerGoalsQuery.data || salesGoalsTotal || 0);

    const closedRevenue = closedOpps.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
    const totalPipeline = opportunities.reduce((sum, o) => sum + o.valor_previsto, 0);
    const weightedPipeline = opportunities.reduce((sum, o) => sum + (o.valor_previsto * o.prob / 100), 0);

    const commitOpps = opportunities.filter(o => o.category === 'commit');
    const bestCaseOpps = opportunities.filter(o => o.category === 'commit' || o.category === 'best_case');

    const commitForecast = closedRevenue + commitOpps.reduce((sum, o) => sum + o.valor_previsto, 0);
    const bestCaseForecast = closedRevenue + bestCaseOpps.reduce((sum, o) => sum + o.valor_previsto, 0);

    const now = new Date();
    const daysRemaining = Math.max(0, differenceInDays(periodEnd, now));
    const totalDays = differenceInDays(periodEnd, periodStart);
    const daysElapsed = totalDays - daysRemaining;

    const velocityPerDay = daysElapsed > 0 ? closedRevenue / daysElapsed : 0;

    const wonCount = closedOpps.length;
    const lostCount = lostOpps.length;
    const winRate = wonCount + lostCount > 0 ? (wonCount / (wonCount + lostCount)) * 100 : 0;

    const pipelineCoverage = totalGoal > 0 ? totalPipeline / totalGoal : 0;

    const avgDealSize = closedOpps.length > 0
      ? closedRevenue / closedOpps.length
      : opportunities.length > 0
        ? totalPipeline / opportunities.length
        : 0;

    const slippageCount = opportunities.filter(o => {
      if (!o.close_date_prevista) return false;
      return parseDateOnly(o.close_date_prevista) < now;
    }).length;

    const atRiskCount = opportunities.filter(o => o.risk_level === 'high' || o.risk_level === 'critical').length;

    return {
      goal: totalGoal,
      closedRevenue,
      closedPercentage: totalGoal > 0 ? (closedRevenue / totalGoal) * 100 : 0,
      commitForecast,
      commitPercentage: totalGoal > 0 ? (commitForecast / totalGoal) * 100 : 0,
      bestCaseForecast,
      bestCasePercentage: totalGoal > 0 ? (bestCaseForecast / totalGoal) * 100 : 0,
      pipelineCoverage,
      velocityPerDay,
      winRate,
      daysRemaining,
      totalPipeline,
      weightedPipeline,
      avgDealSize,
      avgCycleLength: 0, // TODO: calculate from historical data
      slippageCount,
      atRiskCount,
    };
  })();

  // Calculate scenarios usando função centralizada (mesma lógica em toda a plataforma)
  const scenarios: ForecastScenario[] = (() => {
    if (!opportunitiesQuery.data || !kpis) return [];

    const opportunities = opportunitiesQuery.data;
    const { goal, closedRevenue } = kpis;

    // Usar função centralizada de forecast.ts
    const centralizedScenarios = calculateForecastScenarios({
      opportunities: opportunities.map(o => ({ valor_previsto: o.valor_previsto, prob: o.prob })),
      closedRevenue,
      goal,
    });

    // Mapear para o formato do hook
    return centralizedScenarios.map((s: any) => ({
      name: s.name === 'pessimista' ? 'pessimistic' : 
            s.name === 'realista' ? 'realistic' : 
            s.name === 'otimista' ? 'optimistic' : 'best_case',
      label: s.label,
      value: s.value,
      percentage: s.percentage,
      probability: s.probability,
      meetsGoal: s.meetsGoal,
      gap: s.gap,
    }));
  })();

  // Calculate seller forecasts
  const sellerForecasts: SellerForecast[] = (() => {
    if (!opportunitiesQuery.data || !closedQuery.data || !teamQuery.data) return [];

    const opportunities = opportunitiesQuery.data;
    const closedOpps = closedQuery.data;
    const team = teamQuery.data;
    const goals = goalsQuery.data || [];

    const sellerMap = new Map<string, SellerForecast>();

    // Initialize from team
    team.forEach(member => {
      const userGoal = goals.find(g => g.user_id === member.user_id);
      sellerMap.set(member.user_id, {
        userId: member.user_id,
        name: member.full_name || 'Sem nome',
        avatar: member.avatar_url,
        goal: userGoal?.target_value || 0,
        closed: 0,
        closedPercentage: 0,
        commit: 0,
        bestCase: 0,
        gap: 0,
        winRate: 0,
        dealCount: 0,
      });
    });

    // Add closed revenue
    closedOpps.forEach(opp => {
      if (!opp.owner_user_id) return;
      const seller = sellerMap.get(opp.owner_user_id);
      if (seller) {
        seller.closed += opp.valor_previsto || 0;
        seller.dealCount += 1;
      }
    });

    // Add pipeline
    opportunities.forEach(opp => {
      if (!opp.owner_id) return;
      const seller = sellerMap.get(opp.owner_id);
      if (seller) {
        if (opp.category === 'commit') {
          seller.commit += opp.valor_previsto;
        }
        if (opp.category === 'commit' || opp.category === 'best_case') {
          seller.bestCase += opp.valor_previsto;
        }
      }
    });

    // Calculate percentages and gap
    sellerMap.forEach(seller => {
      seller.commit += seller.closed;
      seller.bestCase += seller.closed;
      seller.closedPercentage = seller.goal > 0 ? (seller.closed / seller.goal) * 100 : 0;
      seller.gap = seller.goal - seller.commit;
    });

    return Array.from(sellerMap.values())
      .filter(s => s.closed > 0 || s.commit > 0 || s.goal > 0)
      .sort((a, b) => b.closed - a.closed);
  })();

  return {
    kpis,
    scenarios,
    opportunities: opportunitiesQuery.data || [],
    sellerForecasts,
    goals: goalsQuery.data,
    isLoading: opportunitiesQuery.isLoading || closedQuery.isLoading || goalsQuery.isLoading,
    error: opportunitiesQuery.error || closedQuery.error || goalsQuery.error,
    refetch: () => {
      opportunitiesQuery.refetch();
      closedQuery.refetch();
      goalsQuery.refetch();
      lostQuery.refetch();
    },
  };
}

export function useDefaultFilters(): ForecastFilters {
  const now = new Date();
  return {
    periodType: 'monthly',
    periodStart: startOfMonth(now),
    periodEnd: endOfMonth(now),
  };
}
