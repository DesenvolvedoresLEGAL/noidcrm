import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { opportunityKeys, accountKeys, contactKeys } from '@/lib/query-keys';

/**
 * Subscribes to real-time changes on the opportunities/accounts/contacts
 * tables and invalidates the React Query cache so the Kanban board stays
 * up-to-date.
 *
 * SPRINT PERF 0.6B:
 *  - Removed `refetchType:'all'`: rely on default `active` so we only
 *    refetch queries that are currently observed. Inactive queries stay
 *    marked stale and refetch lazily on next mount (Kanban remount = ok).
 *  - Added 500ms debounce so a burst of postgres_changes events triggers
 *    a single invalidation instead of one per row.
 *  - Kanban grouping, drag&drop and moveOpportunity remain untouched.
 */
export function useRealtimeOpportunities() {
  const queryClient = useQueryClient();
  const pending = useRef<{ opps: boolean; accounts: boolean; contacts: boolean; timer: number | null }>({
    opps: false,
    accounts: false,
    contacts: false,
    timer: null,
  });

  useEffect(() => {
    const flush = () => {
      const p = pending.current;
      if (p.opps) {
        queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
      }
      if (p.accounts) {
        queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      }
      if (p.contacts) {
        queryClient.invalidateQueries({ queryKey: contactKeys.lists() });
      }
      p.opps = p.accounts = p.contacts = false;
      p.timer = null;
    };

    const schedule = () => {
      if (pending.current.timer != null) return;
      pending.current.timer = window.setTimeout(flush, 500);
    };

    const channel = supabase
      .channel('realtime-opportunities')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'opportunities' },
        () => {
          pending.current.opps = true;
          schedule();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accounts' },
        () => {
          pending.current.opps = true;
          pending.current.accounts = true;
          schedule();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        () => {
          pending.current.opps = true;
          pending.current.contacts = true;
          schedule();
        },
      )
      .subscribe();

    return () => {
      if (pending.current.timer != null) {
        window.clearTimeout(pending.current.timer);
        pending.current.timer = null;
      }
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
