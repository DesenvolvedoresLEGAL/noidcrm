import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AccountScoring {
  lead_score: number | null;
  fit_score: number | null;
  intent_score: number | null;
  lead_grade: string | null;
  score_updated_at: string | null;
}

export function useAccountScoring(accountId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: scoring, isLoading } = useQuery({
    queryKey: ['account-scoring', accountId],
    queryFn: async () => {
      if (!accountId) return null;

      const { data, error } = await supabase
        .from('accounts')
        .select('lead_score, fit_score, intent_score, lead_grade, score_updated_at')
        .eq('id', accountId)
        .single();

      if (error) throw error;
      return data as AccountScoring;
    },
    enabled: !!accountId,
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      if (!accountId) throw new Error('Account ID required');
      
      const { data, error } = await supabase.functions.invoke('calculate-account-scores', {
        body: { accountId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-scoring', accountId] });
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
export function useAccountScore(accountId: string | undefined) {
  return useQuery({
    queryKey: ['account-score-lite', accountId],
    queryFn: async () => {
      if (!accountId) return null;

      const { data, error } = await supabase
        .from('accounts')
        .select('lead_score, fit_score, intent_score, lead_grade')
        .eq('id', accountId)
        .single();

      if (error) return null;
      return data;
    },
    enabled: !!accountId,
    staleTime: 30000, // Cache for 30 seconds
  });
}
