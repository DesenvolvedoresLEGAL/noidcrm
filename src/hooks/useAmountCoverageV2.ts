/**
 * Sprint 2.2 — Hook de cobertura monetária canônica.
 *
 * Indica % de oportunidades com valor baseado em proposta real
 * vs. valor estimado vs. zero. Usado para Reliability Score futuro.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AmountCoverageV2 } from '@/types/reportsV2';

interface UseAmountCoverageV2Options {
  organizationId?: string | null;
  enabled?: boolean;
}

export function useAmountCoverageV2({
  organizationId,
  enabled = true,
}: UseAmountCoverageV2Options) {
  return useQuery({
    queryKey: ['opportunity-amount-coverage-v2', organizationId],
    enabled: Boolean(enabled && organizationId),
    staleTime: 60_000,
    queryFn: async (): Promise<AmountCoverageV2 | null> => {
      if (!organizationId) return null;

      const { data, error } = await supabase
        .from('v_opportunity_amount_coverage_v2' as any)
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return {
          organization_id: organizationId,
          total_opportunities: 0,
          using_accepted_proposal_net: 0,
          using_latest_proposal_net: 0,
          using_opportunity_fallback: 0,
          using_zero_fallback: 0,
          proposal_based_coverage_pct: 0,
        };
      }
      return data as unknown as AmountCoverageV2;
    },
  });
}
