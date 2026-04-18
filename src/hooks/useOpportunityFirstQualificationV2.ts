/**
 * Sprint 2.3 — Hook canônico de primeira qualificação por oportunidade.
 *
 * Lê `v_opportunity_first_qualification_v2`.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FirstQualificationV2 } from '@/types/historyV2';

interface UseOpportunityFirstQualificationV2Options {
  opportunityId?: string;
  enabled?: boolean;
}

export function useOpportunityFirstQualificationV2(
  options: UseOpportunityFirstQualificationV2Options = {},
) {
  const { opportunityId, enabled = true } = options;

  return useQuery({
    queryKey: ['reports-v2', 'first-qualification', opportunityId ?? 'all'],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<FirstQualificationV2[]> => {
      let q = supabase.from('v_opportunity_first_qualification_v2' as never).select('*');
      if (opportunityId) q = q.eq('opportunity_id', opportunityId);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as FirstQualificationV2[]) ?? [];
    },
  });
}
