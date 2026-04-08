import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
          queryClient.invalidateQueries({ queryKey: ['opportunities'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accounts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['opportunities'] });
          queryClient.invalidateQueries({ queryKey: ['accounts'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['opportunities'] });
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
