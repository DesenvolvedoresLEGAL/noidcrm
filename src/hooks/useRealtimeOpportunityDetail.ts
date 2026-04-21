import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invalidateOpportunity } from '@/lib/cache-invalidation';

/**
 * Subscribes to real-time changes for a specific opportunity
 * and its linked account/contact so the detail page refreshes
 * automatically when data is edited elsewhere (including backend
 * recalculations of score/NRHS).
 */
export function useRealtimeOpportunityDetail(
  opportunityId: string | undefined,
  accountId: string | null | undefined,
  contactId: string | null | undefined,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!opportunityId) return;

    const refreshAll = () => invalidateOpportunity(queryClient, opportunityId);

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

    // Listen to linked account changes
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

    // Listen to linked contact changes
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
      supabase.removeChannel(channel);
    };
  }, [opportunityId, accountId, contactId, queryClient]);
}
