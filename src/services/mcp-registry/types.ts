// MCP Registry — frontend types

export type McpServerType = 'internal' | 'external';
export type McpTransportType = 'http' | 'stdio' | 'sse';
export type McpStatus = 'draft' | 'active' | 'inactive' | 'archived';
export type McpAuthType = 'none' | 'api_key' | 'oauth' | 'service_role';
export type McpRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type McpExecutionMode =
  | 'read_only'
  | 'suggestion_only'
  | 'approval_required'
  | 'automatic_controlled';
export type McpResourceType =
  | 'crm'
  | 'sales'
  | 'proposal'
  | 'activity'
  | 'report'
  | 'playbook'
  | 'tenant'
  | 'user'
  | 'external';
export type McpReadScope =
  | 'public'
  | 'tenant'
  | 'owner'
  | 'role_based'
  | 'admin_only';
export type McpPromptType =
  | 'template'
  | 'system'
  | 'agent_instruction'
  | 'workflow'
  | 'sales_script'
  | 'objection_handling'
  | 'analysis';

export interface McpServer {
  id: string;
  organization_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  server_type: McpServerType;
  transport_type: McpTransportType;
  base_url: string | null;
  status: McpStatus;
  auth_type: McpAuthType;
  risk_level: McpRiskLevel;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface McpTool {
  id: string;
  organization_id: string | null;
  server_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  risk_level: McpRiskLevel;
  execution_mode: McpExecutionMode;
  requires_approval: boolean;
  is_enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface McpResource {
  id: string;
  organization_id: string | null;
  server_id: string | null;
  name: string;
  uri_pattern: string;
  description: string | null;
  resource_type: McpResourceType;
  read_scope: McpReadScope;
  risk_level: McpRiskLevel;
  is_enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface McpPrompt {
  id: string;
  organization_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  prompt_type: McpPromptType;
  content: string;
  variables: unknown[];
  version: number;
  status: McpStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface McpRegistrySettings {
  id: string;
  organization_id: string;
  is_mcp_enabled: boolean;
  allow_external_servers: boolean;
  default_requires_approval: boolean;
  default_daily_call_limit: number;
  log_retention_days: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface McpOverviewMetrics {
  servers: { total: number; active: number; draft: number; inactive: number; archived: number };
  tools: { total: number; enabled: number; disabled: number };
  resources: { total: number; enabled: number; disabled: number };
  prompts: { total: number; active: number; draft: number; archived: number };
}

export type McpAuditAction =
  | 'created'
  | 'updated'
  | 'enabled'
  | 'disabled'
  | 'activated'
  | 'deactivated'
  | 'archived';

export type McpAuditEntityType =
  | 'mcp_server'
  | 'mcp_tool'
  | 'mcp_resource'
  | 'mcp_prompt'
  | 'mcp_registry_settings'
  | 'mcp_permission';

// ===================== PERMISSIONS (Sprint 1.4) =====================

export type McpPermissionStatus = 'active' | 'inactive' | 'archived';
export type McpPermissionAction = 'read' | 'suggest' | 'execute';
export type McpPermissionTargetType = 'agent' | 'user' | 'role';
export type McpPermissionObjectType = 'tool' | 'resource' | 'prompt';

export interface McpPermission {
  id: string;
  organization_id: string;
  agent_id: string | null;
  user_id: string | null;
  role_name: string | null;
  tool_id: string | null;
  resource_id: string | null;
  prompt_id: string | null;
  can_read: boolean;
  can_suggest: boolean;
  can_execute: boolean;
  requires_approval: boolean;
  max_calls_per_day: number | null;
  allowed_scopes: unknown[];
  status: McpPermissionStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface McpPermissionMetrics {
  total: number;
  active: number;
  inactive: number;
  archived: number;
  by_agent: number;
  by_user: number;
  by_role: number;
  with_execute: number;
  with_approval: number;
}

export interface CheckPermissionResult {
  allowed: boolean;
  requires_approval: boolean;
  reason: string;
}

export const SERVER_TYPES: McpServerType[] = ['internal', 'external'];
export const TRANSPORT_TYPES: McpTransportType[] = ['http', 'stdio', 'sse'];
export const STATUSES: McpStatus[] = ['draft', 'active', 'inactive', 'archived'];
export const AUTH_TYPES: McpAuthType[] = ['none', 'api_key', 'oauth', 'service_role'];
export const RISK_LEVELS: McpRiskLevel[] = ['low', 'medium', 'high', 'critical'];
export const EXECUTION_MODES: McpExecutionMode[] = [
  'read_only',
  'suggestion_only',
  'approval_required',
  'automatic_controlled',
];
export const RESOURCE_TYPES: McpResourceType[] = [
  'crm',
  'sales',
  'proposal',
  'activity',
  'report',
  'playbook',
  'tenant',
  'user',
  'external',
];
export const READ_SCOPES: McpReadScope[] = [
  'public',
  'tenant',
  'owner',
  'role_based',
  'admin_only',
];
export const PROMPT_TYPES: McpPromptType[] = [
  'template',
  'system',
  'agent_instruction',
  'workflow',
  'sales_script',
  'objection_handling',
  'analysis',
];
