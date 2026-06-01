// Sprint Scoring 1.1 — org-wide realtime for lead/fit/intent/lead_grade
// changes on accounts. Used by Pipeline, Scoring hub and the Opportunity
// detail so cards reflect new scores without hard refresh.

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { invalidateScoreRelatedQueries } from '@/lib/scoring/invalidateScoreQueries';

const SCORE_FIELDS = ['lead_score', 'fit_score', 'intent_score', 'lead_grade'] as const;

export function useScoringRealtime(organizationId: string | undefined | null) {
  const queryClient = useQueryClient();
  const { hasSession, sessionChecked } = useCurrentUser();

  useEffect(() => {
    if (!sessionChecked || !hasSession || !organizationId) return;

    const channel = supabase
      .channel(`scoring-org-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'accounts',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const newRow = (payload.new ?? {}) as Record<string, unknown>;
          const oldRow = (payload.old ?? {}) as Record<string, unknown>;
          const changed = SCORE_FIELDS.some((f) => newRow[f] !== oldRow[f]);
          if (!changed) return;
          const accountId = (newRow.id as string) ?? null;
          invalidateScoreRelatedQueries(queryClient, {
            organizationId,
            accountId,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, hasSession, sessionChecked, queryClient]);
}
