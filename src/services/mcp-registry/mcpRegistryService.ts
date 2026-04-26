import { supabase } from '@/integrations/supabase/client';
import type {
  McpServer,
  McpTool,
  McpResource,
  McpPrompt,
  McpRegistrySettings,
  McpOverviewMetrics,
  McpAuditAction,
  McpAuditEntityType,
  McpStatus,
} from './types';

// ----- Helpers -----

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function asJson<T extends Record<string, unknown>>(v: unknown): T {
  if (v && typeof v === 'object') return v as T;
  return {} as T;
}

// ----- Audit -----

interface LogAuditInput {
  organizationId: string | null;
  entityType: McpAuditEntityType;
  entityId: string;
  action: McpAuditAction;
  beforeJson?: Record<string, unknown> | null;
  afterJson?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

export async function logMcpAudit(input: LogAuditInput): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    // Auditoria silenciosa: sem usuário, não registra
    console.warn('[mcp_log_audit] sem usuário autenticado; pulando');
    return;
  }
  try {
    const { error } = await supabase.rpc('mcp_log_audit', {
      p_action: input.action,
      p_entity_type: input.entityType,
      p_entity_id: input.entityId,
      p_organization_id: input.organizationId ?? undefined,
      p_user_id: userId,
      p_after_json: (input.afterJson ?? null) as never,
      p_before_json: (input.beforeJson ?? null) as never,
      p_metadata: {
        source: 'mcp_registry_ui',
        area: 'noid_intelligence',
        ...(input.metadata ?? {}),
      } as never,
    });
    if (error) {
      console.warn('[mcp_log_audit] falha:', error.message);
    }
  } catch (e) {
    console.warn('[mcp_log_audit] exceção:', e);
  }
}

// ===================== SERVERS =====================

export interface ServerFilters {
  status?: string;
  server_type?: string;
  transport_type?: string;
  risk_level?: string;
  scope?: 'all' | 'global' | 'org';
}

export async function listMcpServers(orgId: string, filters: ServerFilters = {}): Promise<McpServer[]> {
  let q = supabase.from('mcp_servers').select('*').order('created_at', { ascending: false });
  if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
  if (filters.server_type && filters.server_type !== 'all') q = q.eq('server_type', filters.server_type);
  if (filters.transport_type && filters.transport_type !== 'all') q = q.eq('transport_type', filters.transport_type);
  if (filters.risk_level && filters.risk_level !== 'all') q = q.eq('risk_level', filters.risk_level);
  if (filters.scope === 'global') q = q.is('organization_id', null);
  if (filters.scope === 'org') q = q.eq('organization_id', orgId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    metadata: asJson(r.metadata),
  })) as McpServer[];
}

export type CreateMcpServerInput = Omit<McpServer, 'id' | 'created_at' | 'updated_at' | 'organization_id'>;
export type UpdateMcpServerInput = Partial<CreateMcpServerInput>;

export async function createMcpServer(orgId: string, input: CreateMcpServerInput): Promise<McpServer> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('mcp_servers')
    .insert({
      ...input,
      organization_id: orgId,
      created_by: userId,
      updated_by: userId,
    } as never)
    .select('*')
    .single();
  if (error) throw error;
  const row = { ...data, metadata: asJson(data.metadata) } as McpServer;
  await logMcpAudit({
    organizationId: orgId,
    entityType: 'mcp_server',
    entityId: row.id,
    action: 'created',
    afterJson: row as unknown as Record<string, unknown>,
  });
  return row;
}

export async function updateMcpServer(id: string, input: UpdateMcpServerInput): Promise<McpServer> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('mcp_servers')
    .update({ ...input, updated_by: userId } as never)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  const row = { ...data, metadata: asJson(data.metadata) } as McpServer;
  await logMcpAudit({
    organizationId: row.organization_id,
    entityType: 'mcp_server',
    entityId: row.id,
    action: 'updated',
    afterJson: row as unknown as Record<string, unknown>,
  });
  return row;
}

