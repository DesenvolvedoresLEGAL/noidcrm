import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import {
  listWorkflowRules,
  getWorkflowRule,
  createWorkflowRule,
  updateWorkflowRule,
  deleteWorkflowRule,
  toggleWorkflowRule,
  duplicateWorkflowRule,
  listWorkflowExecutions,
  testWorkflowRule,
  WorkflowRule,
  WorkflowExecution,
} from '@/services/crm/workflow-rules';

export function useWorkflowRules() {
  return useQuery({
    queryKey: ['workflow-rules'],
    queryFn: listWorkflowRules,
  });
}

export function useWorkflowRule(id: string) {
  return useQuery({
    queryKey: ['workflow-rules', id],
    queryFn: () => getWorkflowRule(id),
    enabled: !!id,
  });
}

export function useCreateWorkflowRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rule: Partial<WorkflowRule>) => createWorkflowRule(rule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-rules'] });
      toast({ title: 'Regra de workflow criada com sucesso' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao criar regra', description: error.message });
    },
  });
}

export function useUpdateWorkflowRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, rule }: { id: string; rule: Partial<WorkflowRule> }) => updateWorkflowRule(id, rule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-rules'] });
      toast({ title: 'Regra de workflow atualizada' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: error.message });
    },
  });
}

export function useDeleteWorkflowRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteWorkflowRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-rules'] });
      toast({ title: 'Regra de workflow excluída' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: error.message });
    },
  });
}

export function useToggleWorkflowRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => toggleWorkflowRule(id, isActive),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-rules'] });
      toast({ title: variables.isActive ? 'Regra ativada' : 'Regra desativada' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao alternar', description: error.message });
    },
  });
}

export function useDuplicateWorkflowRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => duplicateWorkflowRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-rules'] });
      toast({ title: 'Regra duplicada com sucesso' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao duplicar', description: error.message });
    },
  });
}

export function useWorkflowExecutions(filters?: {
  workflowRuleId?: string;
  status?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['workflow-executions', filters],
    queryFn: () => listWorkflowExecutions(filters),
  });
}

export function useTestWorkflowRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ruleId, opportunityId }: { ruleId: string; opportunityId: string }) =>
      testWorkflowRule(ruleId, opportunityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-executions'] });
      toast({ title: 'Teste executado com sucesso' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro no teste', description: error.message });
    },
  });
}
