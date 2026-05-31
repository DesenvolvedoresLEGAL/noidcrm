import { supabase } from '@/integrations/supabase/client';

export interface LossSemanticRow {
  opportunity_id: string;
  organization_id: string;
  pipeline_id: string | null;
  owner_user_id: string | null;
  status: string;
  closed_at: string | null;
  lost_at: string | null;
  seller_loss_reason_id: string | null;
  client_loss_reason_id: string | null;
  consolidated_loss_reason_id: string | null;
  loss_classification_status: string | null;
  loss_coverage_bucket: string | null;
  competitor_human: string | null;

  ai_detected_loss_category: string | null;
  ai_detected_loss_reason: string | null;
  ai_detected_competitor: string | null;
  ai_confidence_score: number | null;
  diagnosis_quality_score: number | null;
  seller_customer_gap: boolean | null;
  gap_explanation: string | null;
  recommended_action: string | null;
  is_recoverable_inferred: boolean | null;
  analyzed_at: string | null;
  model_used: string | null;
  rule_version: string | null;

  seller_diagnosis_excerpt: string | null;
  ai_summary_excerpt: string | null;
  customer_comment_excerpt: string | null;
  is_recoverable_effective: boolean | null;
  valor_previsto: number | null;
  opportunity_title: string | null;
}

export interface LossSemanticDetail extends LossSemanticRow {
  // Texto completo só lido em escopo de detalhe (LGPD)
  source_texts: {
    seller_diagnosis: string | null;
    customer_comment: string | null;
    free_text: string | null;
    origins: Array<{ field: string; source: string; captured_at: string | null }>;
  } | null;
}

export async function fetchLossSemanticForPeriod(
  organizationId: string,
  from: Date,
  to: Date,
  pipelineIds?: string[],
): Promise<LossSemanticRow[]> {
  let q = supabase
    .from('v_loss_semantic_v2' as any)
    .select('*')
    .eq('organization_id', organizationId)
    .gte('closed_at', from.toISOString())
    .lte('closed_at', to.toISOString());

  if (pipelineIds && pipelineIds.length > 0) {
    q = q.in('pipeline_id', pipelineIds);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as unknown as LossSemanticRow[];
}

export async function fetchLossSemanticDetail(
  opportunityId: string,
): Promise<LossSemanticDetail | null> {
  // Junta view + source_texts (que está só na tabela base)
  const [viewRes, baseRes] = await Promise.all([
    supabase
      .from('v_loss_semantic_v2' as any)
      .select('*')
      .eq('opportunity_id', opportunityId)
      .maybeSingle(),
    supabase
      .from('loss_semantic_analyses')
      .select('source_texts')
      .eq('opportunity_id', opportunityId)
      .maybeSingle(),
  ]);
  if (viewRes.error) throw viewRes.error;
  if (!viewRes.data) return null;
  return {
    ...(viewRes.data as unknown as LossSemanticRow),
    source_texts: (baseRes.data?.source_texts as any) || null,
  };
}

export async function analyzeOpportunityLoss(
  opportunityId: string,
  forceRefresh = false,
): Promise<LossSemanticDetail> {
  const { data, error } = await supabase.functions.invoke('ai-loss-semantic-analyzer', {
    body: { opportunityId, force_refresh: forceRefresh },
  });
  if (error) throw error;
  return data as LossSemanticDetail;
}
