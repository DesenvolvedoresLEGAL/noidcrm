// MCP Audit Logs service — Sprint 1.5 (read-only)
import { supabase } from '@/integrations/supabase/client';
import type { McpAuditLog, McpAuditMetrics, McpAuditAction, McpAuditEntityType } from './types';

function asJson<T extends Record<string, unknown>>(v: unknown): T {
  if (v && typeof v === 'object') return v as T;
  return {} as T;
}

function asNullableJson(v: unknown): Record<string, unknown> | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return v as Record<string, unknown>;
  return null;
}

function mapAudit(r: Record<string, unknown>): McpAuditLog {
  return {
    id: r.id as string,
    organization_id: (r.organization_id as string | null) ?? null,
    user_id: (r.user_id as string | null) ?? null,
    agent_id: (r.agent_id as string | null) ?? null,
    entity_type: r.entity_type as string,
    entity_id: (r.entity_id as string | null) ?? null,
    action: r.action as string,
    before_json: asNullableJson(r.before_json),
    after_json: asNullableJson(r.after_json),
    metadata: asJson(r.metadata),
    ip_address: (r.ip_address as string | null) ?? null,
    user_agent: (r.user_agent as string | null) ?? null,
    created_at: r.created_at as string,
  };
}

export interface AuditLogFilters {
  date_from?: string | null;
  date_to?: string | null;
  entity_type?: McpAuditEntityType | string | 'all';
  action?: McpAuditAction | string | 'all';
  user_id?: string;
  agent_id?: string;
  sprint?: string;
  source?: string;
  area?: string;
  limit?: number;
}

export async function listMcpAuditLogs(
  orgId: string,
  filters: AuditLogFilters = {},
): Promise<McpAuditLog[]> {
  // RLS já restringe a admins da org + platform_admin
  let q = supabase
    .from('mcp_audit_logs')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 200);

  if (filters.date_from) q = q.gte('created_at', filters.date_from);
  if (filters.date_to) q = q.lte('created_at', filters.date_to);
  if (filters.entity_type && filters.entity_type !== 'all') q = q.eq('entity_type', filters.entity_type);
  if (filters.action && filters.action !== 'all') q = q.eq('action', filters.action);
  if (filters.user_id && filters.user_id !== 'all') q = q.eq('user_id', filters.user_id);
  if (filters.agent_id && filters.agent_id !== 'all') q = q.eq('agent_id', filters.agent_id);
  if (filters.sprint) q = q.eq('metadata->>sprint', filters.sprint);
  if (filters.source) q = q.eq('metadata->>source', filters.source);
  if (filters.area) q = q.eq('metadata->>area', filters.area);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => mapAudit(r as Record<string, unknown>));
}

export async function getMcpAuditLogById(id: string): Promise<McpAuditLog | null> {
  const { data, error } = await supabase
    .from('mcp_audit_logs')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapAudit(data as Record<string, unknown>);
}

async function countAudit(
  orgId: string,
  apply?: (q: ReturnType<typeof supabase.from>) => unknown,
): Promise<number> {
  let q = supabase
    .from('mcp_audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId);
  if (apply) q = apply(q as never) as never;
  const { count, error } = await q;
  if (error) {
    console.warn('[countAudit]', error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getMcpAuditMetrics(orgId: string): Promise<McpAuditMetrics> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    total,
    last24h,
    last7d,
    permissionEvents,
    invocationEvents,
    settingsEvents,
    seedCreated,
    seedVerified,
    blockedEvents,
  ] = await Promise.all([
    countAudit(orgId),
    countAudit(orgId, (q) =>
      (q as never as { gte: (a: string, b: string) => unknown }).gte('created_at', since24h),
    ),
    countAudit(orgId, (q) =>
      (q as never as { gte: (a: string, b: string) => unknown }).gte('created_at', since7d),
    ),
    countAudit(orgId, (q) =>
      (q as never as { eq: (a: string, b: string) => unknown }).eq('entity_type', 'mcp_permission'),
    ),
    countAudit(orgId, (q) =>
      (q as never as { eq: (a: string, b: string) => unknown }).eq('entity_type', 'mcp_invocation'),
    ),
    countAudit(orgId, (q) =>
      (q as never as { eq: (a: string, b: string) => unknown }).eq('entity_type', 'mcp_registry_settings'),
    ),
    countAudit(orgId, (q) =>
      (q as never as { eq: (a: string, b: string) => unknown }).eq('action', 'system_seed_created'),
    ),
    countAudit(orgId, (q) =>
      (q as never as { eq: (a: string, b: string) => unknown }).eq('action', 'system_seed_verified'),
    ),
    countAudit(orgId, (q) =>
      (q as never as { eq: (a: string, b: string) => unknown }).eq('action', 'blocked_invocation'),
    ),
  ]);

  // Último evento
  let lastEventAt: string | null = null;
  try {
    const { data } = await supabase
      .from('mcp_audit_logs')
      .select('created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    lastEventAt = (data?.created_at as string | null) ?? null;
  } catch {
    lastEventAt = null;
  }

  return {
    total,
    last_24h: last24h,
    last_7d: last7d,
    permission_events: permissionEvents,
    invocation_events: invocationEvents,
    settings_events: settingsEvents,
    seed_events: seedCreated + seedVerified,
    blocked_events: blockedEvents,
    last_event_at: lastEventAt,
  };
}
