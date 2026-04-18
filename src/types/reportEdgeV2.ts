/**
 * Sprint 2.6 — Frontend types for V2 report edge function envelopes.
 *
 * Mirror the structures defined in supabase/functions/_shared/reportResponse.ts
 * and reportRequest.ts. Use these when calling callReportEdgeFunction.
 */

export type ConfidenceLevel =
  | "high"
  | "medium"
  | "low"
  | "partial"
  | "unavailable";

export interface ReportConfidence {
  level: ConfidenceLevel;
  score: number;
  breakdown: Record<string, number | null>;
}

export interface ReportEdgeFiltersDateRange {
  start?: string;
  end?: string;
}

export interface ReportEdgeTeamVisibility {
  enabled?: boolean;
  visibleUserIds?: string[];
}

export interface ReportEdgeFilters {
  dateRange?: ReportEdgeFiltersDateRange;
  pipelineIds?: string[];
  ownerUserIds?: string[];
  qualifiedByUserIds?: string[];
  originNames?: string[];
  stageIds?: string[];
  status?: string[];
  lossReasonIds?: string[];
  teamVisibility?: ReportEdgeTeamVisibility;
}

export interface ReportEdgeOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  includeMeta?: boolean;
  includeDebug?: boolean;
}

export interface ReportEdgeRequest {
  organizationId: string;
  filters?: ReportEdgeFilters;
  options?: ReportEdgeOptions;
}

export interface ReportMeta {
  reportKey: string;
  organizationId: string;
  generatedAt: string;
  filtersApplied: ReportEdgeFilters | null;
  rowCount: number;
  confidence: ReportConfidence | null;
  status: "ok" | "unavailable";
  debug?: Record<string, unknown>;
}

export interface ReportEdgeError {
  code: string;
  message: string;
}

export interface ReportEdgeResponse<T> {
  success: boolean;
  data: T | null;
  meta: ReportMeta;
  error: ReportEdgeError | null;
}

/** Reconcile-specific payload type. */
export interface ReportReconcileCheck {
  key: string;
  description: string;
  expected: number;
  actual: number;
  delta: number;
  isConsistent: boolean;
  severity: "info" | "warning" | "critical";
}

export interface ReportReconcileData {
  checks: ReportReconcileCheck[];
  overallStatus: "consistent" | "warning" | "critical";
}
