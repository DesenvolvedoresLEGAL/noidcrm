import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { executionService } from '@/services/ai-agents/executionService';
import { toast } from 'sonner';
import { aiAgentKeys } from '@/lib/query-keys';

export function useExecutionRuns(orgId: string | undefined, filters?: { agentId?: string; status?: string }) {
  return useQuery({
    queryKey: aiAgentKeys.executionRuns(orgId, filters),
    queryFn: () => executionService.listExecutionRuns(orgId!, filters),
    enabled: !!orgId,
  });
}

export function useApprovalQueue(orgId: string | undefined) {
  return useQuery({
    queryKey: aiAgentKeys.approvalQueue(orgId),
    queryFn: () => executionService.getApprovalQueue(orgId!),
    enabled: !!orgId,
    refetchInterval: 30000,
  });
}

export function useRunDetails(runId: string | undefined) {
  return useQuery({
    queryKey: aiAgentKeys.runDetails(runId),
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
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.approvalQueueAll() });
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.approvalQueueCountAll() });
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.opportunityApprovalsAll() });
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.executionRunsAll() });
    },
    onError: (err: any) => {
      // Always invalidate so the UI reflects the new send_failed state and shows the error inline
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.approvalQueueAll() });
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.approvalQueueCountAll() });
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.opportunityApprovalsAll() });
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.executionRunsAll() });
      if (err?.partial) {
        toast.error(`Aprovado, mas falha ao enviar: ${err.message}`, {
          description: err.retryable ? 'Você pode tentar reenviar o e-mail.' : 'Verifique a configuração SMTP.',
          duration: 8000,
        });
      } else {
        toast.error(err?.message || 'Erro ao aprovar');
      }
    },
  });
}

export function useRejectAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ queueId, reason }: { queueId: string; reason?: string }) =>
      executionService.rejectAction(queueId, reason),
    onSuccess: () => {
      toast.success('Ação rejeitada');
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.approvalQueueAll() });
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.approvalQueueCountAll() });
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.opportunityApprovalsAll() });
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.executionRunsAll() });
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
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.executionRunsAll() });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao executar'),
  });
}
