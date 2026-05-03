import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProposalAIInsightsResult {
  status?: 'ok' | 'stale' | 'insufficient_data' | 'error';
  from_cache?: boolean;
  error?: string;
  reason?: string;
  analyzed_at?: string;
  cached_signature?: string | null;
  current_signature?: string | null;
  summary?: string;
  engagement_level?: string;
  engagement?: { score?: number | null; level?: string };
  close_probability?: { value?: number | null; trend?: string };
  win_probability_delta?: number;
  best_contact_time?: string | null;
  insights?: any[];
  recommended_actions?: any[];
  smart_alerts?: any[];
  metrics?: any;
}

async function invokeAnalyze(proposalId: string, force_refresh: boolean): Promise<ProposalAIInsightsResult> {
  const { data, error } = await supabase.functions.invoke('analyze-proposal-behavior', {
    body: { proposal_id: proposalId, force_refresh },
  });
  if (error) throw error;
  return data as ProposalAIInsightsResult;
}

export function useProposalAIInsights(proposalId: string | null | undefined) {
  const qc = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const query = useQuery({
    queryKey: ['proposal-ai-insights', proposalId],
    queryFn: () => invokeAnalyze(proposalId!, false),
    enabled: !!proposalId,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const refresh = async (opts?: { force?: boolean }) => {
    if (!proposalId) return;
    setIsRefreshing(true);
    try {
      const data = await invokeAnalyze(proposalId, !!opts?.force);
      qc.setQueryData(['proposal-ai-insights', proposalId], data);
      return data;
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRefreshing,
    isFromCache: !!query.data?.from_cache,
    generatedAt: query.data?.analyzed_at,
    status: query.data?.status,
    error: query.error as Error | null,
    refresh,
  };
}
