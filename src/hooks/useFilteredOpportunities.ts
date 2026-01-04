import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeamVisibility } from './useTeamVisibility';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';

export interface FilteredOpportunity {
  id: string;
  title: string;
  status: string | null;
  valor_previsto: number | null;
  prob: number | null;
  created_at: string | null;
  updated_at: string | null;
  close_date_prevista: string | null;
  owner_user_id: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  loss_reason_id: string | null;
  origem: string | null;
  qualified_by_user_id: string | null;
  temperature: string | null;
}

export interface FilteredOpportunitiesResult {
  opportunities: FilteredOpportunity[];
  pipelines: { id: string; name: string; pipeline_type: string | null }[];
  stages: { id: string; name: string; pipeline_id: string; order_index: number }[];
  lossReasons: { id: string; name: string }[];
  users: { id: string; full_name: string | null }[];
}

/**
 * Hook centralizado que busca oportunidades filtradas pelos filtros do contexto.
 * É a "única fonte de verdade" para todos os relatórios.
 */
export function useFilteredOpportunities() {
  const { visibleUserIds, canViewAll, loading: visibilityLoading } = useTeamVisibility();
  const { filters, effectiveDates } = useReportFiltersContext();

  return useQuery({
    queryKey: [
      'filtered-opportunities',
      visibleUserIds,
      effectiveDates.startDate,
      effectiveDates.endDate,
      filters.pipelines,
      filters.users,
    ],
    queryFn: async (): Promise<FilteredOpportunitiesResult> => {
      // Query de oportunidades com filtros
      let opportunitiesQuery = supabase
        .from('opportunities')
        .select(`
          id, title, status, valor_previsto, prob,
          created_at, updated_at, close_date_prevista,
          owner_user_id, pipeline_id, stage_id, loss_reason_id,
          origem, qualified_by_user_id, temperature
        `)
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

      // Buscar dados em paralelo
      const [
        opportunitiesResult,
        pipelinesResult,
        stagesResult,
        lossReasonsResult,
        usersResult,
      ] = await Promise.all([
        opportunitiesQuery,
        supabase.from('pipelines').select('id, name, pipeline_type'),
        supabase.from('stages').select('id, name, pipeline_id, order_index').order('order_index'),
        supabase.from('loss_reasons').select('id, name'),
        supabase.from('profiles').select('id, full_name'),
      ]);

      if (opportunitiesResult.error) throw opportunitiesResult.error;
      if (pipelinesResult.error) throw pipelinesResult.error;
      if (stagesResult.error) throw stagesResult.error;
      if (lossReasonsResult.error) throw lossReasonsResult.error;
      if (usersResult.error) throw usersResult.error;

      return {
        opportunities: opportunitiesResult.data || [],
        pipelines: pipelinesResult.data || [],
        stages: stagesResult.data || [],
        lossReasons: lossReasonsResult.data || [],
        users: usersResult.data || [],
      };
    },
    enabled: !visibilityLoading,
    staleTime: 30 * 1000, // 30 segundos
  });
}

/**
 * Hook que busca oportunidades filtradas com base em updated_at (para won/lost)
 * útil para relatórios de oportunidades processadas
 */
export function useFilteredProcessedOpportunities() {
  const { visibleUserIds, canViewAll, loading: visibilityLoading } = useTeamVisibility();
  const { filters, effectiveDates } = useReportFiltersContext();

  return useQuery({
    queryKey: [
      'filtered-processed-opportunities',
      visibleUserIds,
      effectiveDates.startDate,
      effectiveDates.endDate,
      filters.pipelines,
      filters.users,
    ],
    queryFn: async (): Promise<FilteredOpportunity[]> => {
      // Query de oportunidades won/lost filtradas por updated_at
      let query = supabase
        .from('opportunities')
        .select(`
          id, title, status, valor_previsto, prob,
          created_at, updated_at, close_date_prevista,
          owner_user_id, pipeline_id, stage_id, loss_reason_id,
          origem, qualified_by_user_id, temperature
        `)
        .in('status', ['won', 'lost'])
        .gte('updated_at', effectiveDates.startDate)
        .lte('updated_at', effectiveDates.endDate + 'T23:59:59');

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

      return data || [];
    },
    enabled: !visibilityLoading,
    staleTime: 30 * 1000,
  });
}
