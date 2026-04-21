// Centralized React Query key factory for the CRM.
//
// Why: previously each hook hardcoded string arrays like ['opportunity-scoring', id].
// A single typo or rename meant cache invalidation silently broke and the user had
// to hard-refresh. By funneling every key through this file we guarantee that
// `useQuery` and `invalidateQueries` always agree on the exact same tuple.
//
// Convention:
// - All factories return `as const` tuples so TanStack Query's structural sharing
//   and TS inference both work correctly.
// - List keys are stable arrays; detail keys append the entity id (or `undefined`
//   when the id is not yet known — TanStack handles that as a distinct key).
// - When you add a new query, ADD IT HERE FIRST and import the factory.
//
// Companion file: `src/lib/cache-invalidation.ts` consumes these to invalidate
// every related cache for a given entity in one call.

type Id = string | undefined | null;

// ---------------------------------------------------------------------------
// Opportunities (deals)
// ---------------------------------------------------------------------------
export const opportunityKeys = {
  all: ['opportunities'] as const,
  lists: () => ['opportunities'] as const,
  list: (filters?: unknown) => ['opportunities', filters] as const,
  detail: (id: Id) => ['opportunity', id] as const,
  activityContext: (id: Id) => ['opportunity-activity-context', id] as const,
  activities: (id: Id) => ['opportunity-activities', id] as const,
  publicForms: (id: Id) => ['opportunity-public-forms', id] as const,
  pipeline: () => ['pipeline'] as const,
  scoreAnalytics: () => ['opportunity-score-analytics'] as const,
};

// Opportunity scoring (engagement / velocity / risk / win_probability_ai)
export const opportunityScoringKeys = {
  full: (id: Id) => ['opportunity-scoring', id] as const,
  lite: (id: Id) => ['opportunity-score-lite', id] as const,
};

// NRHS — NOID Revenue Hygiene Score
export const nrhsKeys = {
  full: (id: Id) => ['nrhs', id] as const,
  lite: (id: Id) => ['nrhs-score-lite', id] as const,
};

// Health drivers (per-opportunity diagnostic factors)
export const healthDriverKeys = {
  byOpportunity: (id: Id) => ['health-drivers', id] as const,
  critical: () => ['critical-drivers'] as const,
};

// AI field suggestions (depend on opportunity fields)
export const aiSuggestionKeys = {
  fields: (opportunityId: Id) => ['ai-field-suggestions', opportunityId] as const,
};

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------
export const accountKeys = {
  all: ['accounts'] as const,
  lists: () => ['accounts'] as const,
  detail: (id: Id) => ['account', id] as const,
  // Hook `useAccountDetails` uses the plural form — keep both aligned.
  detailExtended: (id: Id) => ['account-details', id] as const,
  scoring: (id: Id) => ['account-scoring', id] as const,
  scoringLite: (id: Id) => ['account-score-lite', id] as const,
};

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------
export const contactKeys = {
  all: ['contacts'] as const,
  lists: () => ['contacts'] as const,
  detail: (id: Id) => ['contact', id] as const,
  detailExtended: (id: Id) => ['contact-detail', id] as const,
};

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------
export const proposalKeys = {
  all: ['proposals'] as const,
  lists: () => ['proposals'] as const,
  detail: (id: Id) => ['proposal', id] as const,
};

// ---------------------------------------------------------------------------
// Activities (CRM activity log — tasks/calls/meetings/emails)
// ---------------------------------------------------------------------------
export const activityKeys = {
  all: ['activities'] as const,
  lists: () => ['activities'] as const,
  byOpportunity: (id: Id) => ['opportunity-activities', id] as const,
  byAccount: (id: Id) => ['account-activities', id] as const,
  byContact: (id: Id) => ['contact-activities', id] as const,
};
