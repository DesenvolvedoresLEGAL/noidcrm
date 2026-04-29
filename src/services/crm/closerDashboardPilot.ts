import { supabase } from '@/integrations/supabase/client';

export interface PilotLogRow {
  id: string;
  tenant_id: string;
  target_user_id: string;
  changed_by: string;
  action: 'enable_pilot' | 'disable_user_pilot' | 'disable_tenant_dynamic_dashboard' | 'rollback';
  previous_global_flag: boolean | null;
  new_global_flag: boolean | null;
  previous_user_flag: boolean | null;
  new_user_flag: boolean | null;
  reason: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export async function enableCloserPilot(params: {
  tenantId: string;
  targetUserId: string;
  reason?: string;
}) {
  const { data, error } = await supabase.rpc('crm_enable_closer_dashboard_pilot' as any, {
    p_tenant_id: params.tenantId,
    p_target_user_id: params.targetUserId,
    p_reason: params.reason ?? null,
  });
  if (error) throw error;
  return data as any;
}

export async function disableCloserPilot(params: {
  tenantId: string;
  targetUserId: string;
  reason?: string;
}) {
  const { data, error } = await supabase.rpc('crm_disable_closer_dashboard_pilot' as any, {
    p_tenant_id: params.tenantId,
    p_target_user_id: params.targetUserId,
    p_reason: params.reason ?? null,
  });
  if (error) throw error;
  return data as any;
}

export async function disableTenantDynamicDashboards(params: {
  tenantId: string;
  reason?: string;
}) {
  const { data, error } = await supabase.rpc('crm_disable_tenant_dynamic_dashboards' as any, {
    p_tenant_id: params.tenantId,
    p_reason: params.reason ?? null,
  });
  if (error) throw error;
  return data as any;
}

export async function getTenantDynamicFlag(tenantId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('crm_feature_flags' as any)
    .select('enabled')
    .eq('tenant_id', tenantId)
    .eq('key', 'dynamic_dashboards_enabled')
    .maybeSingle();
  if (error) throw error;
  return !!(data as any)?.enabled;
}

export async function listPilotLogs(tenantId: string, limit = 50): Promise<PilotLogRow[]> {
  const { data, error } = await supabase
    .from('crm_dynamic_dashboard_pilot_logs' as any)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as unknown as PilotLogRow[];
}

export async function disableAllCloserDashboardPilots(params: {
  tenantId: string;
  reason?: string;
}) {
  const { data, error } = await supabase.rpc('crm_disable_all_closer_dashboard_pilots' as any, {
    p_tenant_id: params.tenantId,
    p_reason: params.reason ?? null,
  });
  if (error) throw error;
  return data as { success: boolean; disabled_count: number };
}

export async function getCloserPaceData(tenantId: string, userId: string) {
  const { data, error } = await supabase.rpc('crm_get_closer_pace_data' as any, {
    p_tenant_id: tenantId,
    p_user_id: userId,
  });
  if (error) throw error;
  return data as any;
}
