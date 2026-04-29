import { supabase } from '@/integrations/supabase/client';

export type InsightType = 'signal' | 'template' | 'channel' | 'playbook' | 'provider';
export type RecommendationType =
  | 'score_adjustment'
  | 'rule_change'
  | 'template_change'
  | 'channel_shift'
  | 'playbook_change';
export type RecommendationStatus = 'pending' | 'accepted' | 'dismissed' | 'auto_applied' | 'failed' | 'rolled_back';

export interface OptimizationInsight {
  id: string;
  organization_id: string;
  insight_type: InsightType;
  entity_id: string | null;
  entity_label: string | null;
  metric_name: string | null;
  metric_value: number | null;
  baseline_value: number | null;
  delta: number | null;
  sample_size: number;
  confidence_score: number;
  detected_at: string;
  created_at: string;
}

export interface OptimizationRecommendation {
  id: string;
  organization_id: string;
  insight_id: string | null;
  recommendation_type: RecommendationType;
  target_type: string | null;
  target_id: string | null;
  title: string;
  description: string | null;
  impact_estimate: number | null;
  confidence_score: number;
  action_payload: Record<string, unknown>;
  status: RecommendationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rolled_back_at: string | null;
  rolled_back_by: string | null;
  created_at: string;
}

export interface OptimizationImpactSummary {
  applied_last_7d: number;
  rolled_back_last_7d: number;
  impact_estimate_sum: number;
  pending_count: number;
  failed_last_7d: number;
}

export interface OptimizationActionLog {
  id: string;
  organization_id: string;
  recommendation_id: string | null;
  action_type: string;
  executed: boolean;
  result: Record<string, unknown>;
  error_message: string | null;
  executed_by: string | null;
  executed_at: string;
}

export async function fetchInsights(organizationId: string): Promise<OptimizationInsight[]> {
  const { data, error } = await supabase
    .from('optimization_insights' as any)
    .select('*')
    .eq('organization_id', organizationId)
    .order('detected_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as OptimizationInsight[];
}

export async function fetchRecommendations(
  organizationId: string,
  status?: RecommendationStatus,
): Promise<OptimizationRecommendation[]> {
  let q = supabase
    .from('optimization_recommendations' as any)
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as OptimizationRecommendation[];
}

export async function fetchActionsLog(organizationId: string): Promise<OptimizationActionLog[]> {
  const { data, error } = await supabase
    .from('optimization_actions_log' as any)
    .select('*')
    .eq('organization_id', organizationId)
    .order('executed_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as OptimizationActionLog[];
}

export async function applyRecommendation(recommendationId: string) {
  const { data, error } = await supabase.functions.invoke('apply-recommendation', {
    body: { recommendation_id: recommendationId },
  });
  if (error) throw error;
  return data;
}

export async function dismissRecommendation(recommendationId: string) {
  const { data, error } = await supabase.rpc('dismiss_optimization_recommendation' as any, {
    _rec_id: recommendationId,
  });
  if (error) throw error;
  return data;
}

export async function setOptimizationAutoMode(organizationId: string, enabled: boolean) {
  const { data, error } = await supabase.rpc('set_optimization_auto_mode' as any, {
    _org_id: organizationId,
    _enabled: enabled,
  });
  if (error) throw error;
  return data;
}

export async function triggerComputeInsights(organizationId?: string) {
  const { data, error } = await supabase.functions.invoke('compute-optimization-insights', {
    body: organizationId ? { organization_id: organizationId } : {},
  });
  if (error) throw error;
  return data;
}

export async function triggerGenerateRecommendations(organizationId?: string) {
  const { data, error } = await supabase.functions.invoke('generate-recommendations', {
    body: organizationId ? { organization_id: organizationId } : {},
  });
  if (error) throw error;
  return data;
}

export async function rollbackRecommendation(recommendationId: string) {
  const { data, error } = await supabase.functions.invoke('rollback-recommendation', {
    body: { recommendation_id: recommendationId },
  });
  if (error) throw error;
  return data;
}

export async function fetchImpactSummary(organizationId: string): Promise<OptimizationImpactSummary> {
  const { data, error } = await supabase.rpc('get_optimization_impact_summary' as any, {
    _org_id: organizationId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    applied_last_7d: Number(row?.applied_last_7d ?? 0),
    rolled_back_last_7d: Number(row?.rolled_back_last_7d ?? 0),
    impact_estimate_sum: Number(row?.impact_estimate_sum ?? 0),
    pending_count: Number(row?.pending_count ?? 0),
    failed_last_7d: Number(row?.failed_last_7d ?? 0),
  };
}
