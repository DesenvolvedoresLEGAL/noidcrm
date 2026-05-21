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
  closedSsot: (f: ForecastPeriodFilters) =>
    ['forecast-closed-ssot', f.start, f.end, f.pipelineId, f.userId] as const,
  lost: (f: ForecastPeriodFilters) =>
    ['forecast-lost', f.start, f.end, f.pipelineId, f.userId] as const,

  // Prefixes (used by `invalidateQueries` to nuke an entire family).
  opportunitiesAll: () => ['forecast-opportunities'] as const,
  closedAll: () => ['forecast-closed'] as const,
  closedSsotAll: () => ['forecast-closed-ssot'] as const,
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
  orgGoal: (periodType?: string) => ['org-goal', periodType ?? 'monthly'] as const,
  sellerOteGoals: (periodType?: string) => ['seller-ote-goals', periodType ?? 'monthly'] as const,
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

// ---------------------------------------------------------------------------
// AI Agents (NOID Intelligence) — agent CRUD, versions, audit, governance
// (publish history, permissions, environments), Builder Studio config,
// Simulator (test scenarios + history), live Execution (runs + approval queue),
// Outcomes (KPIs / influenced revenue), Email metrics, AI Supervision
// (CRM-wide ai_actions + ai_alerts), and the Email Agent Cadence engine.
//
// Why a single namespace: every NOID Intelligence surface (Hub, Builder,
// Simulator, Live Execution drawer, opportunity approvals widget) reads from
// these keys, so any mutation (publish a version, approve an action, change
// a cadence step) must invalidate the matching `*All()` prefix to keep the
// whole intelligence layer in sync without a manual refresh.
// ---------------------------------------------------------------------------
type AIAgentFilters = {
  status?: string;
  autonomy_level?: string;
  owner_id?: string;
  search?: string;
};

type ExecutionRunFilters = { agentId?: string; status?: string };

export const aiAgentKeys = {
  // ---- Agent CRUD ----
  list: (filters?: AIAgentFilters) => ['ai-agents', filters] as const,
  listAll: () => ['ai-agents'] as const,
  detail: (id: Id) => ['ai-agent', id] as const,

  // ---- Versions & audit ----
  versions: (agentId: Id) => ['ai-agent-versions', agentId] as const,
  versionsAll: () => ['ai-agent-versions'] as const,
  audit: (agentId: Id) => ['ai-agent-audit', agentId] as const,

  // ---- Governance: publish history, permissions, environments ----
  publishHistory: (agentId: Id) =>
    ['ai-agent-publish-history', agentId] as const,
  publishHistoryAll: () => ['ai-agent-publish-history'] as const,
  permissions: (orgId: Id) => ['ai-agent-permissions', orgId] as const,
  permissionsAll: () => ['ai-agent-permissions'] as const,
  environments: (orgId: Id) => ['ai-agent-environments', orgId] as const,
  environmentsAll: () => ['ai-agent-environments'] as const,

  // ---- Builder Studio (per-version config + tools registry) ----
  builderConfig: (agentId: Id, versionId?: string) =>
    ['agent-builder-config', agentId, versionId] as const,
  builderConfigByAgent: (agentId: Id) =>
    ['agent-builder-config', agentId] as const,
  toolsRegistry: () => ['ai-tools-registry'] as const,

  // ---- Simulator (dry runs + saved test scenarios) ----
  simulationHistory: (agentId: Id, versionId?: string) =>
    ['simulation-history', agentId, versionId] as const,
  simulationHistoryByAgent: (agentId: Id) =>
    ['simulation-history', agentId] as const,
  testScenarios: () => ['test-scenarios'] as const,

  // ---- Live execution: runs, run details, approval queue ----
  executionRuns: (orgId: Id, filters?: ExecutionRunFilters) =>
    ['execution-runs', orgId, filters] as const,
  executionRunsAll: () => ['execution-runs'] as const,
  runDetails: (runId: Id) => ['run-details', runId] as const,
  approvalQueue: (orgId: Id) => ['approval-queue', orgId] as const,
  approvalQueueAll: () => ['approval-queue'] as const,
  approvalQueueCount: (orgId: Id) => ['approval-queue-count', orgId] as const,
  approvalQueueCountAll: () => ['approval-queue-count'] as const,
  // Per-opportunity pending approvals widget
  opportunityApprovals: (opportunityId: Id) =>
    ['opportunity-approvals', opportunityId] as const,
  opportunityApprovalsAll: () => ['opportunity-approvals'] as const,

  // ---- Outcomes & email metrics ----
  outcomes: (agentId: Id, rangeDays: number) =>
    ['agent-outcomes', agentId, rangeDays] as const,
  emailMetrics: (filters: unknown) => ['email-agent-metrics', filters] as const,
  emailMetricsSummary: (filters: unknown) =>
    ['email-agent-metrics-summary', filters] as const,
  emailOutcomes: (agentId: Id, outcomeType?: string) =>
    ['email-agent-outcomes', agentId, outcomeType] as const,

  // ---- Cadence engine (policies, steps, cooldown, pipeline rules, progress) ----
  cadencePolicies: (agentId: Id) => ['cadence-policies', agentId] as const,
  cadencePoliciesAll: () => ['cadence-policies'] as const,
  cadenceSteps: (policyId: Id) => ['cadence-steps', policyId] as const,
  cadenceStepsAll: () => ['cadence-steps'] as const,
  cooldownPolicy: (agentId: Id) => ['cooldown-policy', agentId] as const,
  cooldownPolicyAll: () => ['cooldown-policy'] as const,
  pipelineRules: (agentId: Id) => ['pipeline-rules', agentId] as const,
  pipelineRulesAll: () => ['pipeline-rules'] as const,
  cadenceProgress: (agentId: Id, filters?: { status?: string }) =>
    ['cadence-progress', agentId, filters] as const,
};

