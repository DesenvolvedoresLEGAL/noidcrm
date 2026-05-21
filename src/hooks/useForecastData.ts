import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, differenceInDays, format, parseISO } from 'date-fns';
import { parseDateOnly } from '@/lib/dateUtils';
import { calculateForecastScenarios } from '@/services/crm/forecast';
import { forecastKeys, salesGoalKeys } from '@/lib/query-keys';
import { revenueSsotService } from '@/services/revenue/revenueSsotService';

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
  // NRHS Integration
  nrhsAverage: number;
  nrhsConfidence: 'high' | 'moderate' | 'low' | 'very_low';
  excludedByNrhsValue: number;
  excludedByNrhsCount: number;
}

export type ForecastEligibility = 'full' | 'partial' | 'low_confidence' | 'excluded';

export interface ForecastOpportunity {
  id: string;
  title: string;
  valor_previsto: number;
  prob: number;
  stage_probability: number | null;
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
  // NRHS Integration
  nrhs_score: number | null;
  nrhs_tier: string | null;
  nrhs_weight_factor: number;
  forecast_eligibility: ForecastEligibility;
  forecast_adjusted_value: number;
}

// NRHS Helper functions
export function getNRHSWeightFactor(score: number | null): number {
  if (score === null || score === undefined) return 0.7; // Score não calculado = confiança moderada
  if (score >= 75) return 1.0;
  if (score >= 60) return 0.7;
  if (score >= 40) return 0.4;
  return 0.0; // Excluído
}

export function getForecastEligibility(score: number | null): ForecastEligibility {
  if (score === null || score === undefined) return 'partial';
  if (score >= 75) return 'full';
  if (score >= 60) return 'partial';
  if (score >= 40) return 'low_confidence';
  return 'excluded';
}

export function getNRHSConfidence(avgScore: number): 'high' | 'moderate' | 'low' | 'very_low' {
  if (avgScore >= 75) return 'high';
  if (avgScore >= 60) return 'moderate';
  if (avgScore >= 40) return 'low';
  return 'very_low';
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
  dealIds: string[];
  dealCount: number;
  // NRHS Integration
  nrhsAverage?: number;
  excludedCount?: number;
  excludedValue?: number;
}

