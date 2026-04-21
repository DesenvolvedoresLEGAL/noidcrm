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

// ---------------------------------------------------------------------------
// Forecast (predictions, period rollups, AI insights, accuracy, seats)
// ---------------------------------------------------------------------------
// Period filter shape used by the main forecast hook. Kept structural so the
// caller can pass `Date` objects directly — TanStack Query will serialize.
type ForecastPeriodFilters = {
  start: string;
  end: string;
  pipelineId?: string | null;
  userId?: string | null;
};

export const forecastKeys = {
  // Top-level prefix to invalidate ALL forecast queries in one call.
  all: ['forecast'] as const,

  // Period-scoped lists (open / closed / lost) — keyed by serialized period.
  opportunities: (f: ForecastPeriodFilters) =>
    ['forecast-opportunities', f.start, f.end, f.pipelineId, f.userId] as const,
  closed: (f: ForecastPeriodFilters) =>
    ['forecast-closed', f.start, f.end, f.pipelineId, f.userId] as const,
  lost: (f: ForecastPeriodFilters) =>
    ['forecast-lost', f.start, f.end, f.pipelineId, f.userId] as const,

  // Prefixes (used by `invalidateQueries` to nuke an entire family).
  opportunitiesAll: () => ['forecast-opportunities'] as const,
  closedAll: () => ['forecast-closed'] as const,
  lostAll: () => ['forecast-lost'] as const,

  team: () => ['forecast-team'] as const,
  pipelines: () => ['forecast-pipelines'] as const,
  aiInsights: (orgId: Id, pipelineId?: string | null) =>
    ['forecast-ai-insights', orgId, pipelineId] as const,
  aiInsightsAll: () => ['forecast-ai-insights'] as const,

  predictions: (opportunityId: Id) =>
    ['forecast-predictions', opportunityId] as const,
  accuracyMetrics: (pipelineId?: string | null, userId?: string | null) =>
    ['forecast-accuracy-metrics', pipelineId, userId] as const,
  accuracyComparison: (pipelineId?: string | null, userId?: string | null) =>
    ['accuracy-comparison', pipelineId, userId] as const,

  seatForecast: (seatMetrics: unknown) => ['seat-forecast', seatMetrics] as const,

  // V2 edge-function based forecast report
  reportV2: (orgId: Id, filters?: unknown, options?: unknown) =>
    ['report-forecast-v2', orgId, filters, options] as const,
};

// ---------------------------------------------------------------------------
// Sales goals & OTE (read inside forecast and OTE pages)
// ---------------------------------------------------------------------------
export const salesGoalKeys = {
  list: (start: string, end: string, pipelineId?: string | null) =>
    ['sales-goals', start, end, pipelineId] as const,
  listAll: () => ['sales-goals'] as const,
  orgGoal: () => ['org-goal'] as const,
  sellerOteGoals: () => ['seller-ote-goals'] as const,
  sellerIndividualGoal: (userId: Id) =>
    ['seller-individual-goal', userId] as const,
};

// ---------------------------------------------------------------------------
// Lead scoring analytics (account-level lead grade/fit/intent)
// ---------------------------------------------------------------------------
export const leadScoreKeys = {
  all: ['lead-score-analytics'] as const,
  analytics: (orgId: Id) => ['lead-score-analytics', orgId] as const,
};

// ---------------------------------------------------------------------------
// NRHS analytics (org-wide hygiene dashboard)
// ---------------------------------------------------------------------------
export const nrhsAnalyticsKeys = {
  all: ['nrhs-analytics'] as const,
  byUser: (orgId: Id, userId: Id, isPrivileged: boolean) =>
    ['nrhs-analytics', orgId, userId, isPrivileged] as const,
  kpis: (orgId: Id, userId: Id, isPrivileged: boolean) =>
    ['nrhs-kpis', orgId, userId, isPrivileged] as const,
};

// ---------------------------------------------------------------------------
// Score history (entity-level audit trail of score changes)
// ---------------------------------------------------------------------------
export const scoreHistoryKeys = {
  byEntity: (entityType: 'account' | 'opportunity' | string, entityId: Id) =>
    ['score-history', entityType, entityId] as const,
  bySeller: (sellerId: Id, scoreType?: string, limit?: number) =>
    ['score-history', sellerId, scoreType, limit] as const,
};

// ---------------------------------------------------------------------------
// Opportunity diagnostic (questionnaire results)
// ---------------------------------------------------------------------------
export const diagnosticKeys = {
  byOpportunity: (id: Id) => ['opportunity-diagnostic', id] as const,
};

// ---------------------------------------------------------------------------
// Performance scores (CS / BS / DS / RAS — seller & team)
// ---------------------------------------------------------------------------
export const performanceKeys = {
  seller: (sellerId: Id) => ['seller-performance-scores', sellerId] as const,
  team: (orgId: Id) => ['team-performance-scores', orgId] as const,
  history: (sellerId: Id, days: number) =>
    ['performance-history', sellerId, days] as const,
  dynamicMissions: (sellerId: Id) =>
    ['dynamic-missions', sellerId] as const,
  atRiskSellers: (orgId: Id) => ['at-risk-sellers', orgId] as const,
};

// ---------------------------------------------------------------------------
// Current authenticated user (small auth-bound query reused everywhere)
// ---------------------------------------------------------------------------
export const sessionKeys = {
  currentUser: () => ['current-user'] as const,
};

