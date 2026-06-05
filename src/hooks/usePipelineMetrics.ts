import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchStagesCached } from '@/lib/stagesCache';
import { 
  getPipelineMetrics, 
  getSalesPipelineMetrics, 
  getQualificationPipelineMetrics,
  getSDRPerformance,
  getCloserPerformance,
  getStageConversionMetrics,
  getHandoffMetrics,
  getDashboardMetrics,
  PipelineMetrics,
  SDRPerformance,
  CloserPerformance,
  StageConversionMetrics,
  HandoffMetrics
} from '@/services/crm/pipeline-metrics';
import { useTeamVisibility } from './useTeamVisibility';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';

export function usePipelineMetrics() {
  const { visibleUserIds, loading: visibilityLoading } = useTeamVisibility();
  
  return useQuery<PipelineMetrics[]>({
    queryKey: ['pipeline-metrics', visibleUserIds],
    queryFn: () => getPipelineMetrics(visibleUserIds),
    enabled: !visibilityLoading,
  });
}

export function useSalesPipelineMetrics() {
  const { visibleUserIds, loading: visibilityLoading } = useTeamVisibility();
  
  return useQuery<PipelineMetrics[]>({
    queryKey: ['sales-pipeline-metrics', visibleUserIds],
    queryFn: () => getSalesPipelineMetrics(visibleUserIds),
    enabled: !visibilityLoading,
  });
}

export function useQualificationPipelineMetrics() {
  const { visibleUserIds, loading: visibilityLoading } = useTeamVisibility();
  
  return useQuery<PipelineMetrics[]>({
    queryKey: ['qualification-pipeline-metrics', visibleUserIds],
    queryFn: () => getQualificationPipelineMetrics(visibleUserIds),
    enabled: !visibilityLoading,
  });
}

/**
 * Hook de SDR Performance COM filtros de período e pipeline
 */
export function useSDRPerformance() {
  const { visibleUserIds, canViewAll, loading: visibilityLoading } = useTeamVisibility();
  const { filters, effectiveDates } = useReportFiltersContext();
  
  return useQuery({
    queryKey: ['sdr-performance', visibleUserIds, effectiveDates, filters.pipelines, filters.users],
    queryFn: async () => {
      // Buscar oportunidades qualificadas (com sdr_user_id) no período
      let query = supabase
        .from('opportunities')
        .select('id, status, valor_previsto, qualified_by_user_id, owner_user_id, pipeline_id, created_at, qualified_at')
        .not('qualified_by_user_id', 'is', null)
        .gte('created_at', effectiveDates.startDate)
        .lte('created_at', effectiveDates.endDate + 'T23:59:59');

      // Filtro de usuário específico OU visibilidade de equipe
      if (filters.users !== 'all') {
        query = query.eq('qualified_by_user_id', filters.users);
      } else if (!canViewAll && visibleUserIds && visibleUserIds.length > 0) {
        query = query.in('qualified_by_user_id', visibleUserIds);
      }

      // Filtro de pipeline
      if (filters.pipelines.length > 0) {
        query = query.in('pipeline_id', filters.pipelines);
      }

      const [oppsResult, usersResult] = await Promise.all([
        query,
        supabase.from('profiles').select('id, full_name'),
      ]);

      if (oppsResult.error) throw oppsResult.error;
      if (usersResult.error) throw usersResult.error;

      const opportunities = oppsResult.data || [];
      const users = usersResult.data || [];

      // Agrupar por SDR
      const sdrMap = new Map<string, SDRPerformance>();
      
      opportunities.forEach(opp => {
        const sdrId = opp.qualified_by_user_id;
        if (!sdrId) return;

        const user = users.find(u => u.id === sdrId);
        const existing = sdrMap.get(sdrId) || {
          sdr_user_id: sdrId,
          sdr_name: user?.full_name || 'Desconhecido',
          organization_id: '',
          total_sqls_generated: 0,
          deals_won: 0,
          deals_lost: 0,
          revenue_attributed: 0,
          conversion_rate: 0,
          avg_qualification_hours: 0,
        };

        existing.total_sqls_generated++;
        if (opp.status === 'won') {
          existing.deals_won++;
          existing.revenue_attributed += opp.valor_previsto || 0;
        } else if (opp.status === 'lost') {
          existing.deals_lost++;
        }

        sdrMap.set(sdrId, existing);
      });

      // Calcular taxas
      sdrMap.forEach(sdr => {
        const processed = sdr.deals_won + sdr.deals_lost;
        sdr.conversion_rate = processed > 0 ? (sdr.deals_won / processed) * 100 : 0;
      });

      return Array.from(sdrMap.values()).sort((a, b) => b.revenue_attributed - a.revenue_attributed);
    },
    enabled: !visibilityLoading,
  });
}

