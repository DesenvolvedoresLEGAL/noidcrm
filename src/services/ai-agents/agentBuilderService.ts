import { supabase } from '@/integrations/supabase/client';
import type { AgentBuilderConfig, AgentBuilderSection } from '@/types/ai-agents';

export async function getBuilderConfig(agentId: string, versionId?: string): Promise<AgentBuilderConfig> {
  const { data, error } = await supabase.functions.invoke('get-agent-builder-config', {
    body: { agent_id: agentId, version_id: versionId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as AgentBuilderConfig;
}

export async function saveBuilderSection(
  agentId: string,
  versionId: string,
  section: AgentBuilderSection,
  payload: Record<string, unknown>
) {
  const { data, error } = await supabase.functions.invoke('save-agent-builder-section', {
    body: { agent_id: agentId, agent_version_id: versionId, section, payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function validateBuilder(agentId: string, versionId: string) {
  const { data, error } = await supabase.functions.invoke('validate-agent-builder', {
    body: { agent_id: agentId, agent_version_id: versionId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as {
    is_valid: boolean;
    builder_status: string;
    errors: string[];
    warnings: string[];
    summary: Record<string, unknown>;
  };
}

export async function duplicateVersion(agentId: string, sourceVersionId: string) {
  const { data, error } = await supabase.functions.invoke('duplicate-agent-version', {
    body: { agent_id: agentId, source_version_id: sourceVersionId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function listToolsRegistry() {
  const { data, error } = await supabase
    .from('ai_tools_registry')
    .select('*')
    .eq('is_active', true)
    .order('category');
  if (error) throw error;
  return data || [];
}
