// Sprint Scoring 1.1 — realtime hook for a single account's lead score.
// Subscribes to UPDATEs on `accounts` filtered by id and triggers a unified
// cache invalidation whenever any of the four score fields actually change.

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invalidateScoreRelatedQueries } from '@/lib/scoring/invalidateScoreQueries';

const SCORE_FIELDS = ['lead_score', 'fit_score', 'intent_score', 'lead_grade'] as const;

export function useLeadScoreRealtime(
  accountId: string | undefined | null,
  organizationId?: string | null,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accountId) return;

    const channel = supabase
      .channel(`lead-score-${accountId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'accounts',
          filter: `id=eq.${accountId}`,
        },
        (payload) => {
          const newRow = (payload.new ?? {}) as Record<string, unknown>;
          const oldRow = (payload.old ?? {}) as Record<string, unknown>;
          const changed = SCORE_FIELDS.some((f) => newRow[f] !== oldRow[f]);
          if (!changed) return;
          invalidateScoreRelatedQueries(queryClient, {
            organizationId: organizationId ?? null,
            accountId,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId, organizationId, queryClient]);
}
