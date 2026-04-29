// Sprint Scoring 1.2 — fire-and-forget Opportunity Score recalculation.
// Called from mutations after save/move so the score updates within seconds
// instead of waiting for the 1-minute cron flush. Errors are swallowed —
// the queue + cron will eventually process the change anyway.

import { supabase } from '@/integrations/supabase/client';

export function triggerOpportunityScoreRecalc(opportunityId: string | undefined | null) {
  if (!opportunityId) return;
  // Don't await — fire and forget.
  supabase.functions
    .invoke('calculate-opportunity-score', {
      body: {
        opportunity_id: opportunityId,
        trigger_source: 'manual',
        trigger_action: 'update',
      },
    })
    .catch((err) => {
      // Non-blocking: queue + cron will catch up.
      console.warn('triggerOpportunityScoreRecalc failed:', err);
    });
}

export function flushOpportunityScoreQueue(organizationId: string | undefined | null) {
  if (!organizationId) return;
  supabase.functions
    .invoke('process-opportunity-score-queue', {
      body: { organization_id: organizationId },
    })
    .catch((err) => {
      console.warn('flushOpportunityScoreQueue failed:', err);
    });
}
