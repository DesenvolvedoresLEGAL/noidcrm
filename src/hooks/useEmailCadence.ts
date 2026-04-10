import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listCadencePolicies, createCadencePolicy, updateCadencePolicy, deleteCadencePolicy,
  listCadenceSteps, upsertCadenceStep, deleteCadenceStep,
  getCooldownPolicy, upsertCooldownPolicy,
  listPipelineRules, upsertPipelineRule, deletePipelineRule,
  listCadenceProgress,
} from '@/services/ai-agents/cadenceService';

export function useCadencePolicies(agentId: string | undefined) {
  return useQuery({
    queryKey: ['cadence-policies', agentId],
    queryFn: () => listCadencePolicies(agentId!),
    enabled: !!agentId,
  });
}

export function useCreateCadencePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCadencePolicy,
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['cadence-policies', vars.agent_id] }),
  });
}

export function useUpdateCadencePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => updateCadencePolicy(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cadence-policies'] }),
  });
}

export function useDeleteCadencePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCadencePolicy,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cadence-policies'] }),
  });
}

export function useCadenceSteps(policyId: string | undefined) {
  return useQuery({
    queryKey: ['cadence-steps', policyId],
    queryFn: () => listCadenceSteps(policyId!),
    enabled: !!policyId,
  });
}

export function useUpsertCadenceStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertCadenceStep,
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['cadence-steps', vars.cadence_policy_id] }),
  });
}

export function useDeleteCadenceStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCadenceStep,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cadence-steps'] }),
  });
}

export function useCooldownPolicy(agentId: string | undefined) {
  return useQuery({
    queryKey: ['cooldown-policy', agentId],
    queryFn: () => getCooldownPolicy(agentId!),
    enabled: !!agentId,
  });
}

export function useUpsertCooldownPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertCooldownPolicy,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cooldown-policy'] }),
  });
}

export function usePipelineRules(agentId: string | undefined) {
  return useQuery({
    queryKey: ['pipeline-rules', agentId],
    queryFn: () => listPipelineRules(agentId!),
    enabled: !!agentId,
  });
}

export function useUpsertPipelineRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertPipelineRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipeline-rules'] }),
  });
}

export function useDeletePipelineRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deletePipelineRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipeline-rules'] }),
  });
}

export function useCadenceProgress(agentId: string | undefined, filters?: { status?: string }) {
  return useQuery({
    queryKey: ['cadence-progress', agentId, filters],
    queryFn: () => listCadenceProgress(agentId!, filters),
    enabled: !!agentId,
  });
}
