import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribes to real-time changes for a specific opportunity
 * and its linked account/contact so the detail page refreshes
 * automatically when data is edited elsewhere.
 */
export function useRealtimeOpportunityDetail(
  opportunityId: string | undefined,
  accountId: string | null | undefined,
  contactId: string | null | undefined,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!opportunityId) return;

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
        () => {
          queryClient.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
        },
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
        () => {
          queryClient.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
        },
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
        () => {
          queryClient.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
        },
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [opportunityId, accountId, contactId, queryClient]);
}
