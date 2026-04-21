import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBuilderConfig, saveBuilderSection, validateBuilder, duplicateVersion, listToolsRegistry } from '@/services/ai-agents/agentBuilderService';
import type { AgentBuilderSection } from '@/types/ai-agents';
import { toast } from 'sonner';
import { aiAgentKeys } from '@/lib/query-keys';

export function useBuilderConfig(agentId: string | undefined, versionId?: string) {
  return useQuery({
    queryKey: aiAgentKeys.builderConfig(agentId, versionId),
    queryFn: () => getBuilderConfig(agentId!, versionId),
    enabled: !!agentId,
  });
}

export function useSaveBuilderSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, versionId, section, payload }: {
      agentId: string; versionId: string; section: AgentBuilderSection; payload: Record<string, unknown>;
    }) => saveBuilderSection(agentId, versionId, section, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.builderConfigByAgent(vars.agentId) });
      toast.success('Seção salva com sucesso');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    },
  });
}

export function useValidateBuilder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, versionId }: { agentId: string; versionId: string }) =>
      validateBuilder(agentId, versionId),
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.builderConfigByAgent(vars.agentId) });
      if (data.is_valid) {
        toast.success('Configuração válida — pronto para publicação');
      } else if (data.errors.length > 0) {
        toast.error(`${data.errors.length} erro(s) encontrado(s)`);
      } else {
        toast.warning(`${data.warnings.length} aviso(s) encontrado(s)`);
      }
    },
    onError: (err: Error) => {
      toast.error(`Erro na validação: ${err.message}`);
    },
  });
}

export function useDuplicateVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, sourceVersionId }: { agentId: string; sourceVersionId: string }) =>
      duplicateVersion(agentId, sourceVersionId),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.builderConfigByAgent(vars.agentId) });
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.versions(vars.agentId) });
      toast.success('Versão duplicada com sucesso');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao duplicar: ${err.message}`);
    },
  });
}

export function useToolsRegistry() {
  return useQuery({
    queryKey: aiAgentKeys.toolsRegistry(),
    queryFn: listToolsRegistry,
  });
}
