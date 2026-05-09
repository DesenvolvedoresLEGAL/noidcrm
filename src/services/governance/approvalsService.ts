// Sprint B — Audit unificado + Approval router
// Cliente único para a fila de aprovação (humano + agente) e para a view de auditoria.
import { supabase } from '@/integrations/supabase/client';

// ============================================================
// APPROVALS
// ============================================================
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
export type ApprovalRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ApprovalRequesterType = 'human' | 'agent' | 'system';

export interface UnifiedApprovalRow {
  id: string;
  source: 'approval_requests' | 'ai_agent_approval_queue';
  organization_id: string;
  action_key: string;
  requester_type: ApprovalRequesterType;
  requester_user_id: string | null;
  requester_agent_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  status: ApprovalStatus;
  risk_level: ApprovalRiskLevel;
  decided_by: string | null;
  decision_reason: string | null;
  requested_at: string;
  decided_at: string | null;
  expires_at: string | null;
  payload: Record<string, unknown>;
  execution_id: string | null;
}

export interface RequestApprovalInput {
  actionKey: string;
  payload?: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  executionId?: string;
  expiresInHours?: number;
}

export async function requestApproval(input: RequestApprovalInput) {
  const { data, error } = await supabase.rpc('request_approval', {
    p_action_key: input.actionKey,
    p_payload: (input.payload ?? {}) as never,
    p_entity_type: input.entityType ?? null,
    p_entity_id: input.entityId ?? null,
    p_execution_id: input.executionId ?? null,
    p_expires_in_hours: input.expiresInHours ?? 72,
  });
  if (error) throw error;
  return data as { ok: boolean; approval_id?: string; error?: string; risk_level?: ApprovalRiskLevel };
}

export async function decideApproval(
  approvalId: string,
  decision: 'approved' | 'rejected',
  reason?: string,
) {
  const { data, error } = await supabase.rpc('decide_approval', {
    p_approval_id: approvalId,
    p_decision: decision,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  return data as { ok: boolean; status?: string; error?: string };
}

export interface ListApprovalsFilters {
  status?: ApprovalStatus | ApprovalStatus[];
  requesterType?: ApprovalRequesterType;
  actionKey?: string;
  limit?: number;
}

export async function listUnifiedApprovals(filters: ListApprovalsFilters = {}) {
  let q = supabase
    .from('unified_approval_queue_view' as never)
    .select('*')
    .order('requested_at', { ascending: false })
    .limit(filters.limit ?? 100);

  if (filters.status) {
    q = Array.isArray(filters.status) ? q.in('status', filters.status) : q.eq('status', filters.status);
  }
  if (filters.requesterType) q = q.eq('requester_type', filters.requesterType);
  if (filters.actionKey) q = q.eq('action_key', filters.actionKey);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as UnifiedApprovalRow[];
}

// ============================================================
// UNIFIED AUDIT
// ============================================================
export type AuditSource =
  | 'audit_log'
  | 'action_execution'
  | 'ai_agent_audit'
  | 'mcp_audit_logs'
  | 'auth_audit_log';

export interface UnifiedAuditRow {
  id: string;
  source: AuditSource;
  occurred_at: string;
  organization_id: string | null;
  actor_type: 'human' | 'agent' | 'system';
  actor_user_id: string | null;
  actor_agent_id: string | null;
  action_key: string;
  entity_type: string | null;
  entity_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  status: string | null;
  metadata: Record<string, unknown>;
}

export interface AuditFilters {
  sources?: AuditSource[];
  actorType?: 'human' | 'agent' | 'system';
  actorUserId?: string;
  actorAgentId?: string;
  entityType?: string;
  entityId?: string;
  actionKey?: string;
  since?: string;
  until?: string;
  limit?: number;
}

export async function listUnifiedAudit(filters: AuditFilters = {}) {
  let q = supabase
    .from('unified_audit_view' as never)
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(filters.limit ?? 200);

  if (filters.sources?.length) q = q.in('source', filters.sources);
  if (filters.actorType) q = q.eq('actor_type', filters.actorType);
  if (filters.actorUserId) q = q.eq('actor_user_id', filters.actorUserId);
  if (filters.actorAgentId) q = q.eq('actor_agent_id', filters.actorAgentId);
  if (filters.entityType) q = q.eq('entity_type', filters.entityType);
  if (filters.entityId) q = q.eq('entity_id', filters.entityId);
  if (filters.actionKey) q = q.eq('action_key', filters.actionKey);
  if (filters.since) q = q.gte('occurred_at', filters.since);
  if (filters.until) q = q.lte('occurred_at', filters.until);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as UnifiedAuditRow[];
}
