import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listCadencePolicies, createCadencePolicy, updateCadencePolicy, deleteCadencePolicy,
  listCadenceSteps, upsertCadenceStep, deleteCadenceStep,
  getCooldownPolicy, upsertCooldownPolicy,
  listPipelineRules, upsertPipelineRule, deletePipelineRule,
  listCadenceProgress,
} from '@/services/ai-agents/cadenceService';
import { aiAgentKeys } from '@/lib/query-keys';

export function useCadencePolicies(agentId: string | undefined) {
  return useQuery({
    queryKey: aiAgentKeys.cadencePolicies(agentId),
    queryFn: () => listCadencePolicies(agentId!),
    enabled: !!agentId,
  });
}

export function useCreateCadencePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCadencePolicy,
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: aiAgentKeys.cadencePolicies(vars.agent_id) }),
  });
}

export function useUpdateCadencePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => updateCadencePolicy(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: aiAgentKeys.cadencePoliciesAll() }),
  });
}

export function useDeleteCadencePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCadencePolicy,
    onSuccess: () => qc.invalidateQueries({ queryKey: aiAgentKeys.cadencePoliciesAll() }),
  });
}

export function useCadenceSteps(policyId: string | undefined) {
  return useQuery({
    queryKey: aiAgentKeys.cadenceSteps(policyId),
    queryFn: () => listCadenceSteps(policyId!),
    enabled: !!policyId,
  });
}

export function useUpsertCadenceStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertCadenceStep,
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: aiAgentKeys.cadenceSteps(vars.cadence_policy_id) }),
  });
}

export function useDeleteCadenceStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCadenceStep,
    onSuccess: () => qc.invalidateQueries({ queryKey: aiAgentKeys.cadenceStepsAll() }),
  });
}

export function useCooldownPolicy(agentId: string | undefined) {
  return useQuery({
    queryKey: aiAgentKeys.cooldownPolicy(agentId),
    queryFn: () => getCooldownPolicy(agentId!),
    enabled: !!agentId,
  });
}

export function useUpsertCooldownPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertCooldownPolicy,
    onSuccess: () => qc.invalidateQueries({ queryKey: aiAgentKeys.cooldownPolicyAll() }),
  });
}

export function usePipelineRules(agentId: string | undefined) {
  return useQuery({
    queryKey: aiAgentKeys.pipelineRules(agentId),
    queryFn: () => listPipelineRules(agentId!),
    enabled: !!agentId,
  });
}

export function useUpsertPipelineRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertPipelineRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: aiAgentKeys.pipelineRulesAll() }),
  });
}

export function useDeletePipelineRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deletePipelineRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: aiAgentKeys.pipelineRulesAll() }),
  });
}

export function useCadenceProgress(agentId: string | undefined, filters?: { status?: string }) {
  return useQuery({
    queryKey: aiAgentKeys.cadenceProgress(agentId, filters),
    queryFn: () => listCadenceProgress(agentId!, filters),
    enabled: !!agentId,
  });
}
