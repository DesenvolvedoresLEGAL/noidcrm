/**
 * SPRINT PERF 0.6B.1 — Dev helper to validate `projection:'kanban'` against `select('*')`.
 *
 * Not used in production code paths. Exposed on `window.__kanbanProjectionAudit()`
 * in development so we can compare shapes/counts/fields without changing Kanban logic.
 *
 * Usage (browser devtools, while logged in):
 *   await window.__kanbanProjectionAudit({ pipeline_id: '<id>' })
 *
 * Returns:
 *   { httpOk, countFull, countKanban, missingKeys, extraKeys, sampleDiff, payloadBytes }
 */
import { listOpportunities } from '@/services/supabase/opportunities';

export async function auditKanbanProjection(params: {
  pipeline_id?: string;
  limit?: number;
} = {}) {
  const limit = params.limit ?? 200;
  const t0 = performance.now();
  const full = await listOpportunities({ ...params, limit, projection: 'full' });
  const t1 = performance.now();
  const kanban = await listOpportunities({ ...params, limit, projection: 'kanban' });
  const t2 = performance.now();

  const fullKeys = new Set<string>();
  const kanbanKeys = new Set<string>();
  for (const row of full.data ?? []) Object.keys(row || {}).forEach((k) => fullKeys.add(k));
  for (const row of kanban.data ?? []) Object.keys(row || {}).forEach((k) => kanbanKeys.add(k));

  const REQUIRED_BY_KANBAN = [
    'id', 'title', 'status', 'pipeline_id', 'stage_id', 'owner_user_id',
    'account_id', 'contact_id', 'produto', 'valor_previsto', 'prob',
    'temperature', 'temperatura', 'close_date_prevista',
    'engagement_score', 'velocity_score', 'risk_score',
    'opportunity_score', 'win_probability_ai',
    'nrhs_score', 'nrhs_tier', 'nrhs_issues_count', 'nrhs_blockers',
    // mapper-derived (always present in output even on kanban projection):
    'account_name', 'contact_name', 'contact_email', 'contact_phone',
    'owner_name', 'owner_avatar_url',
    'pending_activities_count', 'days_in_stage', 'stagnation_alert_days',
  ];

  const missingInKanban = REQUIRED_BY_KANBAN.filter((k) => !kanbanKeys.has(k));
  const droppedColumns = [...fullKeys].filter((k) => !kanbanKeys.has(k));

  const sample = (kanban.data ?? [])[0];
  const fullSample = (full.data ?? [])[0];

  const result = {
    countFull: full.data?.length ?? 0,
    countKanban: kanban.data?.length ?? 0,
    countMatches: (full.data?.length ?? 0) === (kanban.data?.length ?? 0),
    durationFullMs: Math.round(t1 - t0),
    durationKanbanMs: Math.round(t2 - t1),
    payloadBytesFull: JSON.stringify(full.data ?? []).length,
    payloadBytesKanban: JSON.stringify(kanban.data ?? []).length,
    payloadSavingsPct: full.data?.length
      ? Math.round((1 - JSON.stringify(kanban.data).length / JSON.stringify(full.data).length) * 100)
      : 0,
    missingRequiredFields: missingInKanban,
    droppedColumns: droppedColumns.sort(),
    sampleKanban: sample,
    sampleFull: fullSample,
  };

  // eslint-disable-next-line no-console
  console.table({
    countFull: result.countFull,
    countKanban: result.countKanban,
    countMatches: result.countMatches,
    payloadBytesFull: result.payloadBytesFull,
    payloadBytesKanban: result.payloadBytesKanban,
    payloadSavingsPct: result.payloadSavingsPct + '%',
    missingRequired: result.missingRequiredFields.length,
  });
  if (missingInKanban.length) {
    // eslint-disable-next-line no-console
    console.warn('[kanban-projection-audit] missing required fields:', missingInKanban);
  } else {
    // eslint-disable-next-line no-console
    console.info('[kanban-projection-audit] OK — all required fields present');
  }

  return result;
}

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  // @ts-expect-error - dev helper
  window.__kanbanProjectionAudit = auditKanbanProjection;
}
