import { supabase } from '@/integrations/supabase/client';

export type HypothesisStatus = 'pending' | 'approved' | 'running' | 'completed' | 'rejected' | 'promoted';
export type HypothesisType = 'template' | 'channel' | 'timing' | 'icp';

export interface ExperimentHypothesis {
  id: string;
  organization_id: string;
  hypothesis_type: HypothesisType;
  target_entity: string;
  target_id: string | null;
  description: string;
  source_insight_id: string | null;
  created_by: string;
  confidence_score: number;
  status: HypothesisStatus;
  winner_variant_id: string | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  promoted_at: string | null;
  created_at: string;
}

export interface ExperimentVariant {
  id: string;
  hypothesis_id: string;
  variant_label: string;
  is_control: boolean;
  content: Record<string, unknown>;
  allocation_percentage: number;
  created_at: string;
}

export interface ExperimentResult {
  id: string;
  hypothesis_id: string;
  variant_id: string;
  sent: number;
  replies: number;
  meetings: number;
  wins: number;
  reply_rate: number;
  meeting_rate: number;
  win_rate: number;
  score: number;
  sample_size: number;
  computed_at: string;
}

export interface AgentGuardrails {
  id: string;
  organization_id: string;
  max_experiments_per_day: number;
  max_variants_per_test: number;
  min_sample_size: number;
  min_lift_to_promote: number;
  allow_auto_apply: boolean;
  require_approval: boolean;
  experiments_enabled: boolean;
  allowed_hypothesis_types: string[];
  updated_at: string;
}

export async function fetchHypotheses(orgId: string): Promise<ExperimentHypothesis[]> {
  const { data, error } = await supabase
    .from('experiment_hypotheses' as any)
    .select('*')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as ExperimentHypothesis[];
}

export async function fetchVariants(hypothesisId: string): Promise<ExperimentVariant[]> {
  const { data, error } = await supabase
    .from('experiment_variants' as any)
    .select('*')
    .eq('hypothesis_id', hypothesisId)
    .order('variant_label', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ExperimentVariant[];
}

export async function fetchResults(hypothesisId: string): Promise<ExperimentResult[]> {
  const { data, error } = await supabase
    .from('experiment_results' as any)
    .select('*')
    .eq('hypothesis_id', hypothesisId);
  if (error) throw error;
  return (data ?? []) as unknown as ExperimentResult[];
}

export async function getOrCreateGuardrails(orgId: string): Promise<AgentGuardrails> {
  const { data, error } = await supabase.rpc('get_or_create_agent_guardrails' as any, { _org_id: orgId });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as AgentGuardrails;
}

export async function updateGuardrails(orgId: string, patch: Partial<AgentGuardrails>) {
  const { data, error } = await supabase
    .from('agent_guardrails' as any)
    .update(patch as any)
    .eq('organization_id', orgId)
    .select('*')
    .single();
  if (error) throw error;
  return data as unknown as AgentGuardrails;
}

export async function approveHypothesis(id: string) {
  const { data, error } = await supabase.rpc('approve_hypothesis' as any, { _hypothesis_id: id });
  if (error) throw error;
  // After approving, kick off variant generation (fire-and-forget)
  await supabase.functions.invoke('generate-variants', { body: { hypothesis_id: id } });
  return data;
}

export async function rejectHypothesis(id: string, reason?: string) {
  const { data, error } = await supabase.rpc('reject_hypothesis' as any, { _hypothesis_id: id, _reason: reason ?? null });
  if (error) throw error;
  return data;
}

export async function triggerGenerateHypotheses(orgId?: string) {
  const { data, error } = await supabase.functions.invoke('generate-experiment-hypothesis', {
    body: orgId ? { organization_id: orgId } : {},
  });
  if (error) throw error;
  return data;
}

export async function triggerEvaluateExperiments(orgId?: string) {
  const { data, error } = await supabase.functions.invoke('evaluate-experiment', {
    body: orgId ? { organization_id: orgId } : {},
  });
  if (error) throw error;
  return data;
}
