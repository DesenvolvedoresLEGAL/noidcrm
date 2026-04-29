import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchInsights,
  fetchRecommendations,
  fetchActionsLog,
  applyRecommendation,
  dismissRecommendation,
  setOptimizationAutoMode,
  triggerComputeInsights,
  triggerGenerateRecommendations,
  type RecommendationStatus,
} from '@/services/optimization/optimizationService';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { toast } from '@/hooks/use-toast';

export function useOptimizationInsights() {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: ['optimization-insights', organization?.id],
    queryFn: () => fetchInsights(organization!.id),
    enabled: !!organization?.id,
  });
}

export function useOptimizationRecommendations(status?: RecommendationStatus) {
  const { organization } = useCurrentOrganization();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['optimization-recommendations', organization?.id, status],
    queryFn: () => fetchRecommendations(organization!.id, status),
    enabled: !!organization?.id,
  });

  const apply = useMutation({
    mutationFn: applyRecommendation,
    onSuccess: () => {
      toast({ title: 'Recomendação aplicada' });
      qc.invalidateQueries({ queryKey: ['optimization-recommendations'] });
      qc.invalidateQueries({ queryKey: ['optimization-actions-log'] });
    },
    onError: (e: any) => toast({ title: 'Falha ao aplicar', description: e?.message, variant: 'destructive' }),
  });

  const dismiss = useMutation({
    mutationFn: dismissRecommendation,
    onSuccess: () => {
      toast({ title: 'Recomendação descartada' });
      qc.invalidateQueries({ queryKey: ['optimization-recommendations'] });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  return { ...query, apply, dismiss };
}

export function useOptimizationActionsLog() {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: ['optimization-actions-log', organization?.id],
    queryFn: () => fetchActionsLog(organization!.id),
    enabled: !!organization?.id,
  });
}

export function useOptimizationAutoMode() {
  const { organization } = useCurrentOrganization();
  const qc = useQueryClient();
  const enabled = Boolean((organization as any)?.settings?.optimization_auto_mode);

  const mutation = useMutation({
    mutationFn: (next: boolean) => setOptimizationAutoMode(organization!.id, next),
    onSuccess: () => {
      toast({ title: 'Modo automático atualizado' });
      qc.invalidateQueries({ queryKey: ['current-organization'] });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  return { enabled, setEnabled: mutation.mutate, isLoading: mutation.isPending };
}

export function useTriggerOptimizationCycle() {
  const { organization } = useCurrentOrganization();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await triggerComputeInsights(organization?.id);
      await triggerGenerateRecommendations(organization?.id);
    },
    onSuccess: () => {
      toast({ title: 'Ciclo de otimização executado' });
      qc.invalidateQueries({ queryKey: ['optimization-insights'] });
      qc.invalidateQueries({ queryKey: ['optimization-recommendations'] });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });
}
