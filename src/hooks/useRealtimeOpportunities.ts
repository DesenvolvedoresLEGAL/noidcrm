import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { opportunityKeys, accountKeys, contactKeys } from '@/lib/query-keys';

/**
 * Subscribes to real-time changes on the opportunities table
 * and automatically invalidates the React Query cache so
 * the Kanban board (and any other consumer) stays up-to-date
 * without requiring a manual refresh.
 */
export function useRealtimeOpportunities() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // refetchType:'all' forces refetch even when the kanban list query is
    // currently inactive (e.g. user is on the opportunity detail page).
    // The global QueryClient sets refetchOnMount:false, so a plain
    // invalidation would only mark the cache stale and the kanban would
    // keep showing outdated cards (deleted/moved deals) until a hard
    // refresh. This guarantees real-time changes propagate immediately.
    const invalidate = (queryKey: readonly unknown[]) =>
      queryClient.invalidateQueries({ queryKey, refetchType: 'all' });

    const channel = supabase
      .channel('realtime-opportunities')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'opportunities' },
        () => {
          invalidate(opportunityKeys.lists());
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accounts' },
        () => {
          invalidate(opportunityKeys.lists());
          invalidate(accountKeys.lists());
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        () => {
          invalidate(opportunityKeys.lists());
          invalidate(contactKeys.lists());
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
