// MCP Permissions — Sprint 1.4
import { supabase } from '@/integrations/supabase/client';
import type {
  McpPermission,
  McpPermissionAction,
  McpPermissionMetrics,
  McpPermissionStatus,
  CheckPermissionResult,
} from './types';

function asObject<T extends Record<string, unknown>>(v: unknown): T {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as T;
  return {} as T;
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function normalize(row: Record<string, unknown>): McpPermission {
  return {
    ...(row as object),
    metadata: asObject(row.metadata),
    allowed_scopes: asArray(row.allowed_scopes),
  } as McpPermission;
}

// ----- Filters -----
export interface McpPermissionFilters {
  status?: 'all' | McpPermissionStatus;
  target_type?: 'all' | 'agent' | 'user' | 'role';
  object_type?: 'all' | 'tool' | 'resource' | 'prompt';
  can_read?: 'all' | 'true' | 'false';
  can_suggest?: 'all' | 'true' | 'false';
  can_execute?: 'all' | 'true' | 'false';
  requires_approval?: 'all' | 'true' | 'false';
}

// ----- LIST -----
export async function listMcpPermissions(
  orgId: string,
  filters: McpPermissionFilters = {},
): Promise<McpPermission[]> {
  let q = supabase
    .from('mcp_permissions')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);

  if (filters.target_type === 'agent') q = q.not('agent_id', 'is', null);
  if (filters.target_type === 'user') q = q.not('user_id', 'is', null);
  if (filters.target_type === 'role') q = q.not('role_name', 'is', null);

  if (filters.object_type === 'tool') q = q.not('tool_id', 'is', null);
  if (filters.object_type === 'resource') q = q.not('resource_id', 'is', null);
  if (filters.object_type === 'prompt') q = q.not('prompt_id', 'is', null);

  if (filters.can_read && filters.can_read !== 'all') q = q.eq('can_read', filters.can_read === 'true');
  if (filters.can_suggest && filters.can_suggest !== 'all') q = q.eq('can_suggest', filters.can_suggest === 'true');
  if (filters.can_execute && filters.can_execute !== 'all') q = q.eq('can_execute', filters.can_execute === 'true');
  if (filters.requires_approval && filters.requires_approval !== 'all')
    q = q.eq('requires_approval', filters.requires_approval === 'true');

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

// ----- CREATE -----
export interface CreateMcpPermissionInput {
  agent_id?: string | null;
  user_id?: string | null;
  role_name?: string | null;
  tool_id?: string | null;
  resource_id?: string | null;
  prompt_id?: string | null;
  can_read?: boolean;
  can_suggest?: boolean;
  can_execute?: boolean;
  requires_approval?: boolean;
  max_calls_per_day?: number | null;
  allowed_scopes?: unknown[];
  status?: McpPermissionStatus;
  metadata?: Record<string, unknown>;
}

export async function createMcpPermission(
  orgId: string,
  input: CreateMcpPermissionInput,
): Promise<string> {
  const { data, error } = await supabase.rpc('mcp_create_permission', {
    p_organization_id: orgId,
    p_agent_id: input.agent_id ?? null,
    p_user_id: input.user_id ?? null,
    p_role_name: input.role_name ?? null,
    p_tool_id: input.tool_id ?? null,
    p_resource_id: input.resource_id ?? null,
    p_prompt_id: input.prompt_id ?? null,
    p_can_read: !!input.can_read,
    p_can_suggest: !!input.can_suggest,
    p_can_execute: !!input.can_execute,
    p_requires_approval: input.requires_approval ?? true,
    p_max_calls_per_day: input.max_calls_per_day ?? null,
    p_allowed_scopes: (input.allowed_scopes ?? []) as never,
    p_status: input.status ?? 'active',
    p_metadata: (input.metadata ?? {}) as never,
  });
  if (error) throw error;
  return data as string;
}

// ----- UPDATE -----
export interface UpdateMcpPermissionInput {
  can_read?: boolean | null;
  can_suggest?: boolean | null;
  can_execute?: boolean | null;
  requires_approval?: boolean | null;
  max_calls_per_day?: number | null;
  allowed_scopes?: unknown[] | null;
  status?: McpPermissionStatus | null;
  metadata?: Record<string, unknown> | null;
}

export async function updateMcpPermission(
  id: string,
  input: UpdateMcpPermissionInput,
): Promise<string> {
  const { data, error } = await supabase.rpc('mcp_update_permission', {
    p_permission_id: id,
    p_can_read: input.can_read ?? null,
    p_can_suggest: input.can_suggest ?? null,
    p_can_execute: input.can_execute ?? null,
    p_requires_approval: input.requires_approval ?? null,
    p_max_calls_per_day: input.max_calls_per_day ?? null,
    p_allowed_scopes: (input.allowed_scopes ?? null) as never,
    p_status: input.status ?? null,
    p_metadata: (input.metadata ?? null) as never,
  });
  if (error) throw error;
  return data as string;
}

// ----- STATUS -----
export async function setMcpPermissionStatus(
  id: string,
  status: McpPermissionStatus,
): Promise<string> {
  const { data, error } = await supabase.rpc('mcp_set_permission_status', {
    p_permission_id: id,
    p_status: status,
  });
  if (error) throw error;
  return data as string;
}

export const archiveMcpPermission = (id: string) => setMcpPermissionStatus(id, 'archived');

// ----- TEST (check_mcp_permission) -----
export interface TestPermissionInput {
  organization_id: string;
  agent_id?: string | null;
  user_id?: string | null;
  role_name?: string | null;
  tool_id?: string | null;
  resource_id?: string | null;
  prompt_id?: string | null;
  action: McpPermissionAction;
}

export async function testMcpPermission(input: TestPermissionInput): Promise<CheckPermissionResult> {
  const { data, error } = await supabase.rpc('check_mcp_permission', {
    p_organization_id: input.organization_id,
    p_action: input.action,
    p_agent_id: input.agent_id ?? null,
    p_user_id: input.user_id ?? null,
    p_role_name: input.role_name ?? null,
    p_tool_id: input.tool_id ?? null,
    p_resource_id: input.resource_id ?? null,
    p_prompt_id: input.prompt_id ?? null,
  });
  if (error) throw error;
  // RPC retorna jsonb { allowed, requires_approval, reason }
  const obj = (data ?? {}) as Partial<CheckPermissionResult>;
  return {
    allowed: !!obj.allowed,
    requires_approval: !!obj.requires_approval,
    reason: obj.reason ?? '',
  };
}

// ----- METRICS -----
export async function getMcpPermissionMetrics(orgId: string): Promise<McpPermissionMetrics> {
  const { data, error } = await supabase
    .from('mcp_permissions')
    .select('agent_id,user_id,role_name,can_execute,requires_approval,status')
    .eq('organization_id', orgId);
  if (error) throw error;
  const rows = data ?? [];
  return {
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    inactive: rows.filter((r) => r.status === 'inactive').length,
    archived: rows.filter((r) => r.status === 'archived').length,
    by_agent: rows.filter((r) => r.agent_id).length,
    by_user: rows.filter((r) => r.user_id).length,
    by_role: rows.filter((r) => r.role_name).length,
    with_execute: rows.filter((r) => r.can_execute).length,
    with_approval: rows.filter((r) => r.requires_approval).length,
  };
}

// ----- AGENTS / USERS / ROLES helpers -----
export interface AgentLite {
  id: string;
  name: string;
  slug: string | null;
  status: string | null;
}

export async function listAiAgentsForPermissions(orgId: string): Promise<AgentLite[]> {
  const { data, error } = await supabase
    .from('ai_agents')
    .select('id,name,slug,status')
    .eq('organization_id', orgId)
    .order('name');
  if (error) {
    // Tabela existe mas pode estar vazia/sem permissão; não bloqueia UI
    console.warn('[listAiAgentsForPermissions]', error.message);
    return [];
  }
  return (data ?? []) as AgentLite[];
}

export interface UserLite {
  user_id: string;
  full_name: string | null;
}

export async function listUsersForPermissions(orgId: string): Promise<UserLite[]> {
  const { data: members, error } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId);
  if (error) {
    console.warn('[listUsersForPermissions]', error.message);
    return [];
  }
  const ids = (members ?? []).map((m) => m.user_id);
  if (ids.length === 0) return [];
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', ids);
  if (pErr) {
    console.warn('[listUsersForPermissions:profiles]', pErr.message);
    return ids.map((id) => ({ user_id: id, full_name: null }));
  }
  const byId = new Map((profiles ?? []).map((p) => [p.id, p.full_name as string | null]));
  return ids.map((id) => ({ user_id: id, full_name: byId.get(id) ?? null }));
}

export const MCP_ROLE_SUGGESTIONS = [
  { value: 'founder', label: 'Founder' },
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'technical_admin', label: 'Technical admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'sales', label: 'Sales' },
  { value: 'pre_sales', label: 'Pre-sales' },
  { value: 'support', label: 'Support' },
];
