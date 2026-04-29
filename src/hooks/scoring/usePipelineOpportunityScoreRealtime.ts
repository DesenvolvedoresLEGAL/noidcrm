// Sprint Scoring 1.2 — org-wide realtime for opportunity score changes.
// Used by Pipeline / Forecast / Scoring dashboards so cards refresh score,
// grade and health without hard refresh, while filtering payloads to avoid
// reacting to every opportunity update in large orgs.

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invalidateOpportunityScoreQueries } from '@/lib/scoring/invalidateOpportunityScoreQueries';

const SCORE_FIELDS = [
  'opportunity_score',
  'opportunity_grade',
  'opportunity_health',
  'score_updated_at',
] as const;

export function usePipelineOpportunityScoreRealtime(
  organizationId: string | undefined | null,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel(`opp-score-org-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'opportunities',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const newRow = (payload.new ?? {}) as Record<string, unknown>;
          const oldRow = (payload.old ?? {}) as Record<string, unknown>;
          const changed = SCORE_FIELDS.some((f) => newRow[f] !== oldRow[f]);
          if (!changed) return;
          invalidateOpportunityScoreQueries(queryClient, {
            opportunityId: (newRow.id as string) ?? null,
            accountId: (newRow.account_id as string) ?? null,
            organizationId,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);
}
