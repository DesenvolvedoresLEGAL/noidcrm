import { supabase } from '@/integrations/supabase/client';
import type { AIAgent, CreateAgentPayload, UpdateAgentPayload } from '@/types/ai-agents';

export async function listAgents(filters?: {
  status?: string;
  autonomy_level?: string;
  search?: string;
}): Promise<AIAgent[]> {
  let query = supabase
    .from('ai_agents')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.autonomy_level) {
    query = query.eq('autonomy_level', filters.autonomy_level);
  }
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,objective.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as AIAgent[];
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
  // Get org for audit
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

  // Audit
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
