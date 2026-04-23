// Centralized cache invalidation helpers.
// Use these in mutation onSuccess handlers so all derived caches stay in sync
// (no more "I forgot a query key" bugs that force the user to hard refresh).
//
// All keys here flow through the factories in `src/lib/query-keys.ts` —
// never inline string arrays here, so renames stay safe.

import type { QueryClient } from '@tanstack/react-query';
import {
  opportunityKeys,
  opportunityScoringKeys,
  nrhsKeys,
  healthDriverKeys,
  aiSuggestionKeys,
  accountKeys,
  contactKeys,
  proposalKeys,
} from './query-keys';

/**
 * Invalidate ALL queries related to a single opportunity.
 * Covers: detail, scoring, NRHS, kanban/listing, analytics dashboards.
 */
export function invalidateOpportunity(
  queryClient: QueryClient,
  opportunityId: string | undefined | null,
) {
  const keys: Array<readonly unknown[]> = [
    // Listings & pipeline
    opportunityKeys.lists(),
    opportunityKeys.pipeline(),
    opportunityKeys.scoreAnalytics(),
  ];

  if (opportunityId) {
    keys.push(
      // Detail
      opportunityKeys.detail(opportunityId),
      opportunityKeys.activityContext(opportunityId),
      // Scoring
      opportunityScoringKeys.full(opportunityId),
      opportunityScoringKeys.lite(opportunityId),
      // NRHS
      nrhsKeys.full(opportunityId),
      nrhsKeys.lite(opportunityId),
      // Health / drivers
      healthDriverKeys.byOpportunity(opportunityId),
      // AI suggestions depend on opportunity fields
      aiSuggestionKeys.fields(opportunityId),
    );
  }

  // refetchType: 'all' forces refetch even for inactive queries.
  // The global QueryClient sets `refetchOnMount: false` (to keep navigation
  // snappy), which means a plain invalidation only marks inactive queries
  // stale and they NEVER refetch on remount. That caused the kanban to keep
  // showing deleted/moved cards until a hard refresh. With 'all' we force
  // an immediate background refetch so the next mount sees fresh data.
  return Promise.all(
    keys.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey, refetchType: 'all' }),
    ),
  );
}

/**
 * Invalidate everything related to an account (and its opportunities listing).
 */
export function invalidateAccount(
  queryClient: QueryClient,
  accountId: string | undefined | null,
) {
  const keys: Array<readonly unknown[]> = [
    accountKeys.lists(),
    opportunityKeys.lists(),
  ];

  if (accountId) {
    keys.push(
      accountKeys.detail(accountId),
      accountKeys.detailExtended(accountId),
    );
  }

  return Promise.all(
    keys.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey, refetchType: 'all' }),
    ),
  );
}

/**
 * Invalidate everything related to a contact.
 */
export function invalidateContact(
  queryClient: QueryClient,
  contactId: string | undefined | null,
) {
  const keys: Array<readonly unknown[]> = [contactKeys.lists()];

  if (contactId) {
    keys.push(
      contactKeys.detail(contactId),
      contactKeys.detailExtended(contactId),
    );
  }

  return Promise.all(
    keys.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey, refetchType: 'all' }),
    ),
  );
}

/**
 * Invalidate everything related to a proposal (and its parent opportunity).
 */
export function invalidateProposal(
  queryClient: QueryClient,
  proposalId: string | undefined | null,
  opportunityId?: string | null,
) {
  const keys: Array<readonly unknown[]> = [proposalKeys.lists()];

  if (proposalId) {
    keys.push(proposalKeys.detail(proposalId));
  }

  const tasks = keys.map((queryKey) =>
    queryClient.invalidateQueries({ queryKey, refetchType: 'all' }),
  );

  if (opportunityId) {
    tasks.push(invalidateOpportunity(queryClient, opportunityId) as any);
  }

  return Promise.all(tasks);
}