// ---------------------------------------------------------------------------
// Gamification — badges, achievements, missions, XP/level, leaderboard,
// roleplay stats, governance (XP conversion / badge preservation history).
//
// All gamification surfaces (Hub, modals, sidebar widgets, kanban badges) read
// from these keys, so a mission claim or a badge unlock must invalidate the
// matching prefix to keep XP totals and progress bars in sync everywhere.
// ---------------------------------------------------------------------------
export const gamificationKeys = {
  // Per-seller surfaces
  badges: (sellerId: Id) => ['seller-badges', sellerId] as const,
  level: (sellerId: Id) => ['seller-level', sellerId] as const,
  achievements: (sellerId: Id) => ['seller-achievements', sellerId] as const,
  achievementsProgress: (sellerId: Id) =>
    ['seller-achievements-progress', sellerId] as const,
  recentUnlocks: (sellerId: Id) => ['seller-recent-unlocks', sellerId] as const,
  missions: (sellerId: Id) => ['seller-missions', sellerId] as const,

  // Prefix invalidations (pass to invalidateQueries when sellerId is unknown)
  badgesAll: () => ['seller-badges'] as const,
  levelAll: () => ['seller-level'] as const,
  achievementsAll: () => ['seller-achievements'] as const,
  recentUnlocksAll: () => ['seller-recent-unlocks'] as const,
  missionsAll: () => ['seller-missions'] as const,

  // Roleplay (training stats feed mission/badge progress)
  roleplayToday: (sellerId: Id) =>
    ['roleplay-today-trainings', sellerId] as const,
  roleplayAverage: (sellerId: Id) =>
    ['roleplay-overall-average', sellerId] as const,
  roleplayStreak: (sellerId: Id) =>
    ['roleplay-current-streak', sellerId] as const,

  // Leaderboard (scope = 'global' | 'team', visibleUserIds for team scope)
  leaderboard: (scope: string, visibleUserIds?: readonly string[] | null) =>
    ['leaderboard', scope, visibleUserIds] as const,
  leaderboardAll: () => ['leaderboard'] as const,

  // Governance (XP conversion + badge preservation audit trails)
  xpConversionHistory: (sellerId: Id) =>
    ['xp-conversion-history', sellerId] as const,
  xpConversionHistoryAll: () => ['xp-conversion-history'] as const,
  badgePreservationHistory: (sellerId: Id) =>
    ['badge-preservation-history', sellerId] as const,
  badgePreservationHistoryAll: () => ['badge-preservation-history'] as const,
  activityMappings: (orgId: Id) => ['activity-mappings', orgId] as const,
  activityMappingsAll: () => ['activity-mappings'] as const,
};

// ---------------------------------------------------------------------------
// OTE — levels, multipliers, seller configs, monthly results, accelerator
// rules, and the rep-level PACE tracker.
//
// Every OTE mutation (create level, update multiplier, override seller goal,
// recalc month) must invalidate via the matching `*All()` prefix so the OTE
// dashboard, seller modals, and PACETracker all refresh together.
// ---------------------------------------------------------------------------
export const oteKeys = {
  levels: (orgId: Id) => ['ote-levels', orgId] as const,
  levelsAll: () => ['ote-levels'] as const,

  multipliers: (orgId: Id) => ['ote-multipliers', orgId] as const,
  multipliersAll: () => ['ote-multipliers'] as const,

  sellerConfigs: (orgId: Id) => ['ote-seller-configs', orgId] as const,
  sellerConfigsAll: () => ['ote-seller-configs'] as const,

  monthlyResults: (orgId: Id, periodMonth?: string) =>
    ['ote-monthly-results', orgId, periodMonth] as const,
  monthlyResultsAll: () => ['ote-monthly-results'] as const,

  rules: (orgId: Id) => ['ote-rules', orgId] as const,
  rulesAll: () => ['ote-rules'] as const,

  // Rep PACE tracker (current user's pace toward monthly OTE goal)
  repConfig: (orgId: Id) => ['rep-ote-config', orgId] as const,
  repPaceAchieved: (orgId: Id, currentMonth: string, goalType: string) =>
    ['rep-pace-achieved', orgId, currentMonth, goalType] as const,
};

// ---------------------------------------------------------------------------
// Vibe — emotional intelligence layer (alerts, daily check, analytics,
// narratives). Vibe alerts feed the inbox + opportunity sidebar; analytics
// powers the org-wide vibe dashboard.
// ---------------------------------------------------------------------------
export const vibeKeys = {
  // Per-opportunity active alerts (sidebar / kanban indicators)
  alertsByOpportunity: (opportunityId: Id) =>
    ['vibe-alerts', opportunityId] as const,
  alertsAll: () => ['vibe-alerts'] as const,

  // Counter for the user's active alerts (header badge)
  alertsCount: (userId: Id) => ['vibe-alerts-count', userId] as const,
  alertsCountAll: () => ['vibe-alerts-count'] as const,

  // Full alerts list for the dedicated card (filterable by status)
  allAlertsByUser: (userId: Id, statusFilter: string) =>
    ['all-vibe-alerts', userId, statusFilter] as const,

  // Daily vibe check (per-user morning briefing)
  dailyCheck: (userId: Id, organizationId: Id) =>
    ['daily-vibe-check', userId, organizationId] as const,

  // Org-wide vibe analytics dashboard
  analytics: (orgId: Id) => ['vibe-analytics', orgId] as const,

  // Custom narratives per vibe state (org-scoped)
  narratives: (orgId: Id) => ['vibe-narratives', orgId] as const,
  narrativesAll: () => ['vibe-narratives'] as const,
};
