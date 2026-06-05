import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchStagesCached } from '@/lib/stagesCache';
import { getPipelineMetrics, getStageConversionMetrics } from '@/services/crm/pipeline-metrics';
import { useTeamVisibility } from './useTeamVisibility';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';

export interface ReportFilters {
  pipelines: string[];
  users: string;
  period: string;
  startDate: string;
  endDate: string;
}

export interface LossReasonData {
  id: string;
  name: string;
  count: number;
  value: number;
}

export interface ProcessedOpportunityData {
  status: string;
  count: number;
  total_value: number;
  avg_value: number;
}

export interface MonthlyTrendData {
  month: string;
  won_count: number;
  won_value: number;
  lost_count: number;
  lost_value: number;
  created_count: number;
}

export interface PipelineMetric {
  pipeline_id: string;
  pipeline_name: string;
  pipeline_type: string;
  total_opportunities: number;
  won_count: number;
  lost_count: number;
  active_count: number;
  total_value: number;
  won_value: number;
  win_rate: number;
}

export function useGeneralOverviewData() {
  const { visibleUserIds, canViewAll, loading: visibilityLoading } = useTeamVisibility();
  const { filters, effectiveDates } = useReportFiltersContext();

  return useQuery({
    // Incluir todos os filtros no queryKey para reagir a mudanças
    queryKey: ['reports', 'general-overview', visibleUserIds, effectiveDates, filters.pipelines, filters.users],
    queryFn: async () => {
      // Query base de oportunidades COM filtros de período
      let opportunitiesQuery = supabase
        .from('opportunities')
        .select('id, status, valor_previsto, owner_user_id, pipeline_id, created_at')
        .gte('created_at', effectiveDates.startDate)
        .lte('created_at', effectiveDates.endDate + 'T23:59:59');

      // Filtro de usuário específico OU visibilidade de equipe
      if (filters.users !== 'all') {
        opportunitiesQuery = opportunitiesQuery.eq('owner_user_id', filters.users);
      } else if (!canViewAll && visibleUserIds && visibleUserIds.length > 0) {
        opportunitiesQuery = opportunitiesQuery.in('owner_user_id', visibleUserIds);
      }

      // Filtro de pipeline
      if (filters.pipelines.length > 0) {
        opportunitiesQuery = opportunitiesQuery.in('pipeline_id', filters.pipelines);
      }

      // Buscar pipelines para contexto
      const { data: pipelines } = await supabase
        .from('pipelines')
        .select('id, name, pipeline_type');

      const { data: opportunities, error } = await opportunitiesQuery;
      if (error) throw error;

      // Calcular KPIs a partir dos dados filtrados
      const wonOpps = opportunities?.filter(o => o.status === 'won') || [];
      const lostOpps = opportunities?.filter(o => o.status === 'lost') || [];
      const activeOpps = opportunities?.filter(o => o.status !== 'won' && o.status !== 'lost') || [];
      
      const totalValue = opportunities?.reduce((acc, o) => acc + (o.valor_previsto || 0), 0) || 0;
      const wonValue = wonOpps.reduce((acc, o) => acc + (o.valor_previsto || 0), 0);
      
      const processedCount = wonOpps.length + lostOpps.length;
      const avgWinRate = processedCount > 0 ? (wonOpps.length / processedCount) * 100 : 0;

      // Agrupar por pipeline para o gráfico
      const pipelineMap = new Map<string, PipelineMetric>();
      opportunities?.forEach(opp => {
        const pipelineId = opp.pipeline_id;
        if (!pipelineId) return;
        
        const pipeline = pipelines?.find(p => p.id === pipelineId);
        const existing = pipelineMap.get(pipelineId) || {
          pipeline_id: pipelineId,
          pipeline_name: pipeline?.name || 'Desconhecido',
          pipeline_type: pipeline?.pipeline_type || 'sales',
          total_opportunities: 0,
          won_count: 0,
          lost_count: 0,
          active_count: 0,
          total_value: 0,
          won_value: 0,
          win_rate: 0,
        };
        
        existing.total_opportunities++;
        existing.total_value += opp.valor_previsto || 0;
        
        if (opp.status === 'won') {
          existing.won_count++;
          existing.won_value += opp.valor_previsto || 0;
        } else if (opp.status === 'lost') {
          existing.lost_count++;
        } else {
          existing.active_count++;
        }
        
        // Calcular win rate
        const pipelineProcessed = existing.won_count + existing.lost_count;
        existing.win_rate = pipelineProcessed > 0 ? (existing.won_count / pipelineProcessed) * 100 : 0;
        
        pipelineMap.set(pipelineId, existing);
      });

      return {
        kpis: {
          totalValue,
          wonValue,
          totalDeals: opportunities?.length || 0,
          wonDeals: wonOpps.length,
          lostDeals: lostOpps.length,
          activeDeals: activeOpps.length,
          avgWinRate,
        },
        pipelineMetrics: Array.from(pipelineMap.values()),
      };
    },
    enabled: !visibilityLoading,
  });
}

