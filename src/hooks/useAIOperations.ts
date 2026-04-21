import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import {
  getAutomationStats,
  getRecentAutomations,
  triggerWorkflowProcessing,
  triggerAISuggestionsAutoApply,
  triggerStaleOpportunitiesDetection,
  AutomationStats,
  RecentAutomation,
} from '@/services/crm/ai-operations';
import { aiOperationsKeys } from '@/lib/query-keys';

/**
 * Hook to fetch automation statistics
 */
export function useAutomationStats() {
  return useQuery<AutomationStats>({
    queryKey: aiOperationsKeys.automationStats(),
    queryFn: getAutomationStats,
    refetchInterval: 60000, // Refresh every minute
  });
}

/**
 * Hook to fetch recent automations
 */
export function useRecentAutomations(limit: number = 20) {
  return useQuery<RecentAutomation[]>({
    queryKey: aiOperationsKeys.recentAutomations(limit),
    queryFn: () => getRecentAutomations(limit),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Hook to manually trigger workflow processing
 */
export function useTriggerWorkflowProcessing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerWorkflowProcessing,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: aiOperationsKeys.automationStats() });
      queryClient.invalidateQueries({ queryKey: aiOperationsKeys.recentAutomationsAll() });
      queryClient.invalidateQueries({ queryKey: aiOperationsKeys.workflowExecutionsAll() });
      
      if (result.success) {
        toast({ title: 'Workflows processados', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.message });
      }
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao processar workflows', description: error.message });
    },
  });
}

/**
 * Hook to manually trigger AI suggestions auto-apply
 */
export function useTriggerAISuggestionsAutoApply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerAISuggestionsAutoApply,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: aiOperationsKeys.automationStats() });
      queryClient.invalidateQueries({ queryKey: aiOperationsKeys.recentAutomationsAll() });
      
      if (result.success) {
        toast({ title: 'Sugestões aplicadas', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.message });
      }
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao aplicar sugestões', description: error.message });
    },
  });
}

/**
 * Hook to manually trigger stale opportunities detection
 */
export function useTriggerStaleOpportunitiesDetection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerStaleOpportunitiesDetection,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: aiOperationsKeys.automationStats() });
      queryClient.invalidateQueries({ queryKey: aiOperationsKeys.recentAutomationsAll() });
      queryClient.invalidateQueries({ queryKey: aiOperationsKeys.notificationsAll() });
      
      if (result.success) {
        toast({ title: 'Detecção concluída', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.message });
      }
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro na detecção', description: error.message });
    },
  });
}
