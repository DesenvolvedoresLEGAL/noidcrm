import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invalidateOpportunity } from '@/lib/cache-invalidation';
import { opportunityScoringKeys } from '@/lib/query-keys';

interface OpportunityScoring {
  opportunity_score: number | null;
  engagement_score: number | null;
  velocity_score: number | null;
  risk_score: number | null;
  win_probability_ai: number | null;
  score_updated_at: string | null;
  scoring_factors: Record<string, any> | null;
}

export function useOpportunityScoring(opportunityId: string | undefined) {
  const queryClient = useQueryClient();
  const hasAutoCalculated = useRef(false);

  const { data: scoring, isLoading } = useQuery({
    queryKey: opportunityScoringKeys.full(opportunityId),
    queryFn: async () => {
      if (!opportunityId) return null;

      const { data, error } = await supabase
        .from('opportunities')
        .select('opportunity_score, engagement_score, velocity_score, risk_score, win_probability_ai, score_updated_at, scoring_factors')
        .eq('id', opportunityId)
        .single();

      if (error) throw error;
      return data as OpportunityScoring;
    },
    enabled: !!opportunityId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      if (!opportunityId) throw new Error('Opportunity ID required');
      
      // Calculate opportunity scores
      const { error: scoreError } = await supabase.functions.invoke('calculate-opportunity-scores', {
        body: { opportunityId },
      });
      if (scoreError) throw scoreError;

      // Calculate AI win probability
      const { error: aiError } = await supabase.functions.invoke('ml-win-probability', {
        body: { opportunityId },
      });
      if (aiError) console.warn('AI win probability failed:', aiError);

      return true;
    },
    onSuccess: () => {
      // Invalidate ALL caches that depend on this opportunity's score
      // (sidebar header, QuickIndicators, kanban badges, dashboards, NRHS).
      invalidateOpportunity(queryClient, opportunityId);
    },
  });

  // Auto-calculate scores if never calculated (score_updated_at is null)
  useEffect(() => {
    if (
      opportunityId &&
      scoring &&
      !isLoading &&
      !hasAutoCalculated.current &&
      !recalculateMutation.isPending &&
      scoring.score_updated_at === null
    ) {
      hasAutoCalculated.current = true;
      console.log('Auto-calculating scores for opportunity:', opportunityId);
      recalculateMutation.mutate();
    }
  }, [opportunityId, scoring, isLoading, recalculateMutation]);

  return {
    scoring,
    isLoading,
    recalculate: recalculateMutation.mutate,
    isRecalculating: recalculateMutation.isPending,
  };
}

// Lightweight hook for just fetching score data (no mutation capabilities)
export function useOpportunityScore(opportunityId: string | undefined) {
  return useQuery({
    queryKey: opportunityScoringKeys.lite(opportunityId),
    queryFn: async () => {
      if (!opportunityId) return null;

      const { data, error } = await supabase
        .from('opportunities')
        .select('opportunity_score, engagement_score, velocity_score, risk_score, win_probability_ai')
        .eq('id', opportunityId)
        .single();

      if (error) return null;
      return data;
    },
    enabled: !!opportunityId,
    staleTime: 30000, // Cache for 30 seconds
  });
}
