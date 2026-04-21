// Hook for NRHS (NOID Revenue Hygiene Score)

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invalidateOpportunity } from '@/lib/cache-invalidation';
import { nrhsKeys } from '@/lib/query-keys';
import { 
  calculateNRHSClient, 
  saveNRHSResult, 
  logWeeklyReview,
  NRHSResult,
  NRHSTier,
  getNRHSTierConfig 
} from '@/services/crm/nrhs-calculator';

interface NRHSData {
  nrhs_score: number | null;
  nrhs_tier: NRHSTier | null;
  nrhs_breakdown: any | null;
  nrhs_issues_count: number | null;
  nrhs_blockers: string[] | null;
  nrhs_last_calculated_at: string | null;
}

export function useNRHS(opportunityId: string | undefined, organizationId?: string) {
  const queryClient = useQueryClient();
  const hasAutoCalculated = useRef(false);

  // Fetch existing NRHS data
  const { data: nrhsData, isLoading } = useQuery({
    queryKey: nrhsKeys.full(opportunityId),
    queryFn: async (): Promise<NRHSData | null> => {
      if (!opportunityId) return null;

      const { data, error } = await supabase
        .from('opportunities')
        .select('nrhs_score, nrhs_tier, nrhs_breakdown, nrhs_issues_count, nrhs_blockers, nrhs_last_calculated_at')
        .eq('id', opportunityId)
        .single();

      if (error) {
        console.error('Error fetching NRHS:', error);
        return null;
      }

      return {
        nrhs_score: data.nrhs_score,
        nrhs_tier: data.nrhs_tier as NRHSTier | null,
        nrhs_breakdown: data.nrhs_breakdown,
        nrhs_issues_count: data.nrhs_issues_count,
        nrhs_blockers: data.nrhs_blockers as string[] | null,
        nrhs_last_calculated_at: data.nrhs_last_calculated_at
      };
    },
    enabled: !!opportunityId,
    staleTime: 30000, // 30 seconds
  });

  // Recalculate mutation
  const recalculateMutation = useMutation({
    mutationFn: async (): Promise<NRHSResult | null> => {
      if (!opportunityId) throw new Error('Opportunity ID required');
      
      const result = await calculateNRHSClient(opportunityId);
      
      if (result && organizationId) {
        const { data: { user } } = await supabase.auth.getUser();
        await saveNRHSResult(opportunityId, result, organizationId, user?.id);
      }
      
      return result;
    },
    onSuccess: () => {
      // Invalidate ALL caches that depend on this opportunity (NRHS lite,
      // sidebar QuickIndicators, kanban badge, scoring sub-factors).
      invalidateOpportunity(queryClient, opportunityId);
    },
  });

  // Mark weekly review mutation
  const markReviewMutation = useMutation({
    mutationFn: async (notes?: string): Promise<boolean> => {
      if (!opportunityId || !organizationId) throw new Error('IDs required');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const success = await logWeeklyReview(opportunityId, user.id, organizationId, notes);
      
      // Recalculate after marking review
      if (success) {
        await recalculateMutation.mutateAsync();
      }
      
      return success;
    },
    onSuccess: () => {
      invalidateOpportunity(queryClient, opportunityId);
    },
  });

  // Auto-calculate if never calculated
  useEffect(() => {
    if (
      opportunityId &&
      organizationId &&
      nrhsData !== undefined &&
      !isLoading &&
      !hasAutoCalculated.current &&
      !recalculateMutation.isPending &&
      nrhsData?.nrhs_score === null
    ) {
      hasAutoCalculated.current = true;
      console.log('Auto-calculating NRHS for opportunity:', opportunityId);
      recalculateMutation.mutate();
    }
  }, [opportunityId, organizationId, nrhsData, isLoading, recalculateMutation]);

  // Get tier config
  const tierConfig = nrhsData?.nrhs_tier ? getNRHSTierConfig(nrhsData.nrhs_tier) : null;

  return {
    score: nrhsData?.nrhs_score ?? null,
    tier: nrhsData?.nrhs_tier ?? null,
    tierConfig,
    breakdown: nrhsData?.nrhs_breakdown ?? null,
    issuesCount: nrhsData?.nrhs_issues_count ?? 0,
    blockers: nrhsData?.nrhs_blockers ?? [],
    lastCalculatedAt: nrhsData?.nrhs_last_calculated_at ?? null,
    isLoading,
    recalculate: recalculateMutation.mutate,
    isRecalculating: recalculateMutation.isPending,
    markReview: markReviewMutation.mutate,
    isMarkingReview: markReviewMutation.isPending,
  };
}

// Lightweight hook for just fetching score (for cards)
export function useNRHSScore(opportunityId: string | undefined) {
  return useQuery({
    queryKey: nrhsKeys.lite(opportunityId),
    queryFn: async () => {
      if (!opportunityId) return null;

      const { data, error } = await supabase
        .from('opportunities')
        .select('nrhs_score, nrhs_tier, nrhs_issues_count, nrhs_blockers')
        .eq('id', opportunityId)
        .single();

      if (error) return null;
      
      return {
        score: data.nrhs_score as number | null,
        tier: data.nrhs_tier as NRHSTier | null,
        issuesCount: data.nrhs_issues_count as number | null,
        blockers: (data.nrhs_blockers as string[] | null) || []
      };
    },
    enabled: !!opportunityId,
    staleTime: 30000,
  });
}