export async function setMcpServerStatus(id: string, status: McpStatus): Promise<McpServer> {
  const action: McpAuditAction =
    status === 'active' ? 'activated' : status === 'inactive' ? 'deactivated' : status === 'archived' ? 'archived' : 'updated';
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('mcp_servers')
    .update({ status, updated_by: userId } as never)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  const row = { ...data, metadata: asJson(data.metadata) } as McpServer;
  await logMcpAudit({
    organizationId: row.organization_id,
    entityType: 'mcp_server',
    entityId: row.id,
    action,
    afterJson: row as unknown as Record<string, unknown>,
  });
  return row;
}

// ===================== TOOLS =====================

export interface ToolFilters {
  server_id?: string;
  category?: string;
  execution_mode?: string;
  risk_level?: string;
  is_enabled?: 'all' | 'true' | 'false';
  requires_approval?: 'all' | 'true' | 'false';
  scope?: 'all' | 'global' | 'org';
}

export async function listMcpTools(orgId: string, filters: ToolFilters = {}): Promise<McpTool[]> {
  let q = supabase.from('mcp_tools').select('*').order('created_at', { ascending: false });
  if (filters.server_id && filters.server_id !== 'all') q = q.eq('server_id', filters.server_id);
  if (filters.category && filters.category !== 'all') q = q.eq('category', filters.category);
  if (filters.execution_mode && filters.execution_mode !== 'all') q = q.eq('execution_mode', filters.execution_mode);
  if (filters.risk_level && filters.risk_level !== 'all') q = q.eq('risk_level', filters.risk_level);
  if (filters.is_enabled && filters.is_enabled !== 'all') q = q.eq('is_enabled', filters.is_enabled === 'true');
  if (filters.requires_approval && filters.requires_approval !== 'all')
    q = q.eq('requires_approval', filters.requires_approval === 'true');
  if (filters.scope === 'global') q = q.is('organization_id', null);
  if (filters.scope === 'org') q = q.eq('organization_id', orgId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    input_schema: asJson(r.input_schema),
    output_schema: asJson(r.output_schema),
    metadata: asJson(r.metadata),
  })) as McpTool[];
}

export type CreateMcpToolInput = Omit<McpTool, 'id' | 'created_at' | 'updated_at' | 'organization_id'>;
export type UpdateMcpToolInput = Partial<CreateMcpToolInput>;

export async function createMcpTool(orgId: string, input: CreateMcpToolInput): Promise<McpTool> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('mcp_tools')
    .insert({
      ...input,
      organization_id: orgId,
      // Tools novas SEMPRE nascem desabilitadas
      is_enabled: false,
      created_by: userId,
      updated_by: userId,
    } as never)
    .select('*')
    .single();
  if (error) throw error;
  const row = {
    ...data,
    input_schema: asJson(data.input_schema),
    output_schema: asJson(data.output_schema),
    metadata: asJson(data.metadata),
  } as McpTool;
  await logMcpAudit({
    organizationId: orgId,
    entityType: 'mcp_tool',
    entityId: row.id,
    action: 'created',
    afterJson: row as unknown as Record<string, unknown>,
  });
  return row;
}

export async function updateMcpTool(id: string, input: UpdateMcpToolInput): Promise<McpTool> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('mcp_tools')
    .update({ ...input, updated_by: userId } as never)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  const row = {
    ...data,
    input_schema: asJson(data.input_schema),
    output_schema: asJson(data.output_schema),
    metadata: asJson(data.metadata),
  } as McpTool;
  await logMcpAudit({
    organizationId: row.organization_id,
    entityType: 'mcp_tool',
    entityId: row.id,
    action: 'updated',
    afterJson: row as unknown as Record<string, unknown>,
  });
  return row;
}

