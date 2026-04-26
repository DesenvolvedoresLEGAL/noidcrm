// MCP Invocations service — Sprint 1.5
// Reglas críticas:
//  - Nunca executa tool real
//  - Nunca insere direto em mcp_tool_invocations (RLS bloqueia mesmo)
//  - Sempre via RPC mcp_record_invocation
//  - Nunca passa p_user_id arbitrário (RPC já faz COALESCE com auth.uid())

import { supabase } from '@/integrations/supabase/client';
import type {
  McpToolInvocation,
  McpInvocationMetrics,
  RecordInvocationResult,
  McpInvocationType,
  McpExecutionStatus,
  McpApprovalStatus,
  McpRiskLevel,
  McpExecutionMode,
} from './types';

// ----- Helpers -----

function asJson<T extends Record<string, unknown>>(v: unknown): T {
  if (v && typeof v === 'object') return v as T;
  return {} as T;
}

function asNullableJson(v: unknown): Record<string, unknown> | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return v as Record<string, unknown>;
  return null;
}

function mapInvocation(r: Record<string, unknown>): McpToolInvocation {
  return {
    id: r.id as string,
    organization_id: r.organization_id as string,
    agent_id: (r.agent_id as string | null) ?? null,
    user_id: (r.user_id as string | null) ?? null,
    tool_id: (r.tool_id as string | null) ?? null,
    tool_slug: (r.tool_slug as string | null) ?? null,
    invocation_type: r.invocation_type as McpInvocationType,
    input_json: asJson(r.input_json),
    output_json: asNullableJson(r.output_json),
    risk_level: r.risk_level as McpRiskLevel,
    execution_mode: (r.execution_mode as McpExecutionMode | null) ?? null,
    approval_required: Boolean(r.approval_required),
    approval_status: r.approval_status as McpApprovalStatus,
    execution_status: r.execution_status as McpExecutionStatus,
    error_message: (r.error_message as string | null) ?? null,
    volts_consumed: Number(r.volts_consumed ?? 0),
    started_at: (r.started_at as string | null) ?? null,
    finished_at: (r.finished_at as string | null) ?? null,
    created_at: r.created_at as string,
  };
}

// ----- Filters -----

export interface InvocationFilters {
  date_from?: string | null;
  date_to?: string | null;
  tool_id?: string;
  invocation_type?: McpInvocationType | 'all';
  risk_level?: McpRiskLevel | 'all';
  execution_mode?: McpExecutionMode | 'all';
  approval_status?: McpApprovalStatus | 'all';
  execution_status?: McpExecutionStatus | 'all';
  agent_id?: string;
  user_id?: string;
  limit?: number;
}

// ----- LIST -----

export async function listMcpInvocations(
  orgId: string,
  filters: InvocationFilters = {},
): Promise<McpToolInvocation[]> {
  let q = supabase
    .from('mcp_tool_invocations')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 200);

  if (filters.date_from) q = q.gte('created_at', filters.date_from);
  if (filters.date_to) q = q.lte('created_at', filters.date_to);
  if (filters.tool_id && filters.tool_id !== 'all') q = q.eq('tool_id', filters.tool_id);
  if (filters.invocation_type && filters.invocation_type !== 'all')
    q = q.eq('invocation_type', filters.invocation_type);
  if (filters.risk_level && filters.risk_level !== 'all') q = q.eq('risk_level', filters.risk_level);
  if (filters.execution_mode && filters.execution_mode !== 'all')
    q = q.eq('execution_mode', filters.execution_mode);
  if (filters.approval_status && filters.approval_status !== 'all')
    q = q.eq('approval_status', filters.approval_status);
  if (filters.execution_status && filters.execution_status !== 'all')
    q = q.eq('execution_status', filters.execution_status);
  if (filters.agent_id && filters.agent_id !== 'all') q = q.eq('agent_id', filters.agent_id);
  if (filters.user_id && filters.user_id !== 'all') q = q.eq('user_id', filters.user_id);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => mapInvocation(r as Record<string, unknown>));
}

