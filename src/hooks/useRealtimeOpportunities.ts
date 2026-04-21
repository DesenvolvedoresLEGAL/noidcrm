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
    const channel = supabase
      .channel('realtime-opportunities')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'opportunities' },
        () => {
          queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accounts' },
        () => {
          queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
          queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        () => {
          queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
          queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