export async function toggleMcpTool(id: string, enabled: boolean): Promise<McpTool> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('mcp_tools')
    .update({ is_enabled: enabled, updated_by: userId } as never)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  const row = {
    ...data,
    input_schema: asJson(data.input_schema),
    output_schema: asJson(data.output_schema),
    metadata: asJson(data.metadata),
  } as McpTool;
  await logMcpAudit({
    organizationId: row.organization_id,
    entityType: 'mcp_tool',
    entityId: row.id,
    action: enabled ? 'enabled' : 'disabled',
    afterJson: row as unknown as Record<string, unknown>,
  });
  return row;
}

// ===================== RESOURCES =====================

export interface ResourceFilters {
  resource_type?: string;
  read_scope?: string;
  risk_level?: string;
  is_enabled?: 'all' | 'true' | 'false';
  scope?: 'all' | 'global' | 'org';
}

export async function listMcpResources(orgId: string, filters: ResourceFilters = {}): Promise<McpResource[]> {
  let q = supabase.from('mcp_resources').select('*').order('created_at', { ascending: false });
  if (filters.resource_type && filters.resource_type !== 'all') q = q.eq('resource_type', filters.resource_type);
  if (filters.read_scope && filters.read_scope !== 'all') q = q.eq('read_scope', filters.read_scope);
  if (filters.risk_level && filters.risk_level !== 'all') q = q.eq('risk_level', filters.risk_level);
  if (filters.is_enabled && filters.is_enabled !== 'all') q = q.eq('is_enabled', filters.is_enabled === 'true');
  if (filters.scope === 'global') q = q.is('organization_id', null);
  if (filters.scope === 'org') q = q.eq('organization_id', orgId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, metadata: asJson(r.metadata) })) as McpResource[];
}

export type CreateMcpResourceInput = Omit<McpResource, 'id' | 'created_at' | 'updated_at' | 'organization_id'>;
export type UpdateMcpResourceInput = Partial<CreateMcpResourceInput>;

export async function createMcpResource(orgId: string, input: CreateMcpResourceInput): Promise<McpResource> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('mcp_resources')
    .insert({
      ...input,
      organization_id: orgId,
      is_enabled: false,
      created_by: userId,
      updated_by: userId,
    } as never)
    .select('*')
    .single();
  if (error) throw error;
  const row = { ...data, metadata: asJson(data.metadata) } as McpResource;
  await logMcpAudit({
    organizationId: orgId,
    entityType: 'mcp_resource',
    entityId: row.id,
    action: 'created',
    afterJson: row as unknown as Record<string, unknown>,
  });
  return row;
}

export async function updateMcpResource(id: string, input: UpdateMcpResourceInput): Promise<McpResource> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('mcp_resources')
    .update({ ...input, updated_by: userId } as never)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  const row = { ...data, metadata: asJson(data.metadata) } as McpResource;
  await logMcpAudit({
    organizationId: row.organization_id,
    entityType: 'mcp_resource',
    entityId: row.id,
    action: 'updated',
    afterJson: row as unknown as Record<string, unknown>,
  });
  return row;
}

export async function toggleMcpResource(id: string, enabled: boolean): Promise<McpResource> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('mcp_resources')
    .update({ is_enabled: enabled, updated_by: userId } as never)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  const row = { ...data, metadata: asJson(data.metadata) } as McpResource;
  await logMcpAudit({
    organizationId: row.organization_id,
    entityType: 'mcp_resource',
    entityId: row.id,
    action: enabled ? 'enabled' : 'disabled',
    afterJson: row as unknown as Record<string, unknown>,
  });
  return row;
}

// ===================== PROMPTS =====================

export interface PromptFilters {
  prompt_type?: string;
  status?: string;
  version?: string;
  scope?: 'all' | 'global' | 'org';
}

