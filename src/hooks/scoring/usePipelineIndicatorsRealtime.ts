// Sprint Scoring 1.3 — org-scoped realtime for indicator updates across the
// pipeline. Subscribes to UPDATEs on opportunities filtered by organization
// and only invalidates the relevant caches when an indicator field changes.

import { useEffect, useRef } from 'react';
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
  'deal_health',
  'win_probability_ai',
  'indicators_updated_at',
] as const;

export function usePipelineIndicatorsRealtime(
  organizationId: string | undefined | null,
) {
  const queryClient = useQueryClient();
  // Debounce mass invalidations during backfill bursts.
  const pending = useRef<{ timer: number | null; ids: Set<string> }>({
    timer: null,
    ids: new Set(),
  });

  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel(`pipeline-indicators-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'opportunities',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const n = (payload.new ?? {}) as Record<string, unknown>;
          const o = (payload.old ?? {}) as Record<string, unknown>;
          const changed = FIELDS.some((f) => n[f] !== o[f]);
          if (!changed) return;
          pending.current.ids.add(String(n.id));
          if (pending.current.timer) return;
          pending.current.timer = window.setTimeout(() => {
            const ids = Array.from(pending.current.ids);
            pending.current.ids.clear();
            pending.current.timer = null;
            // Single broad invalidation; per-opportunity refetches happen via card-level subscriptions.
            invalidateOpportunityIndicatorsQueries(queryClient, {
              organizationId,
              opportunityId: ids.length === 1 ? ids[0] : null,
            });
          }, 500);
        },
      )
      .subscribe();
    return () => {
      if (pending.current.timer) window.clearTimeout(pending.current.timer);
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);
}
