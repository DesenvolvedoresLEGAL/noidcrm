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
  viewer_name?: string | null;
  viewer_email?: string | null;
  target_name?: string | null;
  target_email?: string | null;
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
  const rows = data as CloserDashboardViewRow[];

  // Enriquece com nomes/emails dos profiles em uma única query
  const userIds = Array.from(
    new Set(rows.flatMap((r) => [r.viewer_user_id, r.target_user_id]).filter(Boolean)),
  );
  if (userIds.length === 0) return rows;
  const { data: profiles } = await (supabase as any)
    .from('profiles')
    .select('user_id, full_name, email')
    .in('user_id', userIds);
  const map = new Map<string, { full_name: string | null; email: string | null }>();
  for (const p of (profiles ?? []) as any[]) {
    map.set(p.user_id, { full_name: p.full_name ?? null, email: p.email ?? null });
  }
  return rows.map((r) => ({
    ...r,
    viewer_name: map.get(r.viewer_user_id)?.full_name ?? null,
    viewer_email: map.get(r.viewer_user_id)?.email ?? null,
    target_name: map.get(r.target_user_id)?.full_name ?? null,
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
  return !!data;
}
