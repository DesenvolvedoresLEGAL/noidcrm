// Sprint Scoring 1.3 — central helper to invalidate every cache that depends
// on opportunity indicators (NRHS, Engagement, Velocity, Risk, Deal Health,
// AI Win). Sits next to invalidateOpportunityScoreQueries (Sprint 1.2) and
// reuses the same cross-cutting key list.

import type { QueryClient } from '@tanstack/react-query';
import { invalidateOpportunityScoreQueries } from './invalidateOpportunityScoreQueries';

interface Args {
  opportunityId?: string | null;
  accountId?: string | null;
  organizationId?: string | null;
}

export function invalidateOpportunityIndicatorsQueries(
  queryClient: QueryClient,
  args: Args,
) {
  // Reuse Sprint 1.2 invalidation (covers opportunity, pipeline, scoring,
  // forecast, win-loss, vibe-selling, account-opportunities, account-detail,
  // score-history).
  invalidateOpportunityScoreQueries(queryClient, args);

  // Extra keys specific to indicators dashboards
  const extra: Array<readonly unknown[]> = [
    ['opportunity-indicators'],
    ['opportunity-indicators', args.opportunityId],
    ['nrhs'],
    ['nrhs-analytics'],
    ['deal-health'],
    ['ai-win'],
    ['risk-analysis'],
  ];
  for (const k of extra) {
    queryClient.invalidateQueries({ queryKey: k });
  }
}
