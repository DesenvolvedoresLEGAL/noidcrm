import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAgents, getAgentById, createAgent, updateAgent, archiveAgent } from '@/services/ai-agents/aiAgentsService';
import { listVersions } from '@/services/ai-agents/aiAgentVersionsService';
import { supabase } from '@/integrations/supabase/client';
import type { CreateAgentPayload, CreateAgentFromBlueprintPayload, UpdateAgentPayload, AIAgentAudit, AgentBlueprint, AIAgentPermission, AIAgentEnvironmentConfig, AIAgentPublishHistory } from '@/types/ai-agents';
import { toast } from 'sonner';
import { aiAgentKeys } from '@/lib/query-keys';

export function useAIAgents(filters?: { status?: string; autonomy_level?: string; owner_id?: string; search?: string }) {
  return useQuery({
    queryKey: aiAgentKeys.list(filters),
    queryFn: () => listAgents(filters),
  });
}

export function useAIAgent(id: string | undefined) {
  return useQuery({
    queryKey: aiAgentKeys.detail(id),
    queryFn: () => getAgentById(id!),
    enabled: !!id,
  });
}

export function useCreateAIAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAgentPayload | CreateAgentFromBlueprintPayload) => createAgent(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.listAll() });
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
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.listAll() });
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.detail(vars.id) });
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
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.listAll() });
      toast.success('Agente arquivado');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao arquivar: ${err.message}`);
    },
  });
}

export function useAIAgentVersions(agentId: string | undefined) {
  return useQuery({
    queryKey: aiAgentKeys.versions(agentId),
    queryFn: () => listVersions(agentId!),
    enabled: !!agentId,
  });
}

export function useAIAgentAudit(agentId: string | undefined) {
  return useQuery({
    queryKey: aiAgentKeys.audit(agentId),
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

// --- Governance hooks ---

export function usePublishAgentVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ agent_id, version_id, environment }: { agent_id: string; version_id: string; environment?: string }) => {
      const { data, error } = await supabase.functions.invoke('publish-agent-version', {
        body: { agent_id, version_id, environment },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.listAll() });
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.detail(vars.agent_id) });
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.versions(vars.agent_id) });
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.publishHistory(vars.agent_id) });
      toast.success('Versão publicada com sucesso');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao publicar: ${err.message}`);
    },
  });
}

export function usePauseResumeAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ agent_id, action }: { agent_id: string; action: 'pause' | 'resume' }) => {
      const { data, error } = await supabase.functions.invoke('pause-agent', {
        body: { agent_id, action },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.listAll() });
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.detail(vars.agent_id) });
      toast.success(vars.action === 'pause' ? 'Agente pausado' : 'Agente ativado');
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });
}

export function useValidateAgentExecution() {
  return useMutation({
    mutationFn: async (agent_id: string) => {
      const { data, error } = await supabase.functions.invoke('validate-agent-execution', {
        body: { agent_id },
      });
      if (error) throw error;
      return data as { allowed: boolean; requires_approval: boolean; reason: string | null };
    },
  });
}

export function useAgentPermissions(orgId: string | undefined) {
  return useQuery({
    queryKey: aiAgentKeys.permissions(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agent_permissions')
        .select('*')
        .eq('organization_id', orgId!);
      if (error) throw error;
      return (data || []) as unknown as AIAgentPermission[];
    },
    enabled: !!orgId,
  });
}

export function useUpsertAgentPermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (perm: Partial<AIAgentPermission> & { organization_id: string; user_id: string }) => {
      const { data, error } = await supabase
        .from('ai_agent_permissions')
        .upsert(perm as any, { onConflict: 'organization_id,user_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.permissionsAll() });
      toast.success('Permissão atualizada');
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });
}

export function useAgentEnvironments(orgId: string | undefined) {
  return useQuery({
    queryKey: aiAgentKeys.environments(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agent_environments')
        .select('*')
        .eq('organization_id', orgId!)
        .order('environment');
      if (error) throw error;
      return (data || []) as unknown as AIAgentEnvironmentConfig[];
    },
    enabled: !!orgId,
  });
}

export function useUpdateAgentEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<AIAgentEnvironmentConfig>) => {
      const { data, error } = await supabase
        .from('ai_agent_environments')
        .update(payload as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.environmentsAll() });
      toast.success('Ambiente atualizado');
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });
}

export function useInitializeEnvironments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string) => {
      const { error } = await supabase.rpc('initialize_agent_environments', { p_organization_id: orgId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.environmentsAll() });
    },
  });
}

export function useAgentPublishHistory(agentId: string | undefined) {
  return useQuery({
    queryKey: aiAgentKeys.publishHistory(agentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agent_publish_history')
        .select('*')
        .eq('agent_id', agentId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AIAgentPublishHistory[];
    },
    enabled: !!agentId,
  });
}
