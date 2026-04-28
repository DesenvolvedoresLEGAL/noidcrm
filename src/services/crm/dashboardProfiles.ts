import { supabase } from '@/integrations/supabase/client';

export type DashboardScopeType =
  | 'user'
  | 'business_function'
  | 'department'
  | 'permission_role'
  | 'default';

export type DashboardResolutionSource =
  | 'user'
  | 'business_function'
  | 'department'
  | 'permission_role'
  | 'default'
  | 'legacy_fallback'
  | 'error_fallback';

export interface DashboardProfile {
  id: string;
  tenant_id: string;
  key: string;
  name: string;
  description: string | null;
  scope_type: DashboardScopeType;
  scope_key: string;
  layout: Record<string, any>;
  widgets: Array<Record<string, any>>;
  is_system: boolean;
  is_active: boolean;
}

export interface ResolvedDashboardProfile {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  scope_type: DashboardScopeType;
  scope_key: string;
  layout: Record<string, any>;
  widgets: Array<Record<string, any>>;
}

export interface DashboardCandidate {
  scope_type: DashboardScopeType;
  scope_key: string | null;
  matched: boolean;
  reason?: string;
  profile_key?: string;
}

export interface DashboardResolutionResult {
  success: boolean;
  mode: 'preview' | 'live';
  should_use_dynamic_dashboard: boolean;
  resolved_profile: ResolvedDashboardProfile | null;
  resolution_source: DashboardResolutionSource;
  fallback_used: boolean;
  fallback_reason: string | null;
  context: {
    permission_key: string | null;
    department_key: string | null;
    business_function_key: string | null;
    is_dashboard_dynamic_enabled: boolean;
    requires_review?: boolean;
  };
  candidate_profiles: DashboardCandidate[];
  flags: {
    dynamic_dashboards_enabled: boolean;
    dynamic_user_context_enabled: boolean;
  };
}

export interface DashboardResolutionLog {
  id: string;
  tenant_id: string;
  user_id: string;
  resolved_profile_id: string | null;
  resolved_profile_key: string | null;
  resolution_source: DashboardResolutionSource;
  fallback_used: boolean;
  fallback_reason: string | null;
  dynamic_dashboards_enabled: boolean;
  user_dashboard_enabled: boolean;
  context_snapshot: Record<string, any>;
  candidate_profiles: DashboardCandidate[];
  metadata: Record<string, any>;
  created_at: string;
}

export async function getDashboardProfiles(tenantId: string): Promise<DashboardProfile[]> {
  const { data, error } = await supabase
    .from('crm_dashboard_profiles' as any)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('scope_type', { ascending: true })
    .order('scope_key', { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as DashboardProfile[];
}

export async function resolveDashboardProfilePreview(
  tenantId: string,
  userId: string,
): Promise<DashboardResolutionResult> {
  const { data, error } = await supabase.rpc('crm_resolve_dashboard_profile' as any, {
    p_tenant_id: tenantId,
    p_user_id: userId,
    p_preview: true,
  });
  if (error) throw error;
  return data as unknown as DashboardResolutionResult;
}

export async function getDashboardResolutionLogs(
  tenantId: string,
  opts: { limit?: number } = {},
): Promise<DashboardResolutionLog[]> {
  const { data, error } = await supabase
    .from('crm_dashboard_resolution_logs' as any)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 50);
  if (error) throw error;
  return (data || []) as unknown as DashboardResolutionLog[];
}
