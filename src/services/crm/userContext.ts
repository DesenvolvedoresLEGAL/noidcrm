import { supabase } from '@/integrations/supabase/client';

export interface PermissionRole {
  id: string;
  key: string;
  name: string;
  level: number | null;
  is_active: boolean;
}

export interface Department {
  id: string;
  key: string;
  name: string;
  sort_order: number | null;
  is_active: boolean;
}

export interface BusinessFunction {
  id: string;
  key: string;
  name: string;
  department_id: string;
  function_group: string | null;
  is_sales_related: boolean | null;
  is_active: boolean;
}

export interface UserContextOptions {
  permissions: PermissionRole[];
  departments: Department[];
  functions: BusinessFunction[];
}

export interface UserContextRow {
  context_id: string | null;
  tenant_id: string;
  user_id: string;
  status: string | null;
  legacy_user_type: string | null;
  legacy_commercial_function: string | null;
  permission_key: string | null;
  permission_name: string | null;
  department_key: string | null;
  department_name: string | null;
  business_function_key: string | null;
  business_function_name: string | null;
  manager_user_id: string | null;
  is_dashboard_dynamic_enabled: boolean;
  metadata: Record<string, any>;
  // Member info
  full_name: string | null;
  email: string | null;
  org_role: string | null;
  member_status: string | null;
}

export interface SaveUserContextPayload {
  tenant_id: string;
  user_id: string;
  permission_role_id: string;
  department_id: string;
  business_function_id: string;
  manager_user_id?: string | null;
  status: 'active' | 'inactive' | 'pending' | 'blocked';
  mark_as_reviewed?: boolean;
  review_note?: string | null;
}

export async function fetchUserContextOptions(tenantId: string): Promise<UserContextOptions> {
  const [perms, depts, funcs] = await Promise.all([
    supabase
      .from('crm_permission_roles' as any)
      .select('id, key, name, level, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('level', { ascending: false }),
    supabase
      .from('crm_departments' as any)
      .select('id, key, name, sort_order, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('crm_business_functions' as any)
      .select('id, key, name, department_id, function_group, is_sales_related, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ]);

  if (perms.error) throw perms.error;
  if (depts.error) throw depts.error;
  if (funcs.error) throw funcs.error;

  return {
    permissions: (perms.data || []) as unknown as PermissionRole[],
    departments: (depts.data || []) as unknown as Department[],
    functions: (funcs.data || []) as unknown as BusinessFunction[],
  };
}

export async function fetchUserContexts(tenantId: string, organizationId: string): Promise<UserContextRow[]> {
  const [ctxRes, memRes] = await Promise.all([
    supabase
      .from('crm_user_context_view' as any)
      .select('*')
      .eq('tenant_id', tenantId),
    supabase
      .from('organization_members')
      .select('user_id, org_role, status')
      .eq('organization_id', organizationId)
      .in('status', ['active', 'suspended']),
  ]);

  if (ctxRes.error) throw ctxRes.error;
  if (memRes.error) throw memRes.error;

  const members = (memRes.data || []) as Array<{ user_id: string; org_role: string; status: string }>;
  const userIds = members.map((m) => m.user_id);

  let profiles: Array<{ user_id: string; full_name: string | null; email: string | null }> = [];
  if (userIds.length) {
    const { data: pData } = await supabase
      .from('profiles')
      .select('user_id, full_name, email')
      .in('user_id', userIds);
    profiles = (pData || []) as any;
  }

  const ctxByUser = new Map<string, any>();
  (ctxRes.data || []).forEach((c: any) => ctxByUser.set(c.user_id, c));

  const profileByUser = new Map(profiles.map((p) => [p.user_id, p]));

  return members.map((m) => {
    const c = ctxByUser.get(m.user_id);
    const p = profileByUser.get(m.user_id);
    return {
      context_id: c?.id ?? null,
      tenant_id: tenantId,
      user_id: m.user_id,
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
      org_role: m.org_role,
      member_status: m.status,
    };
  });
}

export async function saveUserContext(payload: SaveUserContextPayload) {
  const { data, error } = await supabase.rpc('crm_save_user_context' as any, {
    payload: payload as any,
  });
  if (error) throw error;
  return data as { context_id: string; change_type: string; requires_review: boolean; created: boolean };
}
