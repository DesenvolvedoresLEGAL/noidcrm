import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import {
  getAIActionStats,
  getAIAlertStats,
  getRecentAIActions,
  getPendingApprovals,
  getActiveAlerts,
  approveAIAction,
  rejectAIAction,
  overrideAIAction,
  acknowledgeAlert,
  resolveAlert,
  dismissAlert,
  AIActionStats,
  AIAlertStats,
  AIAction,
  AIAlert,
} from '@/services/crm/ai-supervision';

export function useAIActionStats() {
  return useQuery<AIActionStats>({
    queryKey: ['ai-action-stats'],
    queryFn: getAIActionStats,
    refetchInterval: 30000,
  });
}

export function useAIAlertStats() {
  return useQuery<AIAlertStats>({
    queryKey: ['ai-alert-stats'],
    queryFn: getAIAlertStats,
    refetchInterval: 30000,
  });
}

export function useRecentAIActions(limit = 20) {
  return useQuery<AIAction[]>({
    queryKey: ['recent-ai-actions', limit],
    queryFn: () => getRecentAIActions(limit),
    refetchInterval: 15000,
  });
}

export function usePendingApprovals() {
  return useQuery<AIAction[]>({
    queryKey: ['pending-approvals'],
    queryFn: getPendingApprovals,
    refetchInterval: 10000,
  });
}

export function useActiveAlerts() {
  return useQuery<AIAlert[]>({
    queryKey: ['active-alerts'],
    queryFn: getActiveAlerts,
    refetchInterval: 15000,
  });
}

export function useApproveAIAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveAIAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-action-stats'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['recent-ai-actions'] });
      toast({ title: 'Ação aprovada', description: 'A ação da IA foi aprovada e executada.' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });
}

export function useRejectAIAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ actionId, reason }: { actionId: string; reason: string }) => 
      rejectAIAction(actionId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-action-stats'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['recent-ai-actions'] });
      toast({ title: 'Ação rejeitada', description: 'A ação da IA foi rejeitada.' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });
}

export function useOverrideAIAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ actionId, correctedDecision, reason }: { 
      actionId: string; 
      correctedDecision: Record<string, unknown>; 
      reason: string 
    }) => overrideAIAction(actionId, correctedDecision, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-action-stats'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['recent-ai-actions'] });
      toast({ title: 'Ação corrigida', description: 'A decisão da IA foi corrigida. Este feedback será usado para melhorar o sistema.' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-alert-stats'] });
      queryClient.invalidateQueries({ queryKey: ['active-alerts'] });
      toast({ title: 'Alerta reconhecido' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-alert-stats'] });
      queryClient.invalidateQueries({ queryKey: ['active-alerts'] });
      toast({ title: 'Alerta resolvido' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });
}

export function useDismissAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dismissAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-alert-stats'] });
      queryClient.invalidateQueries({ queryKey: ['active-alerts'] });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });
}