export async function listMcpPrompts(orgId: string, filters: PromptFilters = {}): Promise<McpPrompt[]> {
  let q = supabase.from('mcp_prompts').select('*').order('created_at', { ascending: false });
  if (filters.prompt_type && filters.prompt_type !== 'all') q = q.eq('prompt_type', filters.prompt_type);
  if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
  if (filters.version && filters.version !== 'all') q = q.eq('version', Number(filters.version));
  if (filters.scope === 'global') q = q.is('organization_id', null);
  if (filters.scope === 'org') q = q.eq('organization_id', orgId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    metadata: asJson(r.metadata),
    variables: Array.isArray(r.variables) ? (r.variables as unknown[]) : [],
  })) as McpPrompt[];
}

export type CreateMcpPromptInput = Omit<McpPrompt, 'id' | 'created_at' | 'updated_at' | 'organization_id'>;
export type UpdateMcpPromptInput = Partial<CreateMcpPromptInput>;

export async function createMcpPrompt(orgId: string, input: CreateMcpPromptInput): Promise<McpPrompt> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('mcp_prompts')
    .insert({
      ...input,
      organization_id: orgId,
      // Prompts novos SEMPRE nascem em draft
      status: 'draft',
      created_by: userId,
      updated_by: userId,
    } as never)
    .select('*')
    .single();
  if (error) throw error;
  const row = {
    ...data,
    metadata: asJson(data.metadata),
    variables: Array.isArray(data.variables) ? (data.variables as unknown[]) : [],
  } as McpPrompt;
  await logMcpAudit({
    organizationId: orgId,
    entityType: 'mcp_prompt',
    entityId: row.id,
    action: 'created',
    afterJson: row as unknown as Record<string, unknown>,
  });
  return row;
}

export async function updateMcpPrompt(id: string, input: UpdateMcpPromptInput): Promise<McpPrompt> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('mcp_prompts')
    .update({ ...input, updated_by: userId } as never)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  const row = {
    ...data,
    metadata: asJson(data.metadata),
    variables: Array.isArray(data.variables) ? (data.variables as unknown[]) : [],
  } as McpPrompt;
  await logMcpAudit({
    organizationId: row.organization_id,
    entityType: 'mcp_prompt',
    entityId: row.id,
    action: 'updated',
    afterJson: row as unknown as Record<string, unknown>,
  });
  return row;
}

export async function setMcpPromptStatus(id: string, status: McpStatus): Promise<McpPrompt> {
  const action: McpAuditAction =
    status === 'active' ? 'activated' : status === 'inactive' ? 'deactivated' : status === 'archived' ? 'archived' : 'updated';
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('mcp_prompts')
    .update({ status, updated_by: userId } as never)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  const row = {
    ...data,
    metadata: asJson(data.metadata),
    variables: Array.isArray(data.variables) ? (data.variables as unknown[]) : [],
  } as McpPrompt;
  await logMcpAudit({
    organizationId: row.organization_id,
    entityType: 'mcp_prompt',
    entityId: row.id,
    action,
    afterJson: row as unknown as Record<string, unknown>,
  });
  return row;
}

// ===================== SETTINGS =====================

export async function getMcpSettings(orgId: string): Promise<McpRegistrySettings | null> {
  const { data, error } = await supabase
    .from('mcp_registry_settings')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, metadata: asJson(data.metadata) } as McpRegistrySettings;
}

export async function createMcpSettingsIfMissing(orgId: string): Promise<McpRegistrySettings> {
  const existing = await getMcpSettings(orgId);
  if (existing) return existing;
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('mcp_registry_settings')
    .insert({
      organization_id: orgId,
      is_mcp_enabled: false,
      allow_external_servers: false,
      default_requires_approval: true,
      default_daily_call_limit: 100,
      log_retention_days: 180,
      metadata: { source: 'mcp_registry_ui', area: 'noid_intelligence' },
      created_by: userId,
      updated_by: userId,
    } as never)
    .select('*')
    .single();
  if (error) throw error;
  const row = { ...data, metadata: asJson(data.metadata) } as McpRegistrySettings;
  await logMcpAudit({
    organizationId: orgId,
    entityType: 'mcp_registry_settings',
    entityId: row.id,
    action: 'created',
    afterJson: row as unknown as Record<string, unknown>,
  });
  return row;
}

