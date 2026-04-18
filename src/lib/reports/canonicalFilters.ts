/**
 * Sprint 2.1 — Canonical Reports V2 Guardrails
 * ============================================
 * Single source of truth for filtering rules used by every Reports V2 query.
 *
 * Rules (from Sprint 1 contract):
 *  1. ALWAYS exclude soft-deleted rows  → deleted_at IS NULL
 *  2. Sales reports use ONLY pipeline_type='sales'
 *  3. Performance metrics use closed_at / won_at / lost_at, NEVER created_at
 *  4. No fake numbers — if data is missing, return null and render "Indisponível"
 */

import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';

/**
 * Apply the canonical "active rows only" filter.
 * MANDATORY for every Reports V2 query that touches `opportunities`.
 */
export function applyActiveRowsFilter<T extends { is: (col: string, v: any) => any }>(
  query: T
): T {
  return query.is('deleted_at', null) as T;
}

/**
 * Date column whitelist for Reports V2.
 * Performance metrics MUST use one of these — never `created_at` or `updated_at`.
 */
export const CANONICAL_DATE_COLUMNS = {
  WON: 'won_at',
  LOST: 'lost_at',
  CLOSED: 'closed_at',
} as const;

/**
 * Sentinel value for "no real data available".
 * UI components should render the <UnavailableMetric /> placeholder when they see this.
 */
export const METRIC_UNAVAILABLE = Symbol('metric_unavailable');

/**
 * Sprint 2.1 — Métricas estruturalmente não confiáveis até Sprint 2.2 (stage_history).
 * Qualquer componente que tente renderizar uma destas DEVE usar <UnreliableMetric />.
 */
export const UNRELIABLE_METRICS = {
  AVG_DAYS_IN_STAGE: 'avgDaysInStage',
  AVG_SALES_CYCLE_DAYS: 'avgSalesCycleDays',
  AVG_QUALIFICATION_HOURS: 'avgQualificationHours',
  REAL_STAGE_CONVERSION: 'realStageConversion',
} as const;

export type UnreliableMetricKey =
  (typeof UNRELIABLE_METRICS)[keyof typeof UNRELIABLE_METRICS];

export type MetricValue<T> = T | typeof METRIC_UNAVAILABLE;

export function isUnavailable<T>(value: MetricValue<T>): value is typeof METRIC_UNAVAILABLE {
  return value === METRIC_UNAVAILABLE;
}

/**
 * Audit hook — call from any V2 query to confirm guardrails were applied.
 * In dev, logs a warning if a query forgets to scope by organization or filter soft deletes.
 */
export function auditCanonicalQuery(meta: {
  reportName: string;
  appliedFilters: string[];
}) {
  if (import.meta.env.DEV) {
    const required = ['deleted_at', 'organization_id'];
    const missing = required.filter((f) => !meta.appliedFilters.includes(f));
    if (missing.length > 0) {
      console.warn(
        `[CanonicalGuardrail] ${meta.reportName} is missing required filters: ${missing.join(', ')}`
      );
    }
  }
}