export function useLostReasonsData() {
  const { visibleUserIds, canViewAll, loading: visibilityLoading } = useTeamVisibility();
  const { filters, effectiveDates } = useReportFiltersContext();

  return useQuery({
    queryKey: ['reports', 'lost-reasons', visibleUserIds, effectiveDates, filters.pipelines, filters.users],
    queryFn: async () => {
      // First get all loss reasons
      const { data: lossReasons, error: lrError } = await supabase
        .from('loss_reasons')
        .select('id, name');

      if (lrError) throw lrError;

      // Then get lost opportunities with filters
      let opportunitiesQuery = supabase
        .from('opportunities')
        .select('id, loss_reason_id, valor_previsto, owner_user_id')
        .eq('status', 'lost')
        .not('loss_reason_id', 'is', null)
        .gte('updated_at', effectiveDates.startDate)
        .lte('updated_at', effectiveDates.endDate + 'T23:59:59');

      // Filtro de usuário específico OU visibilidade de equipe
      if (filters.users !== 'all') {
        opportunitiesQuery = opportunitiesQuery.eq('owner_user_id', filters.users);
      } else if (!canViewAll && visibleUserIds && visibleUserIds.length > 0) {
        opportunitiesQuery = opportunitiesQuery.in('owner_user_id', visibleUserIds);
      }

      // Filtro de pipeline
      if (filters.pipelines.length > 0) {
        opportunitiesQuery = opportunitiesQuery.in('pipeline_id', filters.pipelines);
      }

      const { data: lostOpps, error: oppsError } = await opportunitiesQuery;

      if (oppsError) throw oppsError;

      // Map loss reasons with counts
      const reasons: LossReasonData[] = (lossReasons || [])
        .map(lr => {
          const relatedOpps = (lostOpps || []).filter(o => o.loss_reason_id === lr.id);
          return {
            id: lr.id,
            name: lr.name,
            count: relatedOpps.length,
            value: relatedOpps.reduce((acc, o) => acc + (o.valor_previsto || 0), 0),
          };
        })
        .filter(r => r.count > 0)
        .sort((a, b) => b.count - a.count);

      return reasons;
    },
    enabled: !visibilityLoading,
  });
}

