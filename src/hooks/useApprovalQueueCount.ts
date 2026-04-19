import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useApprovalQueueCount() {
  const { profile } = useCurrentUser();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['approval-queue-count', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('ai_agent_approval_queue')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId!)
        .eq('status', 'pending');
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 60_000,
  });

  // Realtime updates
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`approval-queue-${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_agent_approval_queue', filter: `organization_id=eq.${orgId}` },
        () => queryClient.invalidateQueries({ queryKey: ['approval-queue-count', orgId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, queryClient]);

  return query;
}
