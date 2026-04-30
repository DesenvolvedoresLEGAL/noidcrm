/**
 * Sprint Active Users Source of Truth
 * ------------------------------------
 * Único ponto de leitura para popular filtros, selects, dropdowns e campos
 * de Responsável/Vendedor/Owner em telas operacionais do CRM.
 *
 * Fonte: public.crm_active_users_view (security_invoker)
 *  - Apenas organization_members com status='active' e deleted_at IS NULL
 *  - Respeita RLS das tabelas base (multi-tenant garantido)
 *
 * NUNCA buscar diretamente de:
 *  - profiles (sem filtro de membership ativo)
 *  - organization_members (sem deleted_at IS NULL e status='active')
 * para alimentar UI de seleção operacional.
 *
 * Telas administrativas (Equipes e Usuários, abas Inativos/Excluídos) NÃO
 * devem usar este serviço — elas precisam ver o histórico completo.
 */
import { supabase } from '@/integrations/supabase/client';
import type { ActiveUserOption } from '@/types/activeUser';

const SALES_ROLES = new Set(['sales', 'cs']);

const toOption = (row: any): ActiveUserOption => ({
  tenant_id: row.tenant_id,
  user_id: row.user_id,
  full_name: row.full_name || 'Usuário sem nome',
  email: row.email ?? null,
  avatar_url: row.avatar_url ?? null,
  org_role: row.org_role ?? null,
  status: 'active',
  context_permission_key: row.context_permission_key ?? null,
  context_department_key: row.context_department_key ?? null,
  context_business_function_key: row.context_business_function_key ?? null,
  context_business_function_name: row.context_business_function_name ?? null,
  context_department_name: row.context_department_name ?? null,
  is_dashboard_dynamic_enabled: row.is_dashboard_dynamic_enabled ?? null,
  label: row.full_name || 'Usuário sem nome',
  value: row.user_id,
});

async function resolveTenantId(tenantId?: string | null): Promise<string | null> {
  if (tenantId) return tenantId;
  const { data, error } = await supabase.rpc('get_user_organization_id');
  if (error) {
    console.error('[activeUsers] resolveTenantId error:', error);
    return null;
  }
  return (data as string) ?? null;
}

export async function getActiveUsers(tenantId?: string | null): Promise<ActiveUserOption[]> {
  const tid = await resolveTenantId(tenantId);
  if (!tid) return [];
  const { data, error } = await (supabase as any)
    .from('crm_active_users_view')
    .select('*')
    .eq('tenant_id', tid)
    .order('full_name');
  if (error) {
    console.error('[activeUsers] getActiveUsers error:', error);
    return [];
  }
  return (data || []).map(toOption);
}

export async function getActiveSalesUsers(tenantId?: string | null): Promise<ActiveUserOption[]> {
  const all = await getActiveUsers(tenantId);
  return all.filter((u) => u.org_role && SALES_ROLES.has(u.org_role));
}

export async function getActiveAssignableUsers(tenantId?: string | null): Promise<ActiveUserOption[]> {
  // Assignable = qualquer usuário ativo do tenant (CRM uniforme).
  return getActiveUsers(tenantId);
}

export async function getActiveUsersByDepartment(
  departmentKey: string,
  tenantId?: string | null,
): Promise<ActiveUserOption[]> {
  const all = await getActiveUsers(tenantId);
  return all.filter((u) => u.context_department_key === departmentKey);
}

export async function getActiveUsersByBusinessFunction(
  functionKey: string,
  tenantId?: string | null,
): Promise<ActiveUserOption[]> {
  const all = await getActiveUsers(tenantId);
  return all.filter((u) => u.context_business_function_key === functionKey);
}

/**
 * Verifica se um user_id é um usuário ativo do tenant.
 * Usar antes de salvar atribuições (owner/responsible/seller).
 */
export async function isActiveUser(userId: string, tenantId?: string | null): Promise<boolean> {
  if (!userId) return false;
  const tid = await resolveTenantId(tenantId);
  if (!tid) return false;
  const { data, error } = await (supabase as any)
    .from('crm_active_users_view')
    .select('user_id')
    .eq('tenant_id', tid)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[activeUsers] isActiveUser error:', error);
    return false;
  }
  return !!data;
}
