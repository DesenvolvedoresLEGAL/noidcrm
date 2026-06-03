import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVisibilityAwareInterval } from '@/lib/visibilityPolling';

/**
 * Returns the REAL count of prospects persisted for a given playbook_run_id.
 * This is more reliable than reading the cached `stats.persisted_prospects` field,
 * which may be stale if the run was interrupted mid-batch.
 *
 * SPRINT PERF 0.6B:
 *  - Polling interval raised from 5s → 15s for live runs.
 *  - Polling pauses when the tab is hidden (document.hidden=true) and
 *    refetches immediately on visibilitychange→visible.
 */
export function useRunProspectCount(runId: string | null | undefined, isLive: boolean = false) {
  const queryClient = useQueryClient();
  const queryKey = ['run-prospect-count', runId];

  const interval = useVisibilityAwareInterval(15_000, {
    enabled: isLive,
    onVisible: () => {
      if (runId) queryClient.invalidateQueries({ queryKey });
    },
  });

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!runId) return 0;
      const { count, error } = await supabase
        .from('prospects')
        .select('id', { count: 'exact', head: true })
        .eq('playbook_run_id', runId);
      if (error) {
        console.warn('[useRunProspectCount] error', error);
        return 0;
      }
      return count ?? 0;
    },
    enabled: !!runId,
    refetchInterval: interval,
    staleTime: isLive ? 0 : 30_000,
  });
}

/**
 * Force a stuck run to a terminal state. Useful when the watchdog hasn't
 * triggered yet but the user wants to unblock the UI immediately.
 */
export function useForceCompleteRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runId: string) => {
      // Fetch current real count to record it as the final value
      const { count } = await supabase
        .from('prospects')
        .select('id', { count: 'exact', head: true })
        .eq('playbook_run_id', runId);

      const { data: run } = await supabase
        .from('playbook_runs')
        .select('stats')
        .eq('id', runId)
        .maybeSingle();

      const mergedStats = {
        ...(run?.stats as Record<string, unknown> | null ?? {}),
        persisted_prospects: count ?? 0,
        prospects_created: count ?? 0,
        prospects_count: count ?? 0,
      };

      const { error } = await supabase
        .from('playbook_runs')
        .update({
          status: count && count > 0 ? 'completed' : 'failed',
          finished_at: new Date().toISOString(),
          stats: mergedStats,
          error_summary: count && count > 0
            ? null
            : 'Forçado pelo usuário: nenhum prospect persistido.',
        })
        .eq('id', runId);

      if (error) throw error;
      return count ?? 0;
    },
    onSuccess: (count) => {
      toast.success(`Execução finalizada com ${count} prospects.`);
      queryClient.invalidateQueries({ queryKey: ['playbook-runs'] });
      queryClient.invalidateQueries({ queryKey: ['run-prospect-count'] });
      queryClient.invalidateQueries({ queryKey: ['lead-searches'] });
    },
    onError: (error: any) => {
      toast.error(`Falha ao forçar conclusão: ${error?.message || 'erro desconhecido'}`);
    },
  });
}