// ---------------------------------------------------------------------------
// CRM Timeline — unified + enhanced timelines for an entity (opportunity /
// account / contact). Kept in a single namespace so any side-effect that
// produces a new timeline event (activity, email, audit, AI approval) can
// invalidate every timeline surface in one call without re-typing strings.
// ---------------------------------------------------------------------------
export const crmTimelineKeys = {
  // Unified timeline (services/crm/timeline) — multi-entity scoped
  unified: (params: {
    opportunityId?: Id;
    accountId?: Id;
    contactId?: Id;
    limit?: number;
  }) =>
    [
      'unified-timeline',
      params.opportunityId,
      params.accountId,
      params.contactId,
      params.limit,
    ] as const,
  unifiedAll: () => ['unified-timeline'] as const,

  // Enhanced timeline (services/crm/enhanced-timeline) — opportunity-scoped
  enhanced: (opportunityId: Id) =>
    ['enhanced-timeline', opportunityId] as const,
  enhancedAll: () => ['enhanced-timeline'] as const,
};

// ---------------------------------------------------------------------------
// AI Supervision (CRM-wide ai_actions + ai_alerts dashboards)
// ---------------------------------------------------------------------------
export const aiSupervisionKeys = {
  actionStats: () => ['ai-action-stats'] as const,
  alertStats: () => ['ai-alert-stats'] as const,
  recentActions: (limit: number) => ['recent-ai-actions', limit] as const,
  recentActionsAll: () => ['recent-ai-actions'] as const,
  pendingApprovals: () => ['pending-approvals'] as const,
  activeAlerts: () => ['active-alerts'] as const,
};

// ---------------------------------------------------------------------------
// AI Operations (workflow automation orchestration dashboard)
// ---------------------------------------------------------------------------
export const aiOperationsKeys = {
  automationStats: () => ['automation-stats'] as const,
  recentAutomations: (limit: number) => ['recent-automations', limit] as const,
  recentAutomationsAll: () => ['recent-automations'] as const,
  workflowExecutions: (filters?: unknown) =>
    ['workflow-executions', filters] as const,
  workflowExecutionsAll: () => ['workflow-executions'] as const,
  notificationsAll: () => ['notifications'] as const,
};
