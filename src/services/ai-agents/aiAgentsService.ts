import { supabase } from '@/integrations/supabase/client';
import type { AIAgent, CreateAgentPayload, UpdateAgentPayload } from '@/types/ai-agents';

export interface AIAgentWithRelations extends AIAgent {
  owner_name?: string;
  active_version_number?: number;
}

export async function listAgents(filters?: {
  status?: string;
  autonomy_level?: string;
  owner_id?: string;
  search?: string;
}): Promise<AIAgentWithRelations[]> {
  let query = supabase
    .from('ai_agents')
    .select('*, profiles!ai_agents_owner_fk(full_name), ai_agent_versions!inner(version_number)')
    .is('archived_at', null)
    .eq('ai_agent_versions.is_active', true)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.autonomy_level) {
    query = query.eq('autonomy_level', filters.autonomy_level);
  }
  if (filters?.owner_id) {
    query = query.eq('owner_id', filters.owner_id);
  }
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,objective.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  
  // Fallback: if inner join fails (agents without versions), try without version join
  if (error) {
    let fallbackQuery = supabase
      .from('ai_agents')
      .select('*, profiles!ai_agents_owner_fk(full_name)')
      .is('archived_at', null)
      .order('created_at', { ascending: false });

    if (filters?.status) fallbackQuery = fallbackQuery.eq('status', filters.status);
    if (filters?.autonomy_level) fallbackQuery = fallbackQuery.eq('autonomy_level', filters.autonomy_level);
    if (filters?.owner_id) fallbackQuery = fallbackQuery.eq('owner_id', filters.owner_id);
    if (filters?.search) fallbackQuery = fallbackQuery.or(`name.ilike.%${filters.search}%,objective.ilike.%${filters.search}%`);

    const { data: fallbackData, error: fallbackError } = await fallbackQuery;
    if (fallbackError) throw fallbackError;

    return (fallbackData || []).map((row: any) => ({
      ...row,
      owner_name: row.profiles?.full_name || null,
      active_version_number: null,
    }));
  }

  return (data || []).map((row: any) => ({
    ...row,
    owner_name: row.profiles?.full_name || null,
    active_version_number: row.ai_agent_versions?.[0]?.version_number || null,
    profiles: undefined,
    ai_agent_versions: undefined,
  }));
}

export async function getAgentById(id: string): Promise<AIAgent | null> {
  const { data, error } = await supabase
    .from('ai_agents')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as AIAgent;
}

export async function createAgent(payload: CreateAgentPayload): Promise<{ agent: AIAgent }> {
  const { data, error } = await supabase.functions.invoke('create-ai-agent', {
    body: payload,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function updateAgent(id: string, payload: UpdateAgentPayload): Promise<AIAgent> {
  const { data: agent } = await supabase
    .from('ai_agents')
    .select('organization_id')
    .eq('id', id)
    .single();

  const { data, error } = await supabase
    .from('ai_agents')
    .update(payload as Record<string, unknown>)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  if (agent) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
      .single();

    await (supabase.from('ai_agent_audit') as any).insert({
      organization_id: agent.organization_id,
      agent_id: id,
      actor_id: profile?.id || null,
      action_type: 'updated',
      payload_json: payload,
    });
  }

  return data as unknown as AIAgent;
}

export async function archiveAgent(id: string): Promise<void> {
  const { data: agent } = await supabase
    .from('ai_agents')
    .select('organization_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('ai_agents')
    .update({ archived_at: new Date().toISOString(), is_active: false } as Record<string, unknown>)
    .eq('id', id);
  if (error) throw error;

  if (agent) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
      .single();

    await (supabase.from('ai_agent_audit') as any).insert({
      organization_id: agent.organization_id,
      agent_id: id,
      actor_id: profile?.id || null,
      action_type: 'archived',
      payload_json: {},
    });
  }
}
