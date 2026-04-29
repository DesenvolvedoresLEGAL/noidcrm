// Sprint Scoring 1.3 — single-opportunity realtime for derived indicators.
// Listens for UPDATEs and only invalidates when an indicator field actually
// changed, to avoid unnecessary cache churn.

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invalidateOpportunityIndicatorsQueries } from '@/lib/scoring/invalidateOpportunityIndicatorsQueries';

const FIELDS = [
  'engagement_score',
  'velocity_score',
  'risk_score',
  'risk_level',
  'nrhs_score',
  'nrhs_tier',
  'nrhs_blockers',
  'deal_health',
  'deal_health_score',
  'win_probability_ai',
  'ai_win_probability_metadata',
  'indicators_updated_at',
] as const;

export function useOpportunityIndicatorsRealtime(
  opportunityId: string | undefined | null,
  accountId?: string | null,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!opportunityId) return;
    const channel = supabase
      .channel(`opp-indicators-${opportunityId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'opportunities',
          filter: `id=eq.${opportunityId}`,
        },
        (payload) => {
          const n = (payload.new ?? {}) as Record<string, unknown>;
          const o = (payload.old ?? {}) as Record<string, unknown>;
          const changed = FIELDS.some((f) => n[f] !== o[f]);
          if (!changed) return;
          invalidateOpportunityIndicatorsQueries(queryClient, {
            opportunityId,
            accountId: accountId ?? (n.account_id as string | null) ?? null,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [opportunityId, accountId, queryClient]);
}