export interface UpdateMcpSettingsInput {
  is_mcp_enabled?: boolean;
  allow_external_servers?: boolean;
  default_requires_approval?: boolean;
  default_daily_call_limit?: number;
  log_retention_days?: number;
  metadata?: Record<string, unknown>;
}

export async function updateMcpSettings(id: string, input: UpdateMcpSettingsInput): Promise<McpRegistrySettings> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('mcp_registry_settings')
    .update({ ...input, updated_by: userId } as never)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  const row = { ...data, metadata: asJson(data.metadata) } as McpRegistrySettings;
  await logMcpAudit({
    organizationId: row.organization_id,
    entityType: 'mcp_registry_settings',
    entityId: row.id,
    action: 'updated',
    afterJson: row as unknown as Record<string, unknown>,
  });
  return row;
}

// ===================== OVERVIEW METRICS =====================

async function countWhere(
  table: 'mcp_servers' | 'mcp_tools' | 'mcp_resources' | 'mcp_prompts',
  filterFn?: (q: ReturnType<typeof supabase.from>) => unknown,
): Promise<number> {
  let q = supabase.from(table).select('id', { count: 'exact', head: true });
  if (filterFn) q = filterFn(q as never) as never;
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function getMcpOverviewMetrics(_orgId: string): Promise<McpOverviewMetrics> {
  // RLS já filtra para escopo permitido (org + globais).
  const [
    serversTotal,
    serversActive,
    serversDraft,
    serversInactive,
    serversArchived,
    toolsTotal,
    toolsEnabled,
    toolsDisabled,
    resourcesTotal,
    resourcesEnabled,
    resourcesDisabled,
    promptsTotal,
    promptsActive,
    promptsDraft,
    promptsArchived,
  ] = await Promise.all([
    countWhere('mcp_servers'),
    countWhere('mcp_servers', (q) => (q as never as { eq: (a: string, b: string) => unknown }).eq('status', 'active')),
    countWhere('mcp_servers', (q) => (q as never as { eq: (a: string, b: string) => unknown }).eq('status', 'draft')),
    countWhere('mcp_servers', (q) => (q as never as { eq: (a: string, b: string) => unknown }).eq('status', 'inactive')),
    countWhere('mcp_servers', (q) => (q as never as { eq: (a: string, b: string) => unknown }).eq('status', 'archived')),
    countWhere('mcp_tools'),
    countWhere('mcp_tools', (q) => (q as never as { eq: (a: string, b: boolean) => unknown }).eq('is_enabled', true)),
    countWhere('mcp_tools', (q) => (q as never as { eq: (a: string, b: boolean) => unknown }).eq('is_enabled', false)),
    countWhere('mcp_resources'),
    countWhere('mcp_resources', (q) => (q as never as { eq: (a: string, b: boolean) => unknown }).eq('is_enabled', true)),
    countWhere('mcp_resources', (q) => (q as never as { eq: (a: string, b: boolean) => unknown }).eq('is_enabled', false)),
    countWhere('mcp_prompts'),
    countWhere('mcp_prompts', (q) => (q as never as { eq: (a: string, b: string) => unknown }).eq('status', 'active')),
    countWhere('mcp_prompts', (q) => (q as never as { eq: (a: string, b: string) => unknown }).eq('status', 'draft')),
    countWhere('mcp_prompts', (q) => (q as never as { eq: (a: string, b: string) => unknown }).eq('status', 'archived')),
  ]);
  return {
    servers: { total: serversTotal, active: serversActive, draft: serversDraft, inactive: serversInactive, archived: serversArchived },
    tools: { total: toolsTotal, enabled: toolsEnabled, disabled: toolsDisabled },
    resources: { total: resourcesTotal, enabled: resourcesEnabled, disabled: resourcesDisabled },
    prompts: { total: promptsTotal, active: promptsActive, draft: promptsDraft, archived: promptsArchived },
  };
}
