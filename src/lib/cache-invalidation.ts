// Centralized cache invalidation helpers.
// Use these in mutation onSuccess handlers so all derived caches stay in sync
// (no more "I forgot a query key" bugs that force the user to hard refresh).

import type { QueryClient } from '@tanstack/react-query';

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
    ['opportunities'],
    ['pipeline'],
    ['opportunity-score-analytics'],
  ];

  if (opportunityId) {
    keys.push(
      // Detail
      ['opportunity', opportunityId],
      ['opportunity-activity-context', opportunityId],
      // Scoring
      ['opportunity-scoring', opportunityId],
      ['opportunity-score-lite', opportunityId],
      // NRHS
      ['nrhs', opportunityId],
      ['nrhs-score-lite', opportunityId],
      // Health / drivers
      ['healthDrivers', opportunityId],
      // AI suggestions depend on opportunity fields
      ['ai-field-suggestions', opportunityId],
    );
  }

  return Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
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
    ['accounts'],
    ['opportunities'],
  ];

  if (accountId) {
    keys.push(['account', accountId], ['account-detail', accountId]);
  }

  return Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

/**
 * Invalidate everything related to a contact.
 */
export function invalidateContact(
  queryClient: QueryClient,
  contactId: string | undefined | null,
) {
  const keys: Array<readonly unknown[]> = [['contacts']];

  if (contactId) {
    keys.push(['contact', contactId], ['contact-detail', contactId]);
  }

  return Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
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
  const keys: Array<readonly unknown[]> = [['proposals']];

  if (proposalId) {
    keys.push(['proposal', proposalId]);
  }

  const tasks = keys.map((queryKey) =>
    queryClient.invalidateQueries({ queryKey }),
  );

  if (opportunityId) {
    tasks.push(invalidateOpportunity(queryClient, opportunityId) as any);
  }

  return Promise.all(tasks);
}
