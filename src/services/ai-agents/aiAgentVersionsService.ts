import { supabase } from '@/integrations/supabase/client';
import type { AIAgentVersion } from '@/types/ai-agents';

export async function listVersions(agentId: string): Promise<AIAgentVersion[]> {
  const { data, error } = await supabase
    .from('ai_agent_versions')
    .select('*')
    .eq('agent_id', agentId)
    .order('version_number', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as AIAgentVersion[];
}

export async function getActiveVersion(agentId: string): Promise<AIAgentVersion | null> {
  const { data, error } = await supabase
    .from('ai_agent_versions')
    .select('*')
    .eq('agent_id', agentId)
    .eq('is_active', true)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return (data as unknown as AIAgentVersion) || null;
}
