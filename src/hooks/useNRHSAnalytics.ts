// Hook for NRHS Analytics - Revenue Hygiene Dashboard

import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { usePrivateQueryEnabled } from '@/hooks/usePrivateQueryEnabled';
import { NRHSTier } from '@/services/crm/nrhs-calculator';
import { nrhsAnalyticsKeys } from '@/lib/query-keys';
import {
  fetchNRHSDeals,
  calculateNRHSKPIs,
  calculateTierDistribution,
  calculatePillarAverages,
  calculateOwnerStats,
  generateNRHSInsights,
  generateNRHSCorrelations,
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

  // Fetch all deals with NRHS data
  const {
    data: deals = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: nrhsAnalyticsKeys.byUser(organizationId ?? undefined, userId ?? undefined, isPrivileged),
    queryFn: async () => {
      if (!organizationId) return [];
      return fetchNRHSDeals(organizationId, userId, isPrivileged);
    },
    enabled,
    staleTime: 30000,
  });

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

  // Calculate all analytics from deals
  const kpis = useMemo(() => calculateNRHSKPIs(deals), [deals]);
  const tierDistribution = useMemo(() => calculateTierDistribution(deals), [deals]);
  const pillarAverages = useMemo(() => calculatePillarAverages(deals), [deals]);
  const ownerStats = useMemo(() => calculateOwnerStats(deals), [deals]);
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
      const deals = await fetchNRHSDeals(organizationId, userId, isPrivileged);
      return calculateNRHSKPIs(deals);
    },
    enabled,
    staleTime: 30000,
  });
}
