import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAgents, getAgentById, createAgent, updateAgent, archiveAgent } from '@/services/ai-agents/aiAgentsService';
import { listVersions } from '@/services/ai-agents/aiAgentVersionsService';
import { supabase } from '@/integrations/supabase/client';
import type { CreateAgentPayload, CreateAgentFromBlueprintPayload, UpdateAgentPayload, AIAgentAudit, AgentBlueprint, AIAgentPermission, AIAgentEnvironmentConfig, AIAgentPublishHistory } from '@/types/ai-agents';
import { toast } from 'sonner';

export function useAIAgents(filters?: { status?: string; autonomy_level?: string; owner_id?: string; search?: string }) {
  return useQuery({
    queryKey: ['ai-agents', filters],
    queryFn: () => listAgents(filters),
  });
}

export function useAIAgent(id: string | undefined) {
  return useQuery({
    queryKey: ['ai-agent', id],
    queryFn: () => getAgentById(id!),
    enabled: !!id,
  });
}

export function useCreateAIAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAgentPayload | CreateAgentFromBlueprintPayload) => createAgent(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      toast.success('Agente criado com sucesso');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar agente: ${err.message}`);
    },
  });
}

export function useUpdateAIAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAgentPayload }) => updateAgent(id, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      queryClient.invalidateQueries({ queryKey: ['ai-agent', vars.id] });
      toast.success('Agente atualizado');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar: ${err.message}`);
    },
  });
}

export function useArchiveAIAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      toast.success('Agente arquivado');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao arquivar: ${err.message}`);
    },
  });
}

export function useAIAgentVersions(agentId: string | undefined) {
  return useQuery({
    queryKey: ['ai-agent-versions', agentId],
    queryFn: () => listVersions(agentId!),
    enabled: !!agentId,
  });
}

export function useAIAgentAudit(agentId: string | undefined) {
  return useQuery({
    queryKey: ['ai-agent-audit', agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agent_audit')
        .select('*')
        .eq('agent_id', agentId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AIAgentAudit[];
    },
    enabled: !!agentId,
  });
}

export function useGenerateBlueprint() {
  return useMutation({
    mutationFn: async ({ mode, text }: { mode: 'conversation' | 'prompt_import'; text: string }): Promise<AgentBlueprint> => {
      const { data, error } = await supabase.functions.invoke('generate-agent-blueprint', {
        body: { mode, text },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      const blueprint = data.blueprint;
      blueprint.source_type = mode === 'conversation' ? 'conversation' : 'prompt_import';
      blueprint.source_text = text;
      return blueprint as AgentBlueprint;
    },
    onError: (err: Error) => {
      toast.error(`Erro ao gerar blueprint: ${err.message}`);
    },
  });
}
