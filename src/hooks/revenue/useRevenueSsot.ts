/**
 * P0 Revenue SSoT — React Query wrappers.
 * Use estes hooks em qualquer superfície de receita realizada (closed revenue).
 *
 * Nunca somar `valor_previsto`, `proposals.total_amount`, `v_opportunity_amounts_v2`
 * ou RPCs antigas para exibir receita ganha.
 */
import { useQuery } from '@tanstack/react-query';
import {
  revenueSsotService,
  type RevenueSsotParams,
  type ClosedRevenueSummary,
  type RevenueGroup,
} from '@/services/revenue/revenueSsotService';

const SURFACE_PREFIX = 'revenue-ssot';

export function useClosedRevenueSummary(params: Partial<RevenueSsotParams> & { surface: string }) {
  const enabled = Boolean(params.organizationId && params.start && params.end);
  return useQuery<ClosedRevenueSummary | null>({
    queryKey: [
      SURFACE_PREFIX,
      'summary',
      params.surface,
      params.organizationId,
      params.start,
      params.end,
      params.pipelineIds ?? null,
      params.sellerIds ?? null,
      params.revenueType ?? 'all',
    ],
    enabled,
    staleTime: 30_000,
    queryFn: () =>
      revenueSsotService.getClosedRevenueSummary(params as RevenueSsotParams),
  });
}

export function useOfficialEligibleRevenueSummary(params: Partial<RevenueSsotParams> & { surface: string }) {
  const enabled = Boolean(params.organizationId && params.start && params.end);
  return useQuery<ClosedRevenueSummary | null>({
    queryKey: [SURFACE_PREFIX, 'official-eligible-summary', params.surface, params.organizationId, params.start, params.end, params.pipelineIds ?? null],
    enabled,
    staleTime: 30_000,
    queryFn: () => revenueSsotService.getOfficialEligibleRevenueSummary(params as RevenueSsotParams),
  });
}

export function useRevenueBySeller(params: Partial<RevenueSsotParams> & { surface: string }) {
  const enabled = Boolean(params.organizationId && params.start && params.end);
  return useQuery<RevenueGroup[]>({
    queryKey: [
      SURFACE_PREFIX,
      'by-seller',
      params.surface,
      params.organizationId,
      params.start,
      params.end,
      params.pipelineIds ?? null,
    ],
    enabled,
    staleTime: 30_000,
    queryFn: () => revenueSsotService.getRevenueBySeller(params as RevenueSsotParams),
  });
}

/**
 * Atribuição histórica imutável: usa a view `commercial_won_revenue_historical_view`,
 * que resolve `seller_id` no momento do ganho (via opportunity_owner_history).
 * Necessário para Resultados/OTE/Comissão — não usar `useRevenueBySeller` nesses
 * contextos pois ela reflete o dono atual.
 */
export function useHistoricalRevenueBySeller(params: Partial<RevenueSsotParams> & { surface: string }) {
  const enabled = Boolean(params.organizationId && params.start && params.end);
  return useQuery<RevenueGroup[]>({
    queryKey: [
      SURFACE_PREFIX,
      'historical-by-seller',
      params.surface,
      params.organizationId,
      params.start,
      params.end,
      params.pipelineIds ?? null,
    ],
    enabled,
    staleTime: 30_000,
    queryFn: () => revenueSsotService.getHistoricalRevenueBySeller(params as RevenueSsotParams),
  });
}

export function useOfficialHistoricalRevenueBySeller(params: Partial<RevenueSsotParams> & { surface: string }) {
  const enabled = Boolean(params.organizationId && params.start && params.end);
  return useQuery<RevenueGroup[]>({
    queryKey: [SURFACE_PREFIX, 'official-historical-by-seller', params.surface, params.organizationId, params.start, params.end, params.pipelineIds ?? null],
    enabled,
    staleTime: 30_000,
    queryFn: () => revenueSsotService.getOfficialHistoricalRevenueBySeller(params as RevenueSsotParams),
  });
}


export function useRevenueByStage(params: Partial<RevenueSsotParams> & { surface: string }) {
  const enabled = Boolean(params.organizationId && params.start && params.end);
  return useQuery<RevenueGroup[]>({
    queryKey: [
      SURFACE_PREFIX,
      'by-stage',
      params.surface,
      params.organizationId,
      params.start,
      params.end,
      params.pipelineIds ?? null,
    ],
    enabled,
    staleTime: 30_000,
    queryFn: () => revenueSsotService.getRevenueByStage(params as RevenueSsotParams),
  });
}

export function useRevenueByPipeline(params: Partial<RevenueSsotParams> & { surface: string }) {
  const enabled = Boolean(params.organizationId && params.start && params.end);
  return useQuery<RevenueGroup[]>({
    queryKey: [
      SURFACE_PREFIX,
      'by-pipeline',
      params.surface,
      params.organizationId,
      params.start,
      params.end,
    ],
    enabled,
    staleTime: 30_000,
    queryFn: () => revenueSsotService.getRevenueByPipeline(params as RevenueSsotParams),
  });
}
