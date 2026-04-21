import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { runSimulation, getSimulationHistory, getTestScenarios, saveTestScenario, submitFeedback } from '@/services/ai-agents/simulatorService';
import { toast } from 'sonner';
import { aiAgentKeys } from '@/lib/query-keys';

export function useRunSimulation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, versionId, scenario, executionMode }: {
      agentId: string; versionId: string; scenario: Record<string, unknown>; executionMode?: string;
    }) => runSimulation(agentId, versionId, scenario, executionMode),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.simulationHistoryByAgent(vars.agentId) });
      toast.success('Simulação concluída');
    },
    onError: (err: Error) => toast.error(`Erro na simulação: ${err.message}`),
  });
}

export function useSimulationHistory(agentId: string | undefined, versionId?: string) {
  return useQuery({
    queryKey: aiAgentKeys.simulationHistory(agentId, versionId),
    queryFn: () => getSimulationHistory(agentId!, versionId),
    enabled: !!agentId,
  });
}

export function useTestScenarios() {
  return useQuery({
    queryKey: aiAgentKeys.testScenarios(),
    queryFn: () => getTestScenarios(),
  });
}

export function useSaveScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveTestScenario,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.testScenarios() });
      toast.success('Cenário salvo');
    },
    onError: (err: Error) => toast.error(`Erro ao salvar cenário: ${err.message}`),
  });
}

export function useSubmitFeedback() {
  return useMutation({
    mutationFn: submitFeedback,
    onSuccess: () => toast.success('Feedback enviado'),
    onError: (err: Error) => toast.error(`Erro ao enviar feedback: ${err.message}`),
  });
}
