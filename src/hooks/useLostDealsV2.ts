/**
 * Sprint 2.4 — Hook canônico de oportunidades perdidas (com valores monetários).
 *
 * Lê EXCLUSIVAMENTE de v_lost_deals_amounts_v2 (já integra Sprint 2.2).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LostDealAmountV2, LostDealsV2Filters } from '@/types/lossV2';

interface UseLostDealsV2Options {
  organizationId?: string | null;
  filters?: LostDealsV2Filters;
  enabled?: boolean;
}

export function useLostDealsV2({
  organizationId,
  filters,
  enabled = true,
}: UseLostDealsV2Options) {
  return useQuery({
    queryKey: ['lost-deals-v2', organizationId, filters],
    enabled: Boolean(enabled && organizationId),
    staleTime: 60_000,
    queryFn: async (): Promise<LostDealAmountV2[]> => {
      if (!organizationId) return [];

      let query = (supabase as any)
        .from('v_lost_deals_amounts_v2')
        .select('*')
        .eq('organization_id', organizationId);

      if (filters?.pipelineIds?.length) {
        query = query.in('pipeline_id', filters.pipelineIds);
      }
      if (filters?.ownerIds?.length) {
        query = query.in('owner_user_id', filters.ownerIds);
      }
      if (filters?.dateRange) {
        const field = filters.dateRange.field ?? 'lost_at';
        query = query
          .gte(field, filters.dateRange.from)
          .lte(field, filters.dateRange.to);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as LostDealAmountV2[];
    },
  });
}
