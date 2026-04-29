import { supabase } from '@/integrations/supabase/client';

export type DashboardFeedbackType = 'closer';

export interface SubmitFeedbackInput {
  tenantId: string;
  dashboardType: DashboardFeedbackType;
  rating: number;
  isUseful?: boolean | null;
  isConfusing?: boolean | null;
  isSlow?: boolean | null;
  missingInfo?: string | null;
  comment?: string | null;
  metadata?: Record<string, any>;
}

export interface FeedbackRow {
  id: string;
  tenant_id: string;
  user_id: string;
  dashboard_type: DashboardFeedbackType;
  rating: number;
  is_useful: boolean | null;
  is_confusing: boolean | null;
  is_slow: boolean | null;
  missing_info: string | null;
  comment: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface FeedbackSummary {
  total: number;
  avgRating: number | null;
  slowCount: number;
  confusingCount: number;
  usefulCount: number;
}

export async function submitDynamicDashboardFeedback(input: SubmitFeedbackInput) {
  const { data, error } = await (supabase as any).rpc('crm_submit_dynamic_dashboard_feedback', {
    p_tenant_id: input.tenantId,
    p_dashboard_type: input.dashboardType,
    p_rating: input.rating,
    p_is_useful: input.isUseful ?? null,
    p_is_confusing: input.isConfusing ?? null,
    p_is_slow: input.isSlow ?? null,
    p_missing_info: input.missingInfo ?? null,
    p_comment: input.comment ?? null,
    p_metadata: input.metadata ?? {},
  });
  if (error) throw error;
  return data as { success: boolean; feedback_id: string };
}

export async function getDynamicDashboardFeedbackList(
  tenantId: string,
  limit = 20,
): Promise<FeedbackRow[]> {
  const { data, error } = await (supabase as any)
    .from('crm_dynamic_dashboard_feedback')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[feedback] list failed', error.message);
    return [];
  }
  return (data ?? []) as FeedbackRow[];
}

export async function getDynamicDashboardFeedbackSummary(
  tenantId: string,
): Promise<FeedbackSummary> {
  const { data, error } = await (supabase as any)
    .from('crm_dynamic_dashboard_feedback')
    .select('rating, is_slow, is_confusing, is_useful')
    .eq('tenant_id', tenantId);
  if (error || !data) {
    return { total: 0, avgRating: null, slowCount: 0, confusingCount: 0, usefulCount: 0 };
  }
  const rows = data as Array<{
    rating: number;
    is_slow: boolean | null;
    is_confusing: boolean | null;
    is_useful: boolean | null;
  }>;
  if (rows.length === 0) {
    return { total: 0, avgRating: null, slowCount: 0, confusingCount: 0, usefulCount: 0 };
  }
  const total = rows.length;
  const avgRating = rows.reduce((s, r) => s + (r.rating ?? 0), 0) / total;
  const slowCount = rows.filter((r) => r.is_slow === true).length;
  const confusingCount = rows.filter((r) => r.is_confusing === true).length;
  const usefulCount = rows.filter((r) => r.is_useful === true).length;
  return {
    total,
    avgRating: Math.round(avgRating * 10) / 10,
    slowCount,
    confusingCount,
    usefulCount,
  };
}
