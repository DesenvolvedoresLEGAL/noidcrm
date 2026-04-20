import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { executionService } from '@/services/ai-agents/executionService';
import { toast } from 'sonner';

export function useExecutionRuns(orgId: string | undefined, filters?: { agentId?: string; status?: string }) {
  return useQuery({
    queryKey: ['execution-runs', orgId, filters],
    queryFn: () => executionService.listExecutionRuns(orgId!, filters),
    enabled: !!orgId,
  });
}

export function useApprovalQueue(orgId: string | undefined) {
  return useQuery({
    queryKey: ['approval-queue', orgId],
    queryFn: () => executionService.getApprovalQueue(orgId!),
    enabled: !!orgId,
    refetchInterval: 30000,
  });
}

export function useRunDetails(runId: string | undefined) {
  return useQuery({
    queryKey: ['run-details', runId],
    queryFn: () => executionService.getRunDetails(runId!),
    enabled: !!runId,
  });
}

export function useApproveAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ queueId, edits }: { queueId: string; edits?: { edited_subject?: string; edited_body_html?: string; edited_body_text?: string; approval_reason?: string } }) =>
      executionService.approveAction(queueId, edits),
    onSuccess: () => {
      toast.success('Ação aprovada e email enviado');
      queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
      queryClient.invalidateQueries({ queryKey: ['approval-queue-count'] });
      queryClient.invalidateQueries({ queryKey: ['opportunity-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['execution-runs'] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao aprovar'),
  });
}

export function useRejectAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ queueId, reason }: { queueId: string; reason?: string }) =>
      executionService.rejectAction(queueId, reason),
    onSuccess: () => {
      toast.success('Ação rejeitada');
      queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
      queryClient.invalidateQueries({ queryKey: ['approval-queue-count'] });
      queryClient.invalidateQueries({ queryKey: ['opportunity-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['execution-runs'] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao rejeitar'),
  });
}

export function useExecuteRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => executionService.executeRun(runId),
    onSuccess: () => {
      toast.success('Execução iniciada');
      queryClient.invalidateQueries({ queryKey: ['execution-runs'] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao executar'),
  });
}
