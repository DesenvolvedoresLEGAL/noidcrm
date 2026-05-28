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
import { aiSupervisionKeys } from '@/lib/query-keys';

export function useAIActionStats() {
  return useQuery<AIActionStats>({
    queryKey: aiSupervisionKeys.actionStats(),
    queryFn: getAIActionStats,
export function useAIActionStats() {
  return useQuery<AIActionStats>({
    queryKey: aiSupervisionKeys.actionStats(),
    queryFn: getAIActionStats,
    refetchInterval: 60000, // Fase 1A: 30s → 60s (não crítico)
  });
}

export function useAIAlertStats() {
  return useQuery<AIAlertStats>({
    queryKey: aiSupervisionKeys.alertStats(),
    queryFn: getAIAlertStats,
    refetchInterval: 60000, // Fase 1A: 30s → 60s (não crítico)
  });
}

export function useRecentAIActions(limit = 20) {
  return useQuery<AIAction[]>({
    queryKey: aiSupervisionKeys.recentActions(limit),
    queryFn: () => getRecentAIActions(limit),
    refetchInterval: 60000, // Fase 1A: 15s → 60s (não crítico)
  });
}

export function usePendingApprovals() {
  return useQuery<AIAction[]>({
    queryKey: aiSupervisionKeys.pendingApprovals(),
    queryFn: getPendingApprovals,
    refetchInterval: 10000, // mantido: aprovações de IA são críticas
  });
}

export function useActiveAlerts() {
  return useQuery<AIAlert[]>({
    queryKey: aiSupervisionKeys.activeAlerts(),
    queryFn: getActiveAlerts,
    refetchInterval: 45000, // Fase 1A: 15s → 45s (não crítico)
  });
}

  });
}

export function useApproveAIAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveAIAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiSupervisionKeys.actionStats() });
      queryClient.invalidateQueries({ queryKey: aiSupervisionKeys.pendingApprovals() });
      queryClient.invalidateQueries({ queryKey: aiSupervisionKeys.recentActionsAll() });
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
      queryClient.invalidateQueries({ queryKey: aiSupervisionKeys.actionStats() });
      queryClient.invalidateQueries({ queryKey: aiSupervisionKeys.pendingApprovals() });
      queryClient.invalidateQueries({ queryKey: aiSupervisionKeys.recentActionsAll() });
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
      queryClient.invalidateQueries({ queryKey: aiSupervisionKeys.actionStats() });
      queryClient.invalidateQueries({ queryKey: aiSupervisionKeys.pendingApprovals() });
      queryClient.invalidateQueries({ queryKey: aiSupervisionKeys.recentActionsAll() });
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
      queryClient.invalidateQueries({ queryKey: aiSupervisionKeys.alertStats() });
      queryClient.invalidateQueries({ queryKey: aiSupervisionKeys.activeAlerts() });
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
      queryClient.invalidateQueries({ queryKey: aiSupervisionKeys.alertStats() });
      queryClient.invalidateQueries({ queryKey: aiSupervisionKeys.activeAlerts() });
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
      queryClient.invalidateQueries({ queryKey: aiSupervisionKeys.alertStats() });
      queryClient.invalidateQueries({ queryKey: aiSupervisionKeys.activeAlerts() });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });
}
