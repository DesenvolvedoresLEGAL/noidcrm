import { supabase } from '@/integrations/supabase/client';

export type RuntimeLogEventType =
  | 'runtime_allowed'
  | 'runtime_fallback'
  | 'runtime_error'
  | 'user_chose_legacy_dashboard'
  | 'user_returned_to_dynamic_dashboard';

export interface LogRuntimeEventParams {
  tenantId: string;
  userId: string;
  eventType: RuntimeLogEventType;
  profileKey?: string | null;
  guardAllowed?: boolean;
  fallbackUsed?: boolean;
  fallbackReason?: string | null;
  loadMs?: number | null;
  errorMessage?: string | null;
  metadata?: Record<string, any>;
}

export async function logDynamicDashboardRuntimeEvent(params: LogRuntimeEventParams) {
  try {
    const { error } = await (supabase as any).rpc('crm_log_dynamic_dashboard_runtime_event', {
      p_tenant_id: params.tenantId,
      p_user_id: params.userId,
      p_profile_key: params.profileKey ?? null,
      p_event_type: params.eventType,
      p_guard_allowed: params.guardAllowed ?? false,
      p_fallback_used: params.fallbackUsed ?? false,
      p_fallback_reason: params.fallbackReason ?? null,
      p_load_ms: params.loadMs ?? null,
      p_error_message: params.errorMessage ?? null,
      p_metadata: params.metadata ?? {},
    });
    if (error) {
      // Never throw from telemetry
      console.warn('[runtimeLogs] failed to log event', params.eventType, error.message);
    }
  } catch (err: any) {
    console.warn('[runtimeLogs] unexpected error logging event', params.eventType, err?.message);
  }
}

export interface RuntimeLogRow {
  id: string;
  tenant_id: string;
  user_id: string;
  profile_key: string | null;
  event_type: RuntimeLogEventType;
  guard_allowed: boolean;
  fallback_used: boolean;
  fallback_reason: string | null;
  load_ms: number | null;
  error_message: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export async function fetchRuntimeLogs(tenantId: string, limit = 50): Promise<RuntimeLogRow[]> {
  const { data, error } = await (supabase as any)
    .from('crm_dynamic_dashboard_runtime_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[runtimeLogs] fetch failed', error.message);
    return [];
  }
  return (data ?? []) as RuntimeLogRow[];
}

export interface RuntimeStats {
  lastAllowedAt: string | null;
  totals: Record<string, number>;
  avgLoadMs: number | null;
  maxLoadMs: number | null;
}

export async function fetchRuntimeStats(tenantId: string, userId?: string): Promise<RuntimeStats> {
  let q = (supabase as any)
    .from('crm_dynamic_dashboard_runtime_logs')
    .select('event_type, load_ms, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  if (userId) q = q.eq('user_id', userId);

  const { data, error } = await q;
  if (error || !data) {
    return { lastAllowedAt: null, totals: {}, avgLoadMs: null, maxLoadMs: null };
  }
  const rows = data as Array<{ event_type: string; load_ms: number | null; created_at: string }>;
  const totals: Record<string, number> = {};
  let lastAllowedAt: string | null = null;
  const loadValues: number[] = [];
  for (const r of rows) {
    totals[r.event_type] = (totals[r.event_type] ?? 0) + 1;
    if (r.event_type === 'runtime_allowed') {
      if (!lastAllowedAt || r.created_at > lastAllowedAt) lastAllowedAt = r.created_at;
      if (r.load_ms != null) loadValues.push(r.load_ms);
    }
  }
  const avgLoadMs = loadValues.length
    ? Math.round(loadValues.reduce((a, b) => a + b, 0) / loadValues.length)
    : null;
  const maxLoadMs = loadValues.length ? Math.max(...loadValues) : null;
  return { lastAllowedAt, totals, avgLoadMs, maxLoadMs };
}
