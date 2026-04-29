import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { toast } from '@/hooks/use-toast';
import {
  fetchHypotheses,
  fetchVariants,
  fetchResults,
  getOrCreateGuardrails,
  updateGuardrails,
  approveHypothesis,
  rejectHypothesis,
  triggerGenerateHypotheses,
  triggerEvaluateExperiments,
  type AgentGuardrails,
} from '@/services/experiments/experimentsService';

export function useHypotheses() {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: ['experiment-hypotheses', organization?.id],
    queryFn: () => fetchHypotheses(organization!.id),
    enabled: !!organization?.id,
    refetchInterval: 30_000,
  });
}

export function useVariants(hypothesisId: string | undefined) {
  return useQuery({
    queryKey: ['experiment-variants', hypothesisId],
    queryFn: () => fetchVariants(hypothesisId!),
    enabled: !!hypothesisId,
  });
}

export function useResults(hypothesisId: string | undefined) {
  return useQuery({
    queryKey: ['experiment-results', hypothesisId],
    queryFn: () => fetchResults(hypothesisId!),
    enabled: !!hypothesisId,
    refetchInterval: 30_000,
  });
}

export function useGuardrails() {
  const { organization } = useCurrentOrganization();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['agent-guardrails', organization?.id],
    queryFn: () => getOrCreateGuardrails(organization!.id),
    enabled: !!organization?.id,
  });

  const update = useMutation({
    mutationFn: (patch: Partial<AgentGuardrails>) => updateGuardrails(organization!.id, patch),
    onSuccess: () => {
      toast({ title: 'Guardrails atualizados' });
      qc.invalidateQueries({ queryKey: ['agent-guardrails', organization?.id] });
    },
    onError: (e: any) => toast({ title: 'Erro ao atualizar guardrails', description: e?.message, variant: 'destructive' }),
  });

  return { ...query, update };
}

export function useApproveHypothesis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approveHypothesis(id),
    onSuccess: () => {
      toast({ title: 'Hipótese aprovada — gerando variantes' });
      qc.invalidateQueries({ queryKey: ['experiment-hypotheses'] });
    },
    onError: (e: any) => toast({ title: 'Erro ao aprovar', description: e?.message, variant: 'destructive' }),
  });
}

export function useRejectHypothesis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => rejectHypothesis(id, reason),
    onSuccess: () => {
      toast({ title: 'Hipótese rejeitada' });
      qc.invalidateQueries({ queryKey: ['experiment-hypotheses'] });
    },
    onError: (e: any) => toast({ title: 'Erro ao rejeitar', description: e?.message, variant: 'destructive' }),
  });
}

export function useTriggerGenerateHypotheses() {
  const { organization } = useCurrentOrganization();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => triggerGenerateHypotheses(organization?.id),
    onSuccess: () => {
      toast({ title: 'Hipóteses geradas' });
      qc.invalidateQueries({ queryKey: ['experiment-hypotheses'] });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });
}

export function useTriggerEvaluate() {
  const { organization } = useCurrentOrganization();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => triggerEvaluateExperiments(organization?.id),
    onSuccess: () => {
      toast({ title: 'Experimentos avaliados' });
      qc.invalidateQueries({ queryKey: ['experiment-hypotheses'] });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });
}
