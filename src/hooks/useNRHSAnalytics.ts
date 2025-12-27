// Hook for NRHS Analytics - Revenue Hygiene Dashboard

import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { usePermissions } from '@/hooks/usePermissions';
import { NRHSTier } from '@/services/crm/nrhs-calculator';
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
  const { organization, isAdmin, isOwner } = useCurrentOrganization();
  const [filters, setFilters] = useState<NRHSFilters>({});

  // Fetch current user
  const { data: userData } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
    staleTime: 60000,
  });

  const isPrivileged = isAdmin || isOwner;

  // Fetch all deals with NRHS data
  const {
    data: deals = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['nrhs-analytics', organization?.id, userData?.id, isPrivileged],
    queryFn: async () => {
      if (!organization?.id) return [];
      return fetchNRHSDeals(
        organization.id,
        userData?.id || null,
        isPrivileged
      );
    },
    enabled: !!organization?.id,
    staleTime: 30000, // 30 seconds cache
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
  const { organization, isAdmin, isOwner } = useCurrentOrganization();

  const { data: userData } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
    staleTime: 60000,
  });

  const isPrivileged = isAdmin || isOwner;

  return useQuery({
    queryKey: ['nrhs-kpis', organization?.id, userData?.id, isPrivileged],
    queryFn: async () => {
      if (!organization?.id) return null;
      const deals = await fetchNRHSDeals(
        organization.id,
        userData?.id || null,
        isPrivileged
      );
      return calculateNRHSKPIs(deals);
    },
    enabled: !!organization?.id,
    staleTime: 30000,
  });
}
