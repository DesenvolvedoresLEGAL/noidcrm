// Sprint B — React hooks for unified approvals + audit
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import {
  listUnifiedApprovals,
  listUnifiedAudit,
  decideApproval,
  requestApproval,
  type ListApprovalsFilters,
  type AuditFilters,
  type RequestApprovalInput,
} from '@/services/governance/approvalsService';

export function useUnifiedApprovals(filters: ListApprovalsFilters = {}) {
  return useQuery({
    queryKey: ['unified-approvals', filters],
    queryFn: () => listUnifiedApprovals(filters),
    staleTime: 15_000,
  });
}

export function useUnifiedAudit(filters: AuditFilters = {}) {
  return useQuery({
    queryKey: ['unified-audit', filters],
    queryFn: () => listUnifiedAudit(filters),
    staleTime: 30_000,
  });
}

export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { approvalId: string; decision: 'approved' | 'rejected'; reason?: string }) =>
      decideApproval(vars.approvalId, vars.decision, vars.reason),
    onSuccess: (data, vars) => {
      if (!data?.ok) {
        toast({
          title: 'Não foi possível decidir',
          description: data?.error ?? 'Erro desconhecido',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: vars.decision === 'approved' ? 'Aprovação concedida' : 'Solicitação rejeitada',
      });
      qc.invalidateQueries({ queryKey: ['unified-approvals'] });
      qc.invalidateQueries({ queryKey: ['unified-audit'] });
    },
    onError: (err) => {
      toast({
        title: 'Erro ao decidir aprovação',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    },
  });
}

export function useRequestApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RequestApprovalInput) => requestApproval(input),
    onSuccess: (data) => {
      if (!data?.ok) {
        toast({
          title: 'Não foi possível solicitar aprovação',
          description: data?.error ?? 'Erro desconhecido',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Aprovação solicitada' });
      qc.invalidateQueries({ queryKey: ['unified-approvals'] });
    },
  });
}
