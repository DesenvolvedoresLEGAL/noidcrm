// PERF 0.6D — Module-level cache for `stages` lookups.
//
// `stages` is mostly static (changes only when admin edits the pipeline),
// but the audit showed ~888 fetches/day because multiple hooks
// (`useFilteredOpportunities`, `usePipelineMetrics`, `useReportsData`,
// `useOwnerDashboard`) refetch it inside `Promise.all` blocks with no
// shared cache key. We dedupe with a 10-minute in-memory TTL so all
// callers in the same browser session share a single network round-trip.
//
// Stays minimal-risk: same return shape as the inline `supabase.from('stages')`
// selects, no RLS or grants changed.

import { supabase } from '@/integrations/supabase/client';

export interface CachedStage {
  id: string;
  name: string;
  pipeline_id: string;
  order_index: number;
  probability?: number | null;
  stagnation_alert_days?: number | null;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map<string, { ts: number; data: CachedStage[] }>();
const inflight = new Map<string, Promise<CachedStage[]>>();

interface Options {
  organizationId?: string | null;
  withExtras?: boolean; // includes probability + stagnation_alert_days
}

export function invalidateStagesCache() {
  cache.clear();
}

export async function fetchStagesCached(opts: Options = {}): Promise<CachedStage[]> {
  const key = `${opts.organizationId ?? 'all'}::${opts.withExtras ? 'extras' : 'base'}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.ts < TTL_MS) return hit.data;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const columns = opts.withExtras
      ? 'id, name, pipeline_id, order_index, probability, stagnation_alert_days'
      : 'id, name, pipeline_id, order_index';
    let q: any = supabase.from('stages').select(columns).order('order_index');
    if (opts.organizationId) q = q.eq('organization_id', opts.organizationId);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as unknown as CachedStage[];
    cache.set(key, { ts: Date.now(), data: rows });
    return rows;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}
