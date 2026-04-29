// Sprint Scoring 1.2 — opportunity-scoped realtime for score field changes.
// Subscribes to UPDATEs on a single opportunity and only invalidates when
// the score-related fields actually changed, to avoid cache churn.

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invalidateOpportunityScoreQueries } from '@/lib/scoring/invalidateOpportunityScoreQueries';

const SCORE_FIELDS = [
  'opportunity_score',
  'opportunity_grade',
  'opportunity_health',
  'opportunity_score_metadata',
  'score_updated_at',
] as const;

export function useOpportunityScoreRealtime(
  opportunityId: string | undefined | null,
  accountId?: string | null,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!opportunityId) return;

    const channel = supabase
      .channel(`opp-score-${opportunityId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'opportunities',
          filter: `id=eq.${opportunityId}`,
        },
        (payload) => {
          const newRow = (payload.new ?? {}) as Record<string, unknown>;
          const oldRow = (payload.old ?? {}) as Record<string, unknown>;
          const changed = SCORE_FIELDS.some((f) => newRow[f] !== oldRow[f]);
          if (!changed) return;
          invalidateOpportunityScoreQueries(queryClient, {
            opportunityId,
            accountId: accountId ?? (newRow.account_id as string | null) ?? null,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [opportunityId, accountId, queryClient]);
}
