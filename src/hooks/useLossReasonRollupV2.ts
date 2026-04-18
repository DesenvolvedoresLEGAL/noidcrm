/**
 * Sprint 2.4 — Hook canônico de ranking de motivos de perda.
 *
 * Lê EXCLUSIVAMENTE de v_loss_reason_rollup_v2.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LossReasonRollupV2 } from '@/types/lossV2';

interface UseLossReasonRollupV2Options {
  organizationId?: string | null;
  enabled?: boolean;
}

export function useLossReasonRollupV2({
  organizationId,
  enabled = true,
}: UseLossReasonRollupV2Options) {
  return useQuery({
    queryKey: ['loss-reason-rollup-v2', organizationId],
    enabled: Boolean(enabled && organizationId),
    staleTime: 60_000,
    queryFn: async (): Promise<LossReasonRollupV2[]> => {
      if (!organizationId) return [];

      const { data, error } = await (supabase as any)
        .from('v_loss_reason_rollup_v2')
        .select('*')
        .eq('organization_id', organizationId)
        .order('lost_count', { ascending: false });

      if (error) throw error;
      return (data ?? []) as LossReasonRollupV2[];
    },
  });
}
