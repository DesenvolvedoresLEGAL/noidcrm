/**
 * Sprint 2.3 — Hook canônico de idade da etapa atual.
 *
 * Lê `v_opportunity_stage_age_v2`. Aceita filtro opcional por opportunityId.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { StageAgeV2 } from '@/types/historyV2';

interface UseOpportunityStageAgeV2Options {
  opportunityId?: string;
  enabled?: boolean;
}

export function useOpportunityStageAgeV2(options: UseOpportunityStageAgeV2Options = {}) {
  const { opportunityId, enabled = true } = options;

  return useQuery({
    queryKey: ['reports-v2', 'stage-age', opportunityId ?? 'all'],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<StageAgeV2[]> => {
      let q = supabase.from('v_opportunity_stage_age_v2' as never).select('*');
      if (opportunityId) q = q.eq('opportunity_id', opportunityId);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as StageAgeV2[]) ?? [];
    },
  });
}
