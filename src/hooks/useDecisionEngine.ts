import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listDecisionRules,
  createDecisionRule,
  updateDecisionRule,
  deleteDecisionRule,
  getLatestDecisionLog,
  listDecisionLogs,
  runDecisionEngine,
  type DecisionRuleInput,
} from "@/services/decision-engine/decisionService";

export function useDecisionRules(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["decision-rules", organizationId],
    enabled: !!organizationId,
    queryFn: () => listDecisionRules(organizationId!),
  });
}

export function useCreateDecisionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DecisionRuleInput) => createDecisionRule(input),
    onSuccess: (rule) => {
      toast.success("Regra criada");
      qc.invalidateQueries({ queryKey: ["decision-rules", rule.organization_id] });
    },
    onError: (e: Error) => toast.error(`Erro ao criar regra: ${e.message}`),
  });
}

export function useUpdateDecisionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DecisionRuleInput }) =>
      updateDecisionRule(id, input),
    onSuccess: (rule) => {
      toast.success("Regra atualizada");
      qc.invalidateQueries({ queryKey: ["decision-rules", rule.organization_id] });
    },
    onError: (e: Error) => toast.error(`Erro ao atualizar: ${e.message}`),
  });
}

export function useDeleteDecisionRule(organizationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDecisionRule(id),
    onSuccess: () => {
      toast.success("Regra removida");
      qc.invalidateQueries({ queryKey: ["decision-rules", organizationId] });
    },
    onError: (e: Error) => toast.error(`Erro ao remover: ${e.message}`),
  });
}

export function useLatestDecisionLog(prospectId: string | undefined) {
  return useQuery({
    queryKey: ["decision-log-latest", prospectId],
    enabled: !!prospectId,
    queryFn: () => getLatestDecisionLog(prospectId!),
  });
}

export function useDecisionLogs(prospectId: string | undefined) {
  return useQuery({
    queryKey: ["decision-logs", prospectId],
    enabled: !!prospectId,
    queryFn: () => listDecisionLogs(prospectId!),
  });
}

export function useRunDecisionEngine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runDecisionEngine,
    onSuccess: (data, vars) => {
      const taken = data?.decision_taken ?? "ok";
      toast.success(`Decisão: ${taken}`);
      qc.invalidateQueries({ queryKey: ["decision-log-latest", vars.prospect_id] });
      qc.invalidateQueries({ queryKey: ["decision-logs", vars.prospect_id] });
    },
    onError: (e: Error) => toast.error(`Erro no decision engine: ${e.message}`),
  });
}
