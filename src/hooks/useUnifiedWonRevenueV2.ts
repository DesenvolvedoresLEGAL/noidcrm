/**
 * Sprint 2.10 — Hook unificado de receita ganha.
 *
 * Lê v_unified_won_revenue_v2 (fonte única consumida tanto pelo CEO Dashboard
 * quanto pelos Relatórios V2). Garante que ambos módulos mostrem o mesmo número.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UnifiedWonRevenue {
  organization_id: string;
  won_count: number;
  won_revenue: number;
  won_revenue_via_accepted_proposal: number;
  won_revenue_via_latest_proposal: number;
  won_revenue_via_opportunity_fallback: number;
  won_count_via_accepted_proposal: number;
  won_count_via_latest_proposal: number;
  won_count_via_opportunity_fallback: number;
  won_count_via_zero_fallback: number;
}

export function useUnifiedWonRevenueV2(organizationId?: string | null) {
  return useQuery({
    queryKey: ['unified-won-revenue-v2', organizationId],
    enabled: Boolean(organizationId),
    staleTime: 30_000,
    queryFn: async (): Promise<UnifiedWonRevenue | null> => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from('v_unified_won_revenue_v2' as any)
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as UnifiedWonRevenue) ?? null;
    },
  });
}
