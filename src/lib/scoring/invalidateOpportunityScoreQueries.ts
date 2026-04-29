// Sprint Scoring 1.2 — single helper to invalidate every cache that depends
// on an opportunity's score, so changes propagate to Pipeline, Detail,
// Forecast, Reports, Win/Loss, Vibe Selling, Account and Scoring without
// hard refresh.
//
// Reuses `invalidateOpportunity` which already covers detail / scoring /
// NRHS / pipeline / list / score-analytics, then layers on cross-cutting
// dashboards that read opportunity_score.

import type { QueryClient } from '@tanstack/react-query';
import { invalidateOpportunity } from '@/lib/cache-invalidation';
import {
  accountKeys,
  opportunityKeys,
  scoreHistoryKeys,
} from '@/lib/query-keys';

interface InvalidateArgs {
  opportunityId?: string | null;
  accountId?: string | null;
  organizationId?: string | null;
}

export function invalidateOpportunityScoreQueries(
  queryClient: QueryClient,
  { opportunityId, accountId }: InvalidateArgs,
) {
  // Core opportunity caches
  if (opportunityId) {
    invalidateOpportunity(queryClient, opportunityId);
  } else {
    queryClient.invalidateQueries({
      queryKey: opportunityKeys.lists(),
      refetchType: 'all',
    });
    queryClient.invalidateQueries({
      queryKey: opportunityKeys.pipeline(),
      refetchType: 'all',
    });
  }

  // Cross-cutting dashboards that consume opportunity_score / grade / health
  const looseKeys: Array<readonly unknown[]> = [
    ['forecast'],
    ['reports'],
    ['win-loss'],
    ['vibe-selling'],
    ['scoring'],
    ['scoring-dashboard'],
  ];
  for (const k of looseKeys) {
    queryClient.invalidateQueries({ queryKey: k });
  }

  if (accountId) {
    queryClient.invalidateQueries({ queryKey: accountKeys.detail(accountId) });
    queryClient.invalidateQueries({
      queryKey: accountKeys.detailExtended(accountId),
    });
    queryClient.invalidateQueries({
      queryKey: ['account-opportunities', accountId],
    });
  }

  if (opportunityId) {
    queryClient.invalidateQueries({
      queryKey: scoreHistoryKeys.byEntity('opportunity', opportunityId),
    });
  }
}
