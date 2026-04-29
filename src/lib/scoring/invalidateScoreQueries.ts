// Sprint Scoring 1.1 — single helper to invalidate every cache that depends
// on an account's lead/fit/intent score, so changes propagate to Account
// detail, Scoring hub, Pipeline, and Opportunity detail without hard refresh.

import type { QueryClient } from '@tanstack/react-query';
import {
  accountKeys,
  opportunityKeys,
  leadScoreKeys,
  scoreHistoryKeys,
} from '@/lib/query-keys';

interface InvalidateScoreArgs {
  organizationId?: string | null;
  accountId?: string | null;
}

export function invalidateScoreRelatedQueries(
  queryClient: QueryClient,
  { organizationId, accountId }: InvalidateScoreArgs,
) {
  // Account-scoped caches
  if (accountId) {
    queryClient.invalidateQueries({ queryKey: accountKeys.detail(accountId) });
    queryClient.invalidateQueries({
      queryKey: accountKeys.detailExtended(accountId),
    });
    queryClient.invalidateQueries({ queryKey: accountKeys.scoring(accountId) });
    queryClient.invalidateQueries({
      queryKey: accountKeys.scoringLite(accountId),
    });
    queryClient.invalidateQueries({ queryKey: ['lead-score-ai', accountId] });
    queryClient.invalidateQueries({
      queryKey: scoreHistoryKeys.byEntity('account', accountId),
    });
    queryClient.invalidateQueries({ queryKey: ['account-opportunities', accountId] });
    queryClient.invalidateQueries({ queryKey: ['account-activities', accountId] });
  }

  // Lists / dashboards that show scores across many accounts
  queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
  queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
  queryClient.invalidateQueries({ queryKey: opportunityKeys.pipeline() });
  queryClient.invalidateQueries({ queryKey: opportunityKeys.scoreAnalytics() });
  queryClient.invalidateQueries({ queryKey: leadScoreKeys.all });
  queryClient.invalidateQueries({ queryKey: ['scoring'] });
  queryClient.invalidateQueries({ queryKey: ['scoring-dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['lead-scoring'] });

  if (organizationId) {
    queryClient.invalidateQueries({
      queryKey: leadScoreKeys.analytics(organizationId),
    });
  }
}
