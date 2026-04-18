/**
 * Sprint 2.2 — Hook canônico para valores monetários de oportunidades.
 *
 * Lê EXCLUSIVAMENTE da view v_opportunity_amounts_v2.
 * Nenhuma nova métrica V2 deve ler valor diretamente de opportunities/proposals.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OpportunityAmountV2, OpportunityAmountsV2Filters } from '@/types/reportsV2';

interface UseOpportunityAmountsV2Options {
  organizationId?: string | null;
  filters?: OpportunityAmountsV2Filters;
  enabled?: boolean;
}

export function useOpportunityAmountsV2({
  organizationId,
  filters,
  enabled = true,
}: UseOpportunityAmountsV2Options) {
  return useQuery({
    queryKey: ['opportunity-amounts-v2', organizationId, filters],
    enabled: Boolean(enabled && organizationId),
    staleTime: 60_000,
    queryFn: async (): Promise<OpportunityAmountV2[]> => {
      if (!organizationId) return [];

      let query = supabase
        .from('v_opportunity_amounts_v2' as any)
        .select('*')
        .eq('organization_id', organizationId);

      if (filters?.pipelineIds?.length) {
        query = query.in('pipeline_id', filters.pipelineIds);
      }
      if (filters?.ownerIds?.length) {
        query = query.in('owner_user_id', filters.ownerIds);
      }
      if (filters?.status?.length) {
        query = query.in('status', filters.status);
      }
      if (filters?.dateRange) {
        const field = filters.dateRange.field ?? 'created_at';
        query = query
          .gte(field, filters.dateRange.from)
          .lte(field, filters.dateRange.to);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as OpportunityAmountV2[];
    },
  });
}
