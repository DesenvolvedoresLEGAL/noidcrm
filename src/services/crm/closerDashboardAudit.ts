import { supabase } from '@/integrations/supabase/client';

export type CloserDashboardViewSource = 'preview' | 'runtime';

export interface CloserDashboardView {
  id: string;
  tenant_id: string;
  viewer_user_id: string;
  target_user_id: string;
  source: CloserDashboardViewSource;
  period: string | null;
  metadata: Record<string, any>;
  created_at: string;
  viewer_name?: string | null;
  viewer_email?: string | null;
  target_name?: string | null;
  target_email?: string | null;
}

export async function logCloserDashboardView(params: {
  tenantId: string;
  targetUserId: string;
  source: CloserDashboardViewSource;
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
    // Best-effort logging — do not break UI
    console.warn('[closer-audit] log failed', error);
    return null;
  }
  return (data as string) ?? null;
}

export async function listCloserDashboardViews(
  tenantId: string,
  opts: { limit?: number } = {},
): Promise<CloserDashboardView[]> {
  const { data, error } = await supabase
    .from('crm_closer_dashboard_views' as any)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 100);
  if (error) throw error;

  const rows = (data || []) as unknown as CloserDashboardView[];
  if (rows.length === 0) return rows;

  // Hydrate viewer/target names from profiles (best-effort)
  const ids = Array.from(new Set(rows.flatMap((r) => [r.viewer_user_id, r.target_user_id])));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, full_name, email')
    .in('user_id', ids);

  const map = new Map<string, { name: string | null; email: string | null }>();
  (profiles || []).forEach((p: any) => {
    map.set(p.user_id, { name: p.full_name ?? null, email: p.email ?? null });
  });

  return rows.map((r) => ({
    ...r,
    viewer_name: map.get(r.viewer_user_id)?.name ?? null,
    viewer_email: map.get(r.viewer_user_id)?.email ?? null,
    target_name: map.get(r.target_user_id)?.name ?? null,
    target_email: map.get(r.target_user_id)?.email ?? null,
  }));
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
  return data as boolean;
}
