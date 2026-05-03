// Hook for NRHS Analytics - Revenue Hygiene Dashboard

import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { usePrivateQueryEnabled } from '@/hooks/usePrivateQueryEnabled';
import { NRHSTier } from '@/services/crm/nrhs-calculator';
import { nrhsAnalyticsKeys } from '@/lib/query-keys';
import {
  fetchNRHSAnalytics,
  calculateNRHSKPIs,
  calculateTierDistribution,
  calculatePillarAverages,
  calculateOwnerStats,
  generateNRHSInsights,
  generateNRHSCorrelations,
  NRHS_PILLARS,
  NRHSDeal,
  NRHSKPIs,
  NRHSTierDistribution,
  NRHSPillarAverage,
  NRHSOwnerStats,
  NRHSInsight,
  NRHSCorrelation,
} from '@/services/crm/nrhs-analytics';

export interface NRHSFilters {
  tier?: NRHSTier;
  ownerId?: string;
  stageId?: string;
  hasBlocker?: boolean;
  search?: string;
}

export interface NRHSAnalyticsData {
  deals: NRHSDeal[];
  kpis: NRHSKPIs;
  tierDistribution: NRHSTierDistribution[];
  pillarAverages: NRHSPillarAverage[];
  ownerStats: NRHSOwnerStats[];
  insights: NRHSInsight[];
  correlations: NRHSCorrelation[];
  isLoading: boolean;
  error: Error | null;
  filters: NRHSFilters;
  setFilters: (filters: NRHSFilters) => void;
  clearFilters: () => void;
  filteredDeals: NRHSDeal[];
}

export function useNRHSAnalytics(): NRHSAnalyticsData {
  const { isAdmin, isOwner } = useCurrentOrganization();
  // AUTH.1.3: gate único — só roda com sessão + user + organização.
  const { enabled, organizationId, userId } = usePrivateQueryEnabled();
  const [filters, setFilters] = useState<NRHSFilters>({});

  const isPrivileged = isAdmin || isOwner;

  // HOTFIX 1.4.2: usa RPC get_nrhs_analytics. Sem nested select no PostgREST.
  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: nrhsAnalyticsKeys.byUser(organizationId ?? undefined, userId ?? undefined, isPrivileged),
    queryFn: async () => {
      if (!organizationId) return null;
      return fetchNRHSAnalytics(organizationId, userId, isPrivileged);
    },
    enabled,
    staleTime: 30000,
  });

  const deals: NRHSDeal[] = data?.deals ?? [];

  // Apply client-side filters
  const filteredDeals = useMemo(() => {
    let result = [...deals];

    if (filters.tier) {
      result = result.filter(d => d.nrhsTier === filters.tier);
    }
    if (filters.ownerId) {
      result = result.filter(d => d.ownerUserId === filters.ownerId);
    }
    if (filters.stageId) {
      result = result.filter(d => d.stageId === filters.stageId);
    }
    if (filters.hasBlocker !== undefined) {
      if (filters.hasBlocker) {
        result = result.filter(d => d.nrhsBlockers.length > 0);
      } else {
        result = result.filter(d => d.nrhsBlockers.length === 0);
      }
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(d =>
        d.title.toLowerCase().includes(searchLower) ||
        d.accountName.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [deals, filters]);

  // Prefer server-side aggregates from the RPC; fall back to client-side calc.
  const kpis = useMemo(
    () => data?.summary ?? calculateNRHSKPIs(deals),
    [data?.summary, deals]
  );
  const tierDistribution = useMemo(
    () => data?.distribution ?? calculateTierDistribution(deals),
    [data?.distribution, deals]
  );
  const pillarAverages = useMemo<NRHSPillarAverage[]>(() => {
    if (data?.pillars) {
      return NRHS_PILLARS.map(p => {
        const avg = (data.pillars as any)?.[p.id] ?? 0;
        return {
          pillar: p.id,
          label: p.label,
          average: avg,
          weight: p.weight,
          hasAlert: avg < 60,
        };
      });
    }
    return calculatePillarAverages(deals);
  }, [data?.pillars, deals]);
  const ownerStats = useMemo(
    () => data?.owners ?? calculateOwnerStats(deals),
    [data?.owners, deals]
  );
  const insights = useMemo(() => generateNRHSInsights(deals), [deals]);
  const correlations = useMemo(() => generateNRHSCorrelations(deals), [deals]);

  const clearFilters = () => setFilters({});

  return {
    deals,
    kpis,
    tierDistribution,
    pillarAverages,
    ownerStats,
    insights,
    correlations,
    isLoading,
    error: error as Error | null,
    filters,
    setFilters,
    clearFilters,
    filteredDeals,
  };
}

// Lightweight hook for just KPIs
export function useNRHSKPIs() {
  const { isAdmin, isOwner } = useCurrentOrganization();
  const { enabled, organizationId, userId } = usePrivateQueryEnabled();

  const isPrivileged = isAdmin || isOwner;

  return useQuery({
    queryKey: nrhsAnalyticsKeys.kpis(organizationId ?? undefined, userId ?? undefined, isPrivileged),
    queryFn: async () => {
      if (!organizationId) return null;
      const payload = await fetchNRHSAnalytics(organizationId, userId, isPrivileged);
      return payload.summary ?? calculateNRHSKPIs(payload.deals);
    },
    enabled,
    staleTime: 30000,
  });
}
