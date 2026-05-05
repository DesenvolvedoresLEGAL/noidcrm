import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invalidateOpportunity } from '@/lib/cache-invalidation';

/**
 * Subscribes to real-time changes for a specific opportunity
 * and its linked account/contact so the detail page refreshes
 * automatically when data is edited elsewhere (including backend
 * recalculations of score/NRHS).
 *
 * Performance: invalidations are debounced (1s) to avoid invalidating
 * the entire opportunity cache tree multiple times in a row when a
 * backend job updates several columns of the same row.
 */
export function useRealtimeOpportunityDetail(
  opportunityId: string | undefined,
  accountId: string | null | undefined,
  contactId: string | null | undefined,
) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!opportunityId) return;

    const refreshAll = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        invalidateOpportunity(queryClient, opportunityId);
      }, 1000);
    };

    const channel = supabase
      .channel(`realtime-opp-detail-${opportunityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'opportunities',
          filter: `id=eq.${opportunityId}`,
        },
        refreshAll,
      );

    if (accountId) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounts',
          filter: `id=eq.${accountId}`,
        },
        refreshAll,
      );
    }

    if (contactId) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `id=eq.${contactId}`,
        },
        refreshAll,
      );
    }

    channel.subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [opportunityId, accountId, contactId, queryClient]);
}
