/**
 * Sprint 2.10/2.11 — Hook unificado de receita ganha.
 *
 * - Sprint 2.10: lê v_unified_won_revenue_v2 (all-time, sem filtro de período).
 * - Sprint 2.11: variante com período via RPC get_unified_won_revenue_v2(org, start, end).
 *
 * Fonte única consumida tanto pelo CEO Dashboard quanto pelos Relatórios V2.
 * Garante que ambos módulos mostrem exatamente o mesmo número.
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
  /** Sprint 2.11 — soma de mrr_value das won no período (apenas em modo período). */
  mrr_value?: number;
  /** Sprint 2.11 — net_revenue_final − (mrr_value*12) das won no período. */
  one_time_value?: number;
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

/**
 * Sprint 2.11 — Variante por período. Usada pelo CEO Dashboard (mês atual)
 * e por qualquer card que precise de receita ganha em janela arbitrária.
 *
 * @param organizationId Organização ativa.
 * @param start ISO timestamp inclusive (ou null para início indefinido).
 * @param end   ISO timestamp inclusive (ou null para fim indefinido).
 */
export function useUnifiedWonRevenueByPeriodV2(
  organizationId?: string | null,
  start?: string | null,
  end?: string | null,
) {
  return useQuery({
    queryKey: ['unified-won-revenue-period-v2', organizationId, start ?? null, end ?? null],
    enabled: Boolean(organizationId),
    staleTime: 30_000,
    queryFn: async (): Promise<UnifiedWonRevenue | null> => {
      if (!organizationId) return null;
      const { data, error } = await (supabase as any).rpc('get_unified_won_revenue_v2', {
        p_organization_id: organizationId,
        p_start: start ?? null,
        p_end: end ?? null,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as UnifiedWonRevenue) ?? null;
    },
  });
}
