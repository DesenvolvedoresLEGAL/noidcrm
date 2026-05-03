// Hook for NRHS (NOID Revenue Hygiene Score)
// Sprint NRHS 1.5.1 — fonte oficial = edge function calculate-nrhs.
// Removido auto-cálculo client-side (que divergia da aba Revenue Hygiene).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invalidateOpportunity } from '@/lib/cache-invalidation';
import { nrhsKeys } from '@/lib/query-keys';
import { logWeeklyReview, NRHSTier, getNRHSTierConfig } from '@/services/crm/nrhs-calculator';

interface NRHSData {
  nrhs_score: number | null;
  nrhs_tier: NRHSTier | null;
  nrhs_breakdown: any | null;
  nrhs_metadata: any | null;
  nrhs_issues_count: number | null;
  nrhs_blockers: any[] | null;
  nrhs_gaps: any[] | null;
  nrhs_recommendations: any[] | null;
  nrhs_last_calculated_at: string | null;
}

export function useNRHS(opportunityId: string | undefined, organizationId?: string) {
  const queryClient = useQueryClient();

  const { data: nrhsData, isLoading } = useQuery({
    queryKey: nrhsKeys.full(opportunityId),
    queryFn: async (): Promise<NRHSData | null> => {
      if (!opportunityId) return null;
      const { data, error } = await supabase
        .from('opportunities')
        .select('nrhs_score, nrhs_tier, nrhs_breakdown, nrhs_metadata, nrhs_issues_count, nrhs_blockers, nrhs_gaps, nrhs_recommendations, nrhs_last_calculated_at')
        .eq('id', opportunityId)
        .single();
      if (error) {
        console.error('Error fetching NRHS:', error);
        return null;
      }
      return {
        nrhs_score: data.nrhs_score,
        nrhs_tier: data.nrhs_tier as NRHSTier | null,
        nrhs_breakdown: (data as any).nrhs_breakdown,
        nrhs_metadata: (data as any).nrhs_metadata,
        nrhs_issues_count: data.nrhs_issues_count,
        nrhs_blockers: Array.isArray((data as any).nrhs_blockers) ? (data as any).nrhs_blockers : [],
        nrhs_gaps: Array.isArray((data as any).nrhs_gaps) ? (data as any).nrhs_gaps : [],
        nrhs_recommendations: Array.isArray((data as any).nrhs_recommendations) ? (data as any).nrhs_recommendations : [],
        nrhs_last_calculated_at: data.nrhs_last_calculated_at,
      };
    },
    enabled: !!opportunityId,
    staleTime: 30000,
  });

  // Recalculate via OFFICIAL edge function (calculate-nrhs).
  const recalculateMutation = useMutation({
    mutationFn: async () => {
      if (!opportunityId) throw new Error('Opportunity ID required');
      const { data, error } = await supabase.functions.invoke('calculate-nrhs', {
        body: {
          opportunity_id: opportunityId,
          organization_id: organizationId,
          trigger_source: 'opportunity_detail',
          trigger_action: 'manual_recalculate',
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateOpportunity(queryClient, opportunityId);
      queryClient.invalidateQueries({ queryKey: ['nrhs'] });
      queryClient.invalidateQueries({ queryKey: ['nrhs-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-hygiene'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-deals'] });
      if (opportunityId) {
        queryClient.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
        queryClient.invalidateQueries({ queryKey: ['opportunity-detail', opportunityId] });
      }
    },
  });

  const markReviewMutation = useMutation({
    mutationFn: async (notes?: string): Promise<boolean> => {
      if (!opportunityId || !organizationId) throw new Error('IDs required');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      const success = await logWeeklyReview(opportunityId, user.id, organizationId, notes);
      if (success) await recalculateMutation.mutateAsync();
      return success;
    },
    onSuccess: () => {
      invalidateOpportunity(queryClient, opportunityId);
    },
  });

  const tierConfig = nrhsData?.nrhs_tier ? getNRHSTierConfig(nrhsData.nrhs_tier) : null;

  // Derive blocker codes (string[]) for legacy consumers expecting flat list.
  const blockerCodes: string[] = (nrhsData?.nrhs_blockers ?? []).map((b: any) =>
    typeof b === 'string' ? b : b?.code,
  ).filter(Boolean);

  return {
    score: nrhsData?.nrhs_score ?? null,
    tier: nrhsData?.nrhs_tier ?? null,
    tierConfig,
    breakdown: nrhsData?.nrhs_metadata ?? nrhsData?.nrhs_breakdown ?? null,
    metadata: nrhsData?.nrhs_metadata ?? null,
    issuesCount: nrhsData?.nrhs_issues_count ?? 0,
    blockers: blockerCodes,
    blockersDetailed: nrhsData?.nrhs_blockers ?? [],
    gaps: nrhsData?.nrhs_gaps ?? [],
    recommendations: nrhsData?.nrhs_recommendations ?? [],
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
      const blockers = (Array.isArray((data as any).nrhs_blockers) ? (data as any).nrhs_blockers : [])
        .map((b: any) => (typeof b === 'string' ? b : b?.code))
        .filter(Boolean);
      return {
        score: data.nrhs_score as number | null,
        tier: data.nrhs_tier as NRHSTier | null,
        issuesCount: data.nrhs_issues_count as number | null,
        blockers: blockers as string[],
      };
    },
    enabled: !!opportunityId,
    staleTime: 30000,
  });
}
