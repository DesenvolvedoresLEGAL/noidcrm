import { supabase } from '@/integrations/supabase/client';

export async function runSimulation(
  agentId: string,
  versionId: string,
  scenario: Record<string, unknown>,
  executionMode: string = 'dry_run'
) {
  const { data, error } = await supabase.functions.invoke('run-agent-simulation', {
    body: { agent_id: agentId, agent_version_id: versionId, scenario, execution_mode: executionMode },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function getSimulationHistory(agentId: string, versionId?: string): Promise<any[]> {
  let query = (supabase as any)
    .from('ai_agent_simulation_runs')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (versionId) query = query.eq('agent_version_id', versionId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getTestScenarios(organizationId?: string): Promise<any[]> {
  const { data, error } = await (supabase as any)
    .from('ai_agent_test_scenarios')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveTestScenario(scenario: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('save-test-scenario', { body: scenario });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function submitFeedback(payload: { simulation_run_id: string; rating: number; feedback_type?: string; notes?: string }) {
  const { data, error } = await supabase.functions.invoke('submit-simulation-feedback', { body: payload });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
