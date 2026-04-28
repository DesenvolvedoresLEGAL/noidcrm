import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolveDashboardProfilePreview, type DashboardResolutionResult } from '@/services/crm/dashboardProfiles';

export type GuardDenyReason =
  | 'unauthenticated'
  | 'no_tenant'
  | 'global_flag_off'
  | 'user_flag_off'
  | 'not_a_closer'
  | 'resolver_denied'
  | 'no_profile';

export interface DynamicDashboardGuardResult {
  allowed: boolean;
  reason?: GuardDenyReason;
  resolution: DashboardResolutionResult | null;
  context: {
    tenantId: string | null;
    userId: string | null;
    businessFunctionKey: string | null;
    isUserDynamicEnabled: boolean;
    isGlobalDynamicEnabled: boolean;
  };
}

async function resolveGuard(tenantId: string, userId: string): Promise<DynamicDashboardGuardResult> {
  // 1. Global flag
  const { data: flag } = await supabase
    .from('crm_feature_flags' as any)
    .select('enabled')
    .eq('tenant_id', tenantId)
    .eq('key', 'dynamic_dashboards_enabled')
    .maybeSingle();
  const globalEnabled = !!(flag as any)?.enabled;

  // 2. User context
  const { data: ctx } = await supabase
    .from('crm_user_contexts' as any)
    .select('is_dashboard_dynamic_enabled, business_function_id, crm_business_functions:business_function_id(key)')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();

  const userEnabled = !!(ctx as any)?.is_dashboard_dynamic_enabled;
  const bfKey = (ctx as any)?.crm_business_functions?.key ?? null;

  const baseContext = {
    tenantId,
    userId,
    businessFunctionKey: bfKey,
    isUserDynamicEnabled: userEnabled,
    isGlobalDynamicEnabled: globalEnabled,
  };

  if (!globalEnabled) {
    return { allowed: false, reason: 'global_flag_off', resolution: null, context: baseContext };
  }
  if (!userEnabled) {
    return { allowed: false, reason: 'user_flag_off', resolution: null, context: baseContext };
  }
  if (bfKey !== 'closer') {
    return { allowed: false, reason: 'not_a_closer', resolution: null, context: baseContext };
  }

  // 3. Resolver
  let resolution: DashboardResolutionResult | null = null;
  try {
    resolution = await resolveDashboardProfilePreview(tenantId, userId);
  } catch (err) {
    return { allowed: false, reason: 'resolver_denied', resolution: null, context: baseContext };
  }

  if (!resolution?.should_use_dynamic_dashboard) {
    return { allowed: false, reason: 'resolver_denied', resolution, context: baseContext };
  }
  if (!resolution.resolved_profile) {
    return { allowed: false, reason: 'no_profile', resolution, context: baseContext };
  }

  return { allowed: true, resolution, context: baseContext };
}

export function useDynamicDashboardGuard(
  tenantId: string | null | undefined,
  userId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['dynamic-dashboard-guard', tenantId, userId],
    queryFn: () => resolveGuard(tenantId as string, userId as string),
    enabled: !!tenantId && !!userId,
    staleTime: 30_000,
  });
}
