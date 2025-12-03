import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface OpportunityScoring {
  opportunity_score: number | null;
  engagement_score: number | null;
  velocity_score: number | null;
  risk_score: number | null;
  win_probability_ai: number | null;
  score_updated_at: string | null;
}

export function useOpportunityScoring(opportunityId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: scoring, isLoading } = useQuery({
    queryKey: ['opportunity-scoring', opportunityId],
    queryFn: async () => {
      if (!opportunityId) return null;

      const { data, error } = await supabase
        .from('opportunities')
        .select('opportunity_score, engagement_score, velocity_score, risk_score, win_probability_ai, score_updated_at')
        .eq('id', opportunityId)
        .single();

      if (error) throw error;
      return data as OpportunityScoring;
    },
    enabled: !!opportunityId,
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
      queryClient.invalidateQueries({ queryKey: ['opportunity-scoring', opportunityId] });
    },
  });

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
    queryKey: ['opportunity-score-lite', opportunityId],
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