export function useProcessedOpportunitiesData() {
  const { visibleUserIds, canViewAll, loading: visibilityLoading } = useTeamVisibility();
  const { filters, effectiveDates } = useReportFiltersContext();

  return useQuery({
    queryKey: ['reports', 'processed-opportunities', visibleUserIds, effectiveDates, filters.pipelines, filters.users],
    queryFn: async () => {
      // Fetch all won/lost opportunities without date filter in query
      // Then post-filter using closed_at (primary) or updated_at (fallback)
      let query = supabase
        .from('opportunities')
        .select('status, valor_previsto, created_at, updated_at, closed_at, owner_user_id, pipeline_id')
        .in('status', ['won', 'lost']);

      // Filtro de usuário específico OU visibilidade de equipe
      if (filters.users !== 'all') {
        query = query.eq('owner_user_id', filters.users);
      } else if (!canViewAll && visibleUserIds && visibleUserIds.length > 0) {
        query = query.in('owner_user_id', visibleUserIds);
      }

      // Filtro de pipeline
      if (filters.pipelines.length > 0) {
        query = query.in('pipeline_id', filters.pipelines);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Post-filter by closed_at (primary) or updated_at (fallback) within period
      const startDate = new Date(effectiveDates.startDate);
      const endDate = new Date(effectiveDates.endDate + 'T23:59:59');
      
      const filtered = (data || []).filter(o => {
        const closeDate = new Date((o as any).closed_at || o.updated_at);
        return closeDate >= startDate && closeDate <= endDate;
      });

      const won = filtered.filter(o => o.status === 'won');
      const lost = filtered.filter(o => o.status === 'lost');

      return {
        won: {
          count: won.length,
          total_value: won.reduce((acc, o) => acc + (o.valor_previsto || 0), 0),
          avg_value: won.length > 0 ? won.reduce((acc, o) => acc + (o.valor_previsto || 0), 0) / won.length : 0,
        },
        lost: {
          count: lost.length,
          total_value: lost.reduce((acc, o) => acc + (o.valor_previsto || 0), 0),
          avg_value: lost.length > 0 ? lost.reduce((acc, o) => acc + (o.valor_previsto || 0), 0) / lost.length : 0,
        },
        total: {
          count: filtered.length,
          total_value: filtered.reduce((acc, o) => acc + (o.valor_previsto || 0), 0),
        },
        winRate: filtered.length > 0 ? (won.length / filtered.length) * 100 : 0,
      };
    },
    enabled: !visibilityLoading,
  });
}

export function useConversionRateData() {
  const { visibleUserIds, canViewAll, loading: visibilityLoading } = useTeamVisibility();
  const { filters, effectiveDates } = useReportFiltersContext();

  return useQuery({
    queryKey: ['reports', 'conversion-rate', visibleUserIds, effectiveDates, filters.pipelines, filters.users],
    queryFn: async () => {
      // Buscar oportunidades abertas com filtros aplicados
      let query = supabase
        .from('opportunities')
        .select('id, pipeline_id, stage_id, valor_previsto, owner_user_id')
        .eq('status', 'open')
        .gte('created_at', effectiveDates.startDate)
        .lte('created_at', effectiveDates.endDate + 'T23:59:59');

      // Filtro de usuário específico OU visibilidade de equipe
      if (filters.users !== 'all') {
        query = query.eq('owner_user_id', filters.users);
      } else if (!canViewAll && visibleUserIds && visibleUserIds.length > 0) {
        query = query.in('owner_user_id', visibleUserIds);
      }

      // Filtro de pipeline
      if (filters.pipelines.length > 0) {
        query = query.in('pipeline_id', filters.pipelines);
      }

      const stagesResult = await fetchStagesCached();
      const [oppsResult, pipelinesResult] = await Promise.all([
        query,
        supabase.from('pipelines').select('id, name, pipeline_type'),
      ]);

      if (oppsResult.error) throw oppsResult.error;
      if (pipelinesResult.error) throw pipelinesResult.error;

      const opportunities = oppsResult.data || [];
      const pipelines = pipelinesResult.data || [];
      const stages = stagesResult || [];

      // Agrupar por pipeline e stage
      const stageMap = new Map<string, { 
        count: number; 
        value: number; 
        pipelineId: string;
        stageId: string;
        stageName: string;
        orderIndex: number;
      }>();

      opportunities.forEach(opp => {
        if (!opp.stage_id || !opp.pipeline_id) return;
        const key = `${opp.pipeline_id}_${opp.stage_id}`;
        const stage = stages.find(s => s.id === opp.stage_id);
        const existing = stageMap.get(key) || { 
          count: 0, 
          value: 0, 
          pipelineId: opp.pipeline_id, 
          stageId: opp.stage_id,
          stageName: stage?.name || opp.stage_id,
          orderIndex: stage?.order_index || 0
        };
        existing.count++;
        existing.value += opp.valor_previsto || 0;
        stageMap.set(key, existing);
      });

      // Agrupar por pipeline
      const byPipeline = pipelines.reduce((acc, pipeline) => {
        const pipelineStages = Array.from(stageMap.values())
          .filter(s => s.pipelineId === pipeline.id)
          .sort((a, b) => a.orderIndex - b.orderIndex);
        
        if (pipelineStages.length === 0) return acc;

        // Calcular conversion rate entre estágios
        const stagesWithConversion = pipelineStages.map((stage, idx) => {
          const nextStage = pipelineStages[idx + 1];
          const conversionRate = nextStage && stage.count > 0 
            ? (nextStage.count / stage.count) * 100 
            : null;
          return {
            stage_id: stage.stageId,
            stage_name: stage.stageName,
            order_index: stage.orderIndex,
            count: stage.count,
            value: stage.value,
            conversion_rate: conversionRate,
          };
        });

        acc[pipeline.id] = {
          pipeline_id: pipeline.id,
          pipeline_name: pipeline.name,
          stages: stagesWithConversion,
        };
        return acc;
      }, {} as Record<string, { pipeline_id: string; pipeline_name: string; stages: any[] }>);

      return Object.values(byPipeline);
    },
    enabled: !visibilityLoading,
  });
}

export function useRevenueForecastData() {
  const { visibleUserIds, canViewAll, loading: visibilityLoading } = useTeamVisibility();
  const { filters, effectiveDates } = useReportFiltersContext();

  return useQuery({
    queryKey: ['reports', 'revenue-forecast', visibleUserIds, effectiveDates, filters.pipelines, filters.users],
    queryFn: async () => {
      // Usar datas do período selecionado
      const startDate = effectiveDates.startDate;
      const endDate = effectiveDates.endDate + 'T23:59:59';
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);

      // Build queries with visibility and period filters
      let closingQuery = supabase
        .from('opportunities')
        .select('id, title, valor_previsto, prob, close_date_prevista, status, pipeline_id, owner_user_id')
        .eq('status', 'open')
        .gte('close_date_prevista', startDate)
        .lte('close_date_prevista', endDate);

      // Won query: fetch all won, then post-filter by closed_at
      let wonQuery = supabase
        .from('opportunities')
        .select('id, valor_previsto, updated_at, closed_at, owner_user_id, pipeline_id')
        .eq('status', 'won');

      // Filtro de usuário específico OU visibilidade de equipe
      if (filters.users !== 'all') {
        closingQuery = closingQuery.eq('owner_user_id', filters.users);
        wonQuery = wonQuery.eq('owner_user_id', filters.users);
      } else if (!canViewAll && visibleUserIds && visibleUserIds.length > 0) {
        closingQuery = closingQuery.in('owner_user_id', visibleUserIds);
        wonQuery = wonQuery.in('owner_user_id', visibleUserIds);
      }

      // Filtro de pipeline
      if (filters.pipelines.length > 0) {
        closingQuery = closingQuery.in('pipeline_id', filters.pipelines);
        wonQuery = wonQuery.in('pipeline_id', filters.pipelines);
      }

      const [{ data: closingThisMonth }, { data: wonData }, pipelineMetrics] = await Promise.all([
        closingQuery,
        wonQuery,
        getPipelineMetrics(visibleUserIds),
      ]);

      // Post-filter won by closed_at (primary) or updated_at (fallback)
      const wonThisMonth = (wonData || []).filter(o => {
        const closeDate = new Date((o as any).closed_at || o.updated_at);
        return closeDate >= startDateObj && closeDate <= endDateObj;
      });

      const closedRevenue = wonThisMonth.reduce((acc, o) => acc + (o.valor_previsto || 0), 0);
      const openPipeline = closingThisMonth?.reduce((acc, o) => acc + (o.valor_previsto || 0), 0) || 0;
      const weightedPipeline = closingThisMonth?.reduce((acc, o) => {
        const prob = (o.prob || 50) / 100;
        return acc + (o.valor_previsto || 0) * prob;
      }, 0) || 0;

      // Calculate scenarios
      const pessimistic = closedRevenue + weightedPipeline * 0.5;
      const realistic = closedRevenue + weightedPipeline;
      const optimistic = closedRevenue + weightedPipeline * 1.5;
      const bestCase = closedRevenue + openPipeline;

      // Sprint 2.1 — meta lida de organization_settings.monthly_revenue_goal
      // Se não configurada, retorna 0 (UI exibe "Meta não configurada").
      let goal = 0;
      try {
        const { data: orgRow } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
          .maybeSingle();
        if (orgRow?.organization_id) {
          const { data: settingsRow } = await supabase
            .from('organization_settings')
            .select('monthly_revenue_goal')
            .eq('organization_id', orgRow.organization_id)
            .maybeSingle();
          goal = Number(settingsRow?.monthly_revenue_goal ?? 0);
        }
      } catch (err) {
        console.warn('[useRevenueForecastData] failed to read monthly_revenue_goal:', err);
        goal = 0;
      }

      return {
        closedRevenue,
        openPipeline,
        weightedPipeline,
        goal,
        scenarios: [
          { name: 'Pessimista', value: pessimistic, probability: 25 },
          { name: 'Realista', value: realistic, probability: 50 },
          { name: 'Otimista', value: optimistic, probability: 20 },
          { name: 'Melhor Caso', value: bestCase, probability: 5 },
        ],
      closingOpportunities: closingThisMonth || [],
        pipelineMetrics,
      };
    },
    enabled: !visibilityLoading,
  });
}