export async function getMcpInvocationById(id: string): Promise<McpToolInvocation | null> {
  const { data, error } = await supabase
    .from('mcp_tool_invocations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapInvocation(data as Record<string, unknown>);
}

// ----- CREATE SIMULATED -----

export interface CreateSimulatedInvocationInput {
  orgId: string;
  toolId: string;
  agentId?: string | null;
  /**
   * Por defesa em profundidade, não enviamos p_user_id se o admin não
   * selecionou explicitamente um membro da org. A RPC já usa auth.uid()
   * como default.
   */
  userId?: string | null;
  inputJson?: Record<string, unknown> | null;
}

export async function createSimulatedMcpInvocation(
  input: CreateSimulatedInvocationInput,
): Promise<RecordInvocationResult> {
  if (!input.orgId) throw new Error('organization_id é obrigatório');
  if (!input.toolId) throw new Error('Tool é obrigatória para criar simulação');

  const params: Record<string, unknown> = {
    p_organization_id: input.orgId,
    p_tool_id: input.toolId,
    p_input_json: (input.inputJson ?? {}) as never,
  };
  if (input.agentId) params.p_agent_id = input.agentId;
  if (input.userId) params.p_user_id = input.userId;

  // RPC retorna jsonb. Mesmo um "blocked" é uma resposta de sucesso da RPC,
  // não um erro Postgres. Erros aqui são erros técnicos reais.
  const { data, error } = await supabase.rpc('mcp_record_invocation', params as never);
  if (error) throw error;

  const r = (data ?? {}) as Record<string, unknown>;
  return {
    invocation_id: (r.invocation_id as string | null) ?? null,
    execution_status: (r.execution_status as McpExecutionStatus) ?? 'failed',
    approval_status: (r.approval_status as McpApprovalStatus) ?? 'not_required',
    error_message: (r.error_message as string | null) ?? null,
    output_json: asNullableJson(r.output_json),
  };
}

// ----- METRICS -----

async function countInvocations(
  orgId: string,
  apply?: (q: ReturnType<typeof supabase.from>) => unknown,
): Promise<number> {
  let q = supabase
    .from('mcp_tool_invocations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId);
  if (apply) q = apply(q as never) as never;
  const { count, error } = await q;
  if (error) {
    console.warn('[countInvocations]', error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getMcpInvocationMetrics(orgId: string): Promise<McpInvocationMetrics> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    total,
    simulated,
    real,
    blocked,
    success,
    failed,
    pendingApproval,
    last24h,
  ] = await Promise.all([
    countInvocations(orgId),
    countInvocations(orgId, (q) =>
      (q as never as { eq: (a: string, b: string) => unknown }).eq('invocation_type', 'simulated'),
    ),
    countInvocations(orgId, (q) =>
      (q as never as { eq: (a: string, b: string) => unknown }).eq('invocation_type', 'real'),
    ),
    countInvocations(orgId, (q) =>
      (q as never as { eq: (a: string, b: string) => unknown }).eq('execution_status', 'blocked'),
    ),
    countInvocations(orgId, (q) =>
      (q as never as { eq: (a: string, b: string) => unknown }).eq('execution_status', 'success'),
    ),
    countInvocations(orgId, (q) =>
      (q as never as { eq: (a: string, b: string) => unknown }).eq('execution_status', 'failed'),
    ),
    countInvocations(orgId, (q) =>
      (q as never as { eq: (a: string, b: string) => unknown }).eq('approval_status', 'pending'),
    ),
    countInvocations(orgId, (q) =>
      (q as never as { gte: (a: string, b: string) => unknown }).gte('created_at', since24h),
    ),
  ]);

  // Volts: somatória requer fetch parcial (sem RPC dedicada). Faz só dos últimos 500.
  let voltsConsumed = 0;
  try {
    const { data } = await supabase
      .from('mcp_tool_invocations')
      .select('volts_consumed')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(500);
    voltsConsumed = (data ?? []).reduce((acc, r) => acc + Number(r.volts_consumed ?? 0), 0);
  } catch {
    voltsConsumed = 0;
  }

  return {
    total,
    simulated,
    real,
    blocked,
    success,
    failed,
    pending_approval: pendingApproval,
    last_24h: last24h,
    volts_consumed: voltsConsumed,
  };
}

// ----- HELPERS para o formulário -----

export interface ToolForInvocation {
  id: string;
  name: string;
  slug: string;
  risk_level: McpRiskLevel;
  execution_mode: McpExecutionMode;
  is_enabled: boolean;
  organization_id: string | null;
}

export async function listMcpToolsForInvocation(orgId: string): Promise<ToolForInvocation[]> {
  // RLS já filtra org + globais
  const { data, error } = await supabase
    .from('mcp_tools')
    .select('id,name,slug,risk_level,execution_mode,is_enabled,organization_id')
    .order('name');
  if (error) throw error;
  return (data ?? []) as ToolForInvocation[];
}