/**
 * Hook de Closer Performance COM filtros de período e pipeline
 */
export function useCloserPerformance() {
  const { visibleUserIds, canViewAll, loading: visibilityLoading } = useTeamVisibility();
  const { filters, effectiveDates } = useReportFiltersContext();
  
  return useQuery({
    queryKey: ['closer-performance', visibleUserIds, effectiveDates, filters.pipelines, filters.users],
    queryFn: async () => {
      // Buscar oportunidades do closer no período
      let query = supabase
        .from('opportunities')
        .select('id, status, valor_previsto, owner_user_id, pipeline_id, created_at, updated_at')
        .not('owner_user_id', 'is', null)
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

      const [oppsResult, usersResult] = await Promise.all([
        query,
        supabase.from('profiles').select('id, full_name'),
      ]);

      if (oppsResult.error) throw oppsResult.error;
      if (usersResult.error) throw usersResult.error;

      const opportunities = oppsResult.data || [];
      const users = usersResult.data || [];

      // Agrupar por closer
      const closerMap = new Map<string, CloserPerformance>();
      
      opportunities.forEach(opp => {
        const closerId = opp.owner_user_id;
        if (!closerId) return;

        const user = users.find(u => u.id === closerId);
        const existing = closerMap.get(closerId) || {
          closer_user_id: closerId,
          closer_name: user?.full_name || 'Desconhecido',
          organization_id: '',
          deals_won: 0,
          deals_lost: 0,
          deals_active: 0,
          revenue_closed: 0,
          pipeline_value: 0,
          avg_deal_size: 0,
          win_rate: 0,
          avg_sales_cycle_days: 0,
        };

        if (opp.status === 'won') {
          existing.deals_won++;
          existing.revenue_closed += opp.valor_previsto || 0;
        } else if (opp.status === 'lost') {
          existing.deals_lost++;
        } else {
          existing.deals_active++;
          existing.pipeline_value += opp.valor_previsto || 0;
        }

        closerMap.set(closerId, existing);
      });

      // Calcular médias e taxas
      closerMap.forEach(closer => {
        const processed = closer.deals_won + closer.deals_lost;
        closer.win_rate = processed > 0 ? (closer.deals_won / processed) * 100 : 0;
        closer.avg_deal_size = closer.deals_won > 0 ? closer.revenue_closed / closer.deals_won : 0;
      });

      return Array.from(closerMap.values()).sort((a, b) => b.revenue_closed - a.revenue_closed);
    },
    enabled: !visibilityLoading,
  });
}

/**
 * Hook de Stage Conversion Metrics COM filtros de período e pipeline
 */
export function useStageConversionMetrics() {
  const { visibleUserIds, canViewAll, loading: visibilityLoading } = useTeamVisibility();
  const { filters, effectiveDates } = useReportFiltersContext();
  
  return useQuery({
    queryKey: ['stage-conversion-metrics', visibleUserIds, effectiveDates, filters.pipelines, filters.users],
    queryFn: async () => {
      // Buscar oportunidades abertas com filtros
      let query = supabase
        .from('opportunities')
        .select('id, pipeline_id, stage_id, valor_previsto, owner_user_id, status')
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

      const [oppsResult, pipelinesResult, stagesResult] = await Promise.all([
        query,
        supabase.from('pipelines').select('id, name, pipeline_type, organization_id'),
        fetchStagesCached(),
      ]);

      if (oppsResult.error) throw oppsResult.error;
      if (pipelinesResult.error) throw pipelinesResult.error;

      const opportunities = oppsResult.data || [];
      const pipelines = pipelinesResult.data || [];
      const stages = stagesResult || [];

      // Agrupar por pipeline e stage
      const stageMetrics: StageConversionMetrics[] = [];

      pipelines.forEach(pipeline => {
        const pipelineStages = stages.filter(s => s.pipeline_id === pipeline.id);
        const pipelineOpps = opportunities.filter(o => o.pipeline_id === pipeline.id);

        pipelineStages.forEach((stage, idx) => {
          const stageOpps = pipelineOpps.filter(o => o.stage_id === stage.id);
          const nextStage = pipelineStages[idx + 1];
          const nextStageOpps = nextStage ? pipelineOpps.filter(o => o.stage_id === nextStage.id) : [];
          
          const conversionRate = stageOpps.length > 0 && nextStage
            ? (nextStageOpps.length / stageOpps.length) * 100
            : null;

          stageMetrics.push({
            stage_id: stage.id,
            stage_name: stage.name,
            order_index: stage.order_index,
            pipeline_id: pipeline.id,
            pipeline_name: pipeline.name,
            pipeline_type: pipeline.pipeline_type || 'sales',
            organization_id: pipeline.organization_id,
            total_opportunities: stageOpps.length,
            opportunities_count: stageOpps.length,
            won_count: stageOpps.filter(o => o.status === 'won').length,
            lost_count: stageOpps.filter(o => o.status === 'lost').length,
            total_value: stageOpps.reduce((acc, o) => acc + (o.valor_previsto || 0), 0),
            stage_value: stageOpps.reduce((acc, o) => acc + (o.valor_previsto || 0), 0),
            avg_days_in_stage: 0,
            conversion_rate_to_next: conversionRate,
          });
        });
      });

      return stageMetrics;
    },
    enabled: !visibilityLoading,
  });
}