// ==================== Origin Report ====================

export interface OriginReportItem {
  origem: string;
  total: number;
  won: number;
  lost: number;
  open: number;
  wonValue: number;
  lostValue: number;
  totalValue: number;
  conversionRate: number;
  avgTicket: number;
}

export function useOriginReportData() {
  const { visibleUserIds, canViewAll, loading: visibilityLoading } = useTeamVisibility();
  const { filters, effectiveDates } = useReportFiltersContext();

  return useQuery({
    queryKey: ['reports', 'origin-report', visibleUserIds, effectiveDates, filters.pipelines, filters.users],
    queryFn: async () => {
      let query = supabase
        .from('opportunities')
        .select('id, origem, status, valor_previsto, owner_user_id, pipeline_id, created_at')
        .gte('created_at', effectiveDates.startDate)
        .lte('created_at', effectiveDates.endDate + 'T23:59:59');

      if (filters.users !== 'all') {
        query = query.eq('owner_user_id', filters.users);
      } else if (!canViewAll && visibleUserIds && visibleUserIds.length > 0) {
        query = query.in('owner_user_id', visibleUserIds);
      }

      if (filters.pipelines.length > 0) {
        query = query.in('pipeline_id', filters.pipelines);
      }

      const { data, error } = await query;
      if (error) throw error;

      const grouped: Record<string, OriginReportItem> = {};

      (data || []).forEach((opp) => {
        const key = opp.origem || 'Sem origem';
        if (!grouped[key]) {
          grouped[key] = { origem: key, total: 0, won: 0, lost: 0, open: 0, wonValue: 0, lostValue: 0, totalValue: 0, conversionRate: 0, avgTicket: 0 };
        }
        const g = grouped[key];
        g.total++;
        const val = opp.valor_previsto || 0;
        g.totalValue += val;

        if (opp.status === 'won') {
          g.won++;
          g.wonValue += val;
        } else if (opp.status === 'lost') {
          g.lost++;
          g.lostValue += val;
        } else {
          g.open++;
        }
      });

      const result = Object.values(grouped).map((g) => ({
        ...g,
        conversionRate: g.total > 0 ? (g.won / g.total) * 100 : 0,
        avgTicket: g.won > 0 ? g.wonValue / g.won : 0,
      }));

      result.sort((a, b) => b.total - a.total);
      return result;
    },
    enabled: !visibilityLoading,
  });
}
