import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useCurrentOrganization';

// ============================================================
// Health diagnostic
// ============================================================
export interface HealthBlocker {
  code: string;
  message: string;
  count: number;
}

export interface HeadlessHumanoidHealth {
  ok: boolean;
  organization_id?: string;
  generated_at?: string;
  registry_summary?: {
    total: number;
    active: number;
    approval_required: number;
    by_executor_type: Record<string, number>;
    by_risk_level: Record<string, number>;
    by_surface: Record<string, number>;
  };
  executions_summary?: {
    last_24h: number;
    failed_24h: number;
    awaiting_approval: number;
    pending_over_5min: number;
    by_status: Record<string, number>;
  };
  approvals_summary?: {
    pending: number;
    approved_24h: number;
    rejected_24h: number;
    expired: number;
  };
  orphan_executions?: number;
  failed_executions?: number;
  risky_actions_without_approval?: number;
  actions_without_surface?: number;
  actions_without_role_high_risk?: number;
  actions_without_risk_level?: number;
  orphan_approvals?: number;
  audit_events_24h?: number;
  go_no_go_status?: 'GO' | 'NO_GO';
  blockers?: HealthBlocker[];
  error?: string;
}

export function useHeadlessHumanoidHealth() {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: ['hh-lab', 'health', organization?.id],
    enabled: !!organization?.id,
    refetchInterval: 30000,
    queryFn: async (): Promise<HeadlessHumanoidHealth> => {
      const { data, error } = await supabase.rpc('get_headless_humanoid_health' as never, {
        p_org_id: organization!.id,
      } as never);
      if (error) throw error;
      return data as unknown as HeadlessHumanoidHealth;
    },
  });
}

// ============================================================
// Action Registry
// ============================================================
export function useActionRegistry() {
  return useQuery({
    queryKey: ['hh-lab', 'registry'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('action_registry' as never)
        .select('*')
        .order('action_key');
      if (error) throw error;
      return (data ?? []) as unknown as any[];
    },
  });
}

// ============================================================
// Executions
// ============================================================
export interface ExecutionFilters {
  status?: string;
  actionKey?: string;
  actorType?: string;
  windowHours?: number;
  onlyOrphans?: boolean;
}

export function useActionExecutions(filters: ExecutionFilters = {}) {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: ['hh-lab', 'executions', organization?.id, filters],
    enabled: !!organization?.id,
    refetchInterval: 15000,
    queryFn: async () => {
      let q = supabase
        .from('action_executions' as never)
        .select('*')
        .eq('organization_id', organization!.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (filters.status) q = q.eq('status', filters.status);
      if (filters.actionKey) q = q.eq('action_key', filters.actionKey);
      if (filters.actorType) q = q.eq('actor_type', filters.actorType);
      if (filters.windowHours) {
        const since = new Date(Date.now() - filters.windowHours * 3600 * 1000).toISOString();
        q = q.gte('created_at', since);
      }
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as unknown as any[];
      if (filters.onlyOrphans) {
        const fiveMinAgo = Date.now() - 5 * 60 * 1000;
        rows = rows.filter(
          (r) =>
            ['pending', 'running'].includes(r.status) &&
            new Date(r.created_at).getTime() < fiveMinAgo,
        );
      }
      return rows;
    },
  });
}

// ============================================================
// Approvals queue
// ============================================================
export function useApprovalQueue() {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: ['hh-lab', 'approvals', organization?.id],
    enabled: !!organization?.id,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unified_approval_queue_view' as never)
        .select('*')
        .eq('organization_id', organization!.id)
        .order('requested_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as any[];
    },
  });
}

export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      approvalId,
      decision,
      reason,
    }: {
      approvalId: string;
      decision: 'approved' | 'rejected';
      reason?: string;
    }) => {
      const { data, error } = await supabase.rpc('decide_approval' as never, {
        p_approval_id: approvalId,
        p_decision: decision,
        p_reason: reason ?? null,
      } as never);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hh-lab', 'approvals'] });
      qc.invalidateQueries({ queryKey: ['hh-lab', 'health'] });
    },
  });
}

// ============================================================
// Audit
// ============================================================
export function useUnifiedAudit(limit = 200) {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: ['hh-lab', 'audit', organization?.id, limit],
    enabled: !!organization?.id,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unified_audit_view' as never)
        .select('*')
        .eq('organization_id', organization!.id)
        .order('occurred_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as any[];
    },
  });
}

// ============================================================
// Test runner
// ============================================================
export const SANDBOX_TESTS = [
  { key: 'noop_succeeds', name: 'No-op sandbox executa e completa com sucesso' },
  { key: 'sensitive_awaits_approval', name: 'Ação sensível entra em awaiting_approval' },
  { key: 'approve_releases', name: 'Aprovar approval libera execução' },
  { key: 'reject_blocks', name: 'Rejeitar approval bloqueia execução' },
  { key: 'insufficient_role', name: 'Tentativa com role insuficiente é bloqueada' },
] as const;

export function useTestRuns() {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: ['hh-lab', 'test-runs', organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('headless_humanoid_test_runs' as never)
        .select('*')
        .eq('organization_id', organization!.id)
        .order('started_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as any[];
    },
  });
}

export function useTestResults(runId: string | null) {
  return useQuery({
    queryKey: ['hh-lab', 'test-results', runId],
    enabled: !!runId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('headless_humanoid_test_results' as never)
        .select('*')
        .eq('test_run_id', runId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as unknown as any[];
    },
  });
}

export function useRunSandboxTests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: runId, error: startErr } = await supabase.rpc(
        'start_headless_humanoid_test_run' as never,
        {} as never,
      );
      if (startErr) throw startErr;

      const results: any[] = [];
      for (const t of SANDBOX_TESTS) {
        const { data, error } = await supabase.rpc('run_headless_humanoid_test' as never, {
          p_run_id: runId,
          p_test_key: t.key,
        } as never);
        results.push({ key: t.key, data, error: error?.message });
      }

      const { data: finish } = await supabase.rpc(
        'finish_headless_humanoid_test_run' as never,
        { p_run_id: runId } as never,
      );

      return { runId: runId as unknown as string, results, finish };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hh-lab'] });
    },
  });
}
