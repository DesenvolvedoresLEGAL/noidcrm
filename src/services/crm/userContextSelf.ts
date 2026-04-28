import { supabase } from '@/integrations/supabase/client';
import type { UserContextRow } from '@/services/crm/userContext';

/**
 * Fetch the CRM context for a single user (typically the current user).
 * Read-only helper used by ProfileSettings to surface the active context
 * (Permissão / Área / Função / Status / Dashboard dinâmico).
 */
export async function fetchUserContextSelf(
  tenantId: string,
  userId: string,
): Promise<UserContextRow | null> {
  const [ctxRes, profileRes, memberRes] = await Promise.all([
    supabase
      .from('crm_user_context_view' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('user_id, full_name, email')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('organization_members')
      .select('org_role, status')
      .eq('user_id', userId)
      .eq('organization_id', tenantId)
      .maybeSingle(),
  ]);

  if (ctxRes.error && ctxRes.error.code !== 'PGRST116') throw ctxRes.error;

  const c: any = ctxRes.data ?? null;
  const p: any = profileRes.data ?? null;
  const m: any = memberRes.data ?? null;

  return {
    context_id: c?.id ?? null,
    tenant_id: tenantId,
    user_id: userId,
    status: c?.status ?? null,
    legacy_user_type: c?.legacy_user_type ?? null,
    legacy_commercial_function: c?.legacy_commercial_function ?? null,
    permission_key: c?.permission_key ?? null,
    permission_name: c?.permission_name ?? null,
    department_key: c?.department_key ?? null,
    department_name: c?.department_name ?? null,
    business_function_key: c?.business_function_key ?? null,
    business_function_name: c?.business_function_name ?? null,
    manager_user_id: c?.manager_user_id ?? null,
    is_dashboard_dynamic_enabled: !!c?.is_dashboard_dynamic_enabled,
    metadata: c?.metadata ?? {},
    full_name: p?.full_name ?? null,
    email: p?.email ?? null,
    org_role: m?.org_role ?? null,
    member_status: m?.status ?? null,
  };
}