export function useForecastData(filters: ForecastFilters) {
  const { periodStart, periodEnd, pipelineId, userId, periodType } = filters;
  const queryClient = useQueryClient();

  // F2.9.2: months in the selected period (used to scale monthly goals)
  const periodMonthsMultiplier = periodType === 'yearly' ? 12 : periodType === 'quarterly' ? 3 : 1;
  // F2.9.2: column from sales_config that matches the selected period
  const orgGoalColumn: 'monthly_revenue_target' | 'quarterly_goal' | 'yearly_goal' =
    periodType === 'yearly' ? 'yearly_goal'
      : periodType === 'quarterly' ? 'quarterly_goal'
      : 'monthly_revenue_target';

  // Fetch sales goals from sales_goals table
  const goalsQuery = useQuery({
    queryKey: salesGoalKeys.list(periodStart.toISOString(), periodEnd.toISOString(), pipelineId),
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

  // F2.9.2: Fetch org-wide goal from sales_config selecting the right column per period
  const orgGoalQuery = useQuery({
    queryKey: salesGoalKeys.orgGoal(periodType),
    queryFn: async () => {
      const { data: orgData } = await supabase.rpc('get_user_organization_id');
      if (!orgData) return 0;

      // Read all goal columns; pick the right one based on period, with monthly fallback scaled
      const { data } = await supabase
        .from('sales_config')
        .select('monthly_revenue_target, quarterly_goal, semester_goal, yearly_goal')
        .eq('organization_id', orgData)
        .maybeSingle();

      if (!data) return 0;
      const periodValue = (data as any)[orgGoalColumn] as number | null | undefined;
      if (periodValue && periodValue > 0) return Number(periodValue);
      // Fallback: scale monthly_revenue_target if quarterly/yearly is empty
      const monthly = Number(data.monthly_revenue_target ?? 0);
      return monthly > 0 ? monthly * periodMonthsMultiplier : 0;
    },
  });

  // Fetch seller goals from OTE (sum of active sellers' monthly goals × period months)
  const sellerGoalsQuery = useQuery({
    queryKey: salesGoalKeys.sellerOteGoals(periodType),
    queryFn: async () => {
      const { data: orgData } = await supabase.rpc('get_user_organization_id');
      if (!orgData) return 0;

      const { data } = await supabase
        .from('ote_seller_config')
        .select(`
          user_id,
          custom_goal_override,
          ote_levels!inner(monthly_goal, is_team_target, goal_type)
        `)
        .eq('organization_id', orgData)
        .is('end_date', null);

      const monthlySum = data?.filter((s: any) => !s.ote_levels?.is_team_target && s.ote_levels?.goal_type !== 'leads')
        .reduce((sum: number, s: any) => sum + Number(s.custom_goal_override || s.ote_levels?.monthly_goal || 0), 0) || 0;
      return monthlySum * periodMonthsMultiplier;
    },
  });

  // Fetch individual seller OTE goal when userId filter is active (scaled by period)
  const individualSellerGoalQuery = useQuery({
    queryKey: [...salesGoalKeys.sellerIndividualGoal(userId), periodType],
    queryFn: async () => {
      if (!userId) return null;

      const { data: orgData } = await supabase.rpc('get_user_organization_id');
      if (!orgData) return null;

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

      const monthly = Number((data as any).custom_goal_override || (data as any).ote_levels?.monthly_goal || 0);
      return monthly * periodMonthsMultiplier;
    },
    enabled: !!userId,
  });

  // Fetch open opportunities
  const opportunitiesQuery = useQuery({
    queryKey: forecastKeys.opportunities({ start: periodStart.toISOString(), end: periodEnd.toISOString(), pipelineId, userId }),
    queryFn: async () => {
      // Get primary pipeline for forecast (is_primary = true)
      let forecastPipelineIds: string[] = [];
      
      if (!pipelineId) {
        const { data: forecastPipelines } = await supabase
          .from('pipelines')
          .select('id')
          .eq('is_primary', true);
        forecastPipelineIds = forecastPipelines?.map(p => p.id) || [];
      }

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
          nrhs_score,
          nrhs_tier,
          account:accounts(id, razao_social, nome_fantasia),
          stage:stages(id, name, probability),
          pipeline:pipelines(id, name, pipeline_type)
        `)
        .in('status', ['open', 'new', null])
        .not('pipeline_id', 'is', null)
        .is('deleted_at', null);

      if (!pipelineId && forecastPipelineIds.length > 0) {
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

        // NRHS calculations
        const nrhsScore = opp.nrhs_score as number | null;
        const nrhsWeightFactor = getNRHSWeightFactor(nrhsScore);
        const forecastEligibility = getForecastEligibility(nrhsScore);
        const valor = opp.valor_previsto || 0;
        const forecastAdjustedValue = valor * ((opp.prob || 0) / 100) * nrhsWeightFactor;

        return {
          id: opp.id,
          title: opp.title,
          valor_previsto: valor,
          prob: opp.prob || 0,
          stage_probability: opp.stage?.probability || null,
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
          // NRHS fields
          nrhs_score: nrhsScore,
          nrhs_tier: opp.nrhs_tier as string | null,
          nrhs_weight_factor: nrhsWeightFactor,
          forecast_eligibility: forecastEligibility,
          forecast_adjusted_value: forecastAdjustedValue,
        } as ForecastOpportunity;
      });
    },
  });

  // Fetch closed won opportunities this period (using closed_at for accurate date tracking)
  const closedQuery = useQuery({
    queryKey: forecastKeys.closed({ start: periodStart.toISOString(), end: periodEnd.toISOString(), pipelineId, userId }),
    queryFn: async () => {
      // Get primary pipeline for forecast
      let forecastPipelineIds: string[] = [];
      
      if (!pipelineId) {
        const { data: forecastPipelines } = await supabase
          .from('pipelines')
          .select('id')
          .eq('is_primary', true);
        forecastPipelineIds = forecastPipelines?.map(p => p.id) || [];
      }

      let query = supabase
        .from('opportunities')
        .select(`
          id,
          valor_previsto,
          commission_value,
          owner_user_id,
          pipeline_id,
          created_at,
          closed_at,
          updated_at
        `)
        .eq('status', 'won')
        .is('deleted_at', null)
        .or(`closed_at.gte.${periodStart.toISOString()},and(closed_at.is.null,updated_at.gte.${periodStart.toISOString()})`)
        .or(`closed_at.lte.${periodEnd.toISOString()},and(closed_at.is.null,updated_at.lte.${periodEnd.toISOString()})`);

      if (!pipelineId && forecastPipelineIds.length > 0) {
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
      
      // Post-filter to ensure accurate date range (closed_at takes priority)
      const filtered = (data || []).filter(opp => {
        const closeDate = new Date((opp as any).closed_at || opp.updated_at);
        return closeDate >= periodStart && closeDate <= periodEnd;
      });
      
      return filtered;
    },
  });

  // Fetch lost opportunities for win rate (using closed_at for accurate date tracking)
  const lostQuery = useQuery({
    queryKey: forecastKeys.lost({ start: periodStart.toISOString(), end: periodEnd.toISOString(), pipelineId, userId }),
    queryFn: async () => {
      // Get primary pipeline for forecast
      let forecastPipelineIds: string[] = [];
      
      if (!pipelineId) {
        const { data: forecastPipelines } = await supabase
          .from('pipelines')
          .select('id')
          .eq('is_primary', true);
        forecastPipelineIds = forecastPipelines?.map(p => p.id) || [];
      }

      let query = supabase
        .from('opportunities')
        .select('id, closed_at, updated_at')
        .eq('status', 'lost')
        .is('deleted_at', null);

      if (!pipelineId && forecastPipelineIds.length > 0) {
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
      
      // Filter by closed_at (or updated_at fallback) in date range
      const filtered = (data || []).filter(opp => {
        const closeDate = new Date((opp as any).closed_at || opp.updated_at);
        return closeDate >= periodStart && closeDate <= periodEnd;
      });
      
      return filtered;
    },
  });

  // P0 Revenue SSoT — Receita Fechada lida exclusivamente de commercial_won_revenue_view.
  // Quando disponível, override em KPIs.closedRevenue e SellerForecast.closed.
  const closedSsotQuery = useQuery({
    queryKey: forecastKeys.closedSsot({
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
      pipelineId,
      userId,
    }),
    queryFn: async () => {
      const { data: orgId } = await supabase.rpc('get_user_organization_id');
      if (!orgId) return null;
      const params = {
        organizationId: orgId as string,
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
        pipelineIds: pipelineId ? [pipelineId] : null,
        sellerIds: userId ? [userId] : null,
      };
      const [summary, bySeller] = await Promise.all([
        revenueSsotService.getClosedRevenueSummary(params),
        revenueSsotService.getRevenueBySeller(params),
      ]);
      return { summary, bySeller };
    },
    staleTime: 30_000,
  });

  // Fetch team members for seller breakdown
  const teamQuery = useQuery({
    queryKey: forecastKeys.team(),
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

    // P0 Revenue SSoT — Receita Fechada vem de commercial_won_revenue_view.
    // Fallback para soma legada apenas se SSoT ainda não retornou.
    const ssotSummary = closedSsotQuery.data?.summary;
    const closedRevenue = ssotSummary
      ? ssotSummary.total
      : closedOpps.reduce((sum, o) => sum + (o.valor_previsto ?? 0), 0);
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

    // NRHS metrics
    const oppsWithNRHS = opportunities.filter(o => o.nrhs_score !== null);
    const nrhsScores = oppsWithNRHS.map(o => o.nrhs_score as number);
    const nrhsAverage = nrhsScores.length > 0 
      ? nrhsScores.reduce((a, b) => a + b, 0) / nrhsScores.length 
      : 0;
    
    const excludedOpps = opportunities.filter(o => o.forecast_eligibility === 'excluded');
    const excludedByNrhsValue = excludedOpps.reduce((sum, o) => sum + o.valor_previsto, 0);
    const excludedByNrhsCount = excludedOpps.length;

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
      // NRHS metrics
      nrhsAverage,
      nrhsConfidence: getNRHSConfidence(nrhsAverage),
      excludedByNrhsValue,
      excludedByNrhsCount,
    };
  })();

  // Calculate scenarios usando função centralizada (mesma lógica em toda a plataforma)
  const scenarios: ForecastScenario[] = (() => {
    if (!opportunitiesQuery.data || !kpis) return [];

    const opportunities = opportunitiesQuery.data;
    const { goal, closedRevenue } = kpis;

    // Usar função centralizada de forecast.ts com NRHS data
    const centralizedScenarios = calculateForecastScenarios({
      opportunities: opportunities.map(o => ({ 
        id: o.id, 
        valor_previsto: o.valor_previsto, 
        prob: o.prob,
        stage_probability: o.stage_probability,
        nrhs_score: o.nrhs_score,
        nrhs_weight_factor: o.nrhs_weight_factor,
        forecast_eligibility: o.forecast_eligibility,
      })),
      closedRevenue,
      goal,
    });

    // Retornar cenários diretamente (já estão no formato correto)
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
      dealIds: s.dealIds || [],
      dealCount: s.dealCount || 0,
      nrhsAverage: s.nrhsAverage || 0,
      excludedCount: s.excludedCount || 0,
      excludedValue: s.excludedValue || 0,
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

    // P0 Revenue SSoT — receita ganha por vendedor vem de commercial_won_revenue_view.
    const ssotBySeller = new Map<string, number>(
      (closedSsotQuery.data?.bySeller ?? []).map((g) => [g.key, g.total]),
    );
    const useSsot = ssotBySeller.size > 0;

    // Add closed revenue (count from legado; valor monetário vem do SSoT quando disponível)
    closedOpps.forEach(opp => {
      if (!opp.owner_user_id) return;
      const seller = sellerMap.get(opp.owner_user_id);
      if (seller) {
        if (!useSsot) seller.closed += opp.valor_previsto || 0;
        seller.dealCount += 1;
      }
    });
    if (useSsot) {
      sellerMap.forEach((seller, userId) => {
        seller.closed = ssotBySeller.get(userId) ?? 0;
      });
    }

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

  const isFetching =
    opportunitiesQuery.isFetching ||
    closedQuery.isFetching ||
    closedSsotQuery.isFetching ||
    goalsQuery.isFetching ||
    lostQuery.isFetching;

  return {
    kpis,
    scenarios,
    opportunities: opportunitiesQuery.data || [],
    sellerForecasts,
    goals: goalsQuery.data,
    isLoading: opportunitiesQuery.isLoading || closedQuery.isLoading || goalsQuery.isLoading,
    isFetching,
    error: opportunitiesQuery.error || closedQuery.error || goalsQuery.error,
    dataUpdatedAt: Math.max(
      opportunitiesQuery.dataUpdatedAt || 0,
      closedQuery.dataUpdatedAt || 0,
      closedSsotQuery.dataUpdatedAt || 0,
    ),
    refetch: async () => {
      await queryClient.invalidateQueries({ queryKey: forecastKeys.opportunitiesAll() });
      await queryClient.invalidateQueries({ queryKey: forecastKeys.closedAll() });
      await queryClient.invalidateQueries({ queryKey: forecastKeys.closedSsotAll() });
      await queryClient.invalidateQueries({ queryKey: forecastKeys.lostAll() });
      await queryClient.invalidateQueries({ queryKey: salesGoalKeys.listAll() });
      await queryClient.invalidateQueries({ queryKey: forecastKeys.aiInsightsAll() });
      await Promise.all([
        opportunitiesQuery.refetch(),
        closedQuery.refetch(),
        closedSsotQuery.refetch(),
        goalsQuery.refetch(),
        lostQuery.refetch(),
      ]);
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
