// Sprint 2.6 — Canonical filter applier for V2 report edge functions.
import type { ReportFilters } from "./reportRequest.ts";

interface ApplyOptions {
  /** Column to apply dateRange against. Default 'created_at'. */
  dateColumn?: string;
  /** Available columns on the queried view (so filters silently skip when absent). */
  availableColumns?: Set<string>;
}

/**
 * Apply canonical filters to a Supabase query builder.
 * Only applies filters whose target columns are listed in availableColumns
 * (or all of them when availableColumns is omitted).
 */
// deno-lint-ignore no-explicit-any
export function applyCanonicalFilters<Q extends any>(
  query: Q,
  filters: ReportFilters | undefined,
  opts: ApplyOptions = {},
): Q {
  if (!filters) return query;
  const dateColumn = opts.dateColumn ?? "created_at";
  const has = (col: string) =>
    !opts.availableColumns || opts.availableColumns.has(col);

  let q: any = query;

  if (filters.dateRange?.start && has(dateColumn)) {
    q = q.gte(dateColumn, filters.dateRange.start);
  }
  if (filters.dateRange?.end && has(dateColumn)) {
    q = q.lte(dateColumn, filters.dateRange.end);
  }
  if (filters.pipelineIds?.length && has("pipeline_id")) {
    q = q.in("pipeline_id", filters.pipelineIds);
  }
  if (filters.ownerUserIds?.length && has("owner_user_id")) {
    q = q.in("owner_user_id", filters.ownerUserIds);
  }
  if (filters.qualifiedByUserIds?.length && has("qualified_by_user_id")) {
    q = q.in("qualified_by_user_id", filters.qualifiedByUserIds);
  }
  if (filters.originNames?.length && has("origin_name")) {
    q = q.in("origin_name", filters.originNames);
  }
  if (filters.stageIds?.length && has("stage_id")) {
    q = q.in("stage_id", filters.stageIds);
  }
  if (filters.status?.length && has("status")) {
    q = q.in("status", filters.status);
  }
  if (filters.lossReasonIds?.length && has("consolidated_loss_reason_id")) {
    q = q.in("consolidated_loss_reason_id", filters.lossReasonIds);
  }
  if (
    filters.teamVisibility?.enabled &&
    Array.isArray(filters.teamVisibility?.visibleUserIds) &&
    filters.teamVisibility.visibleUserIds.length > 0 &&
    has("owner_user_id")
  ) {
    q = q.in("owner_user_id", filters.teamVisibility.visibleUserIds);
  }

  return q as Q;
}
