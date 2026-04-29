import { supabase } from '@/integrations/supabase/client';

export interface CloserDashboardViewRow {
  id: string;
  tenant_id: string;
  viewer_user_id: string;
  target_user_id: string;
  source: 'preview' | 'runtime';
  period: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export async function logCloserDashboardView(params: {
  tenantId: string;
  targetUserId: string;
  source: 'preview' | 'runtime';
  period?: string | null;
  metadata?: Record<string, any>;
}): Promise<string | null> {
  const { data, error } = await supabase.rpc('crm_log_closer_dashboard_view' as any, {
    p_tenant_id: params.tenantId,
    p_target_user_id: params.targetUserId,
    p_source: params.source,
    p_period: params.period ?? null,
    p_metadata: params.metadata ?? {},
  });
  if (error) {
    // soft fail — telemetria não deve quebrar UX
    return null;
  }
  return (data as unknown as string) ?? null;
}

export async function listCloserDashboardViews(
  tenantId: string,
  options: { limit?: number } = {},
): Promise<CloserDashboardViewRow[]> {
  const { data, error } = await (supabase as any)
    .from('crm_closer_dashboard_views')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 100);
  if (error || !data) return [];
  return data as CloserDashboardViewRow[];
}

export async function setUserDynamicDashboard(params: {
  tenantId: string;
  userId: string;
  enabled: boolean;
}): Promise<boolean> {
  const { data, error } = await supabase.rpc('crm_set_user_dynamic_dashboard' as any, {
    p_tenant_id: params.tenantId,
    p_user_id: params.userId,
    p_enabled: params.enabled,
  });
  if (error) throw error;
  return !!data;
}