/**
 * Hook de Handoff Metrics COM filtros de período e pipeline
 */
export function useHandoffMetrics() {
  const { visibleUserIds, canViewAll, loading: visibilityLoading } = useTeamVisibility();
  const { filters, effectiveDates } = useReportFiltersContext();
  
  return useQuery({
    queryKey: ['handoff-metrics', visibleUserIds, effectiveDates, filters.pipelines, filters.users],
    queryFn: async () => {
      // Buscar oportunidades com handoff (tem qualified_by e owner diferentes)
      let query = supabase
        .from('opportunities')
        .select('id, status, valor_previsto, qualified_by_user_id, owner_user_id, pipeline_id, qualified_at, created_at')
        .not('qualified_by_user_id', 'is', null)
        .not('owner_user_id', 'is', null)
        .gte('created_at', effectiveDates.startDate)
        .lte('created_at', effectiveDates.endDate + 'T23:59:59');

      // Filtro de visibilidade
      if (filters.users !== 'all') {
        // Mostrar handoffs onde o usuário é SDR ou closer
        query = query.or(`qualified_by_user_id.eq.${filters.users},owner_user_id.eq.${filters.users}`);
      } else if (!canViewAll && visibleUserIds && visibleUserIds.length > 0) {
        query = query.or(`qualified_by_user_id.in.(${visibleUserIds.join(',')}),owner_user_id.in.(${visibleUserIds.join(',')})`);
      }

      // Filtro de pipeline
      if (filters.pipelines.length > 0) {
        query = query.in('pipeline_id', filters.pipelines);
      }

      const [oppsResult, usersResult] = await Promise.all([
        query,
        supabase.from('profiles').select('id, full_name'),
      ]);

      if (oppsResult.error) throw oppsResult.error;
      if (usersResult.error) throw usersResult.error;

      const opportunities = oppsResult.data || [];
      const users = usersResult.data || [];

      // Filtrar apenas onde SDR ≠ Closer (handoffs reais)
      const handoffOpps = opportunities.filter(o => o.qualified_by_user_id !== o.owner_user_id);

      // Agrupar por par SDR -> Closer
      const handoffMap = new Map<string, HandoffMetrics>();

      handoffOpps.forEach(opp => {
        const key = `${opp.qualified_by_user_id}_${opp.owner_user_id}`;
        const sdr = users.find(u => u.id === opp.qualified_by_user_id);
        const closer = users.find(u => u.id === opp.owner_user_id);

        const existing = handoffMap.get(key) || {
          sdr_user_id: opp.qualified_by_user_id!,
          sdr_name: sdr?.full_name || 'Desconhecido',
          closer_user_id: opp.owner_user_id!,
          closer_name: closer?.full_name || 'Desconhecido',
          organization_id: '',
          total_handoffs: 0,
          won_after_handoff: 0,
          lost_after_handoff: 0,
          active_after_handoff: 0,
          revenue_from_handoffs: 0,
          handoff_win_rate: 0,
          avg_qualification_hours: 0,
        };

        existing.total_handoffs++;
        if (opp.status === 'won') {
          existing.won_after_handoff++;
          existing.revenue_from_handoffs += opp.valor_previsto || 0;
        } else if (opp.status === 'lost') {
          existing.lost_after_handoff++;
        } else {
          existing.active_after_handoff++;
        }

        handoffMap.set(key, existing);
      });

      // Calcular taxas
      handoffMap.forEach(handoff => {
        const processed = handoff.won_after_handoff + handoff.lost_after_handoff;
        handoff.handoff_win_rate = processed > 0 ? (handoff.won_after_handoff / processed) * 100 : 0;
      });

      return Array.from(handoffMap.values()).sort((a, b) => b.revenue_from_handoffs - a.revenue_from_handoffs);
    },
    enabled: !visibilityLoading,
  });
}

export function useDashboardMetrics() {
  const { visibleUserIds, loading: visibilityLoading } = useTeamVisibility();
  const { filters, effectiveDates } = useReportFiltersContext();
  
  return useQuery({
    queryKey: ['dashboard-metrics', visibleUserIds, effectiveDates, filters.pipelines],
    queryFn: () => getDashboardMetrics(visibleUserIds),
    enabled: !visibilityLoading,
  });
}
