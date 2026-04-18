/**
 * Sprint 2.4 — Hook canônico de cobertura de classificação de perdas.
 *
 * Lê EXCLUSIVAMENTE de v_loss_classification_coverage_v2.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LossCoverageV2 } from '@/types/lossV2';

interface UseLossClassificationCoverageV2Options {
  organizationId?: string | null;
  enabled?: boolean;
}

export function useLossClassificationCoverageV2({
  organizationId,
  enabled = true,
}: UseLossClassificationCoverageV2Options) {
  return useQuery({
    queryKey: ['loss-classification-coverage-v2', organizationId],
    enabled: Boolean(enabled && organizationId),
    staleTime: 60_000,
    queryFn: async (): Promise<LossCoverageV2 | null> => {
      if (!organizationId) return null;

      const { data, error } = await (supabase as any)
        .from('v_loss_classification_coverage_v2')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as LossCoverageV2 | null;
    },
  });
}
