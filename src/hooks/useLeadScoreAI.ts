import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LeadScoreAIAnalysis {
  id: string;
  account_id: string;
  ai_score: number;
  ai_grade: 'A' | 'B' | 'C' | 'D' | 'F';
  conversion_probability: number | null;
  fit_justification: string | null;
  intent_justification: string | null;
  positive_signals: string[];
  risk_signals: string[];
  next_best_action: string | null;
  recommended_owner_role: string | null;
  model_used: string;
  triggered_by: string | null;
  created_at: string;
  expires_at: string;
}

/**
 * Fetch cached AI lead-score analysis for one account.
 * Returns null if no analysis exists yet (use the mutation to generate one).
 */
export function useLeadScoreAI(accountId: string | undefined) {
  return useQuery<LeadScoreAIAnalysis | null>({
    queryKey: ['lead-score-ai', accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const { data, error } = await supabase
        .from('lead_score_ai_analysis')
        .select('*')
        .eq('account_id', accountId)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as LeadScoreAIAnalysis) || null;
    },
    enabled: !!accountId,
    staleTime: 60_000,
  });
}

/** Trigger an on-demand AI analysis for a single account. */
export function useGenerateLeadScoreAI() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ accountId, forceRefresh = false }: { accountId: string; forceRefresh?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('ai-lead-score-analyze', {
        body: { accountId, triggeredBy: 'manual', forceRefresh },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['lead-score-ai', vars.accountId] });
      toast.success('Análise de IA atualizada');
    },
    onError: (e: any) => toast.error('Falha na análise de IA', { description: e?.message }),
  });
}
