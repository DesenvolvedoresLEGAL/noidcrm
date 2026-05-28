import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ResponsibleOption = { id: string; name: string; email?: string | null; role?: string | null };

const normalizeRole = (role?: string | null) =>
  (role || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[._/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();

const SALES_OWNER_ROLES = new Set(['vendedor', 'closer', 'executivo de vendas', 'consultor comercial', 'account executive', 'ae']);
const PRE_SALES_ROLES = new Set(['sdr', 'bdr', 'pre vendas', 'pre vendedor', 'pre sales', 'prospector']);
const CS_ROLES = new Set(['cs', 'customer success', 'onboarding', 'implantacao', 'pos vendas', 'account manager', 'am', 'csm']);
const BLOCKED_ACCESS_ROLES = new Set(['admin', 'manager', 'super admin', 'superadmin']);

const roleSetFor = <T extends { user_id: string | null; role?: string | null; org_role?: string | null }>(
  rows: T[] | null,
  field: 'role' | 'org_role',
) => {
  const byUser = new Map<string, Set<string>>();

  (rows || []).forEach((row) => {
    if (!row.user_id) return;
    const normalized = normalizeRole(row[field]);
    if (!normalized) return;

    const current = byUser.get(row.user_id) || new Set<string>();
    current.add(normalized);
    byUser.set(row.user_id, current);
  });

  return byUser;
};

export function useAccountResponsibleOptions() {
  const query = useQuery({
    queryKey: ['account-responsible-options'],
    queryFn: async () => {
      const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');
      if (orgError || !orgId) throw orgError || new Error('Organização não encontrada');

      const [membersResult, sellersResult, rolesResult] = await Promise.all([
        supabase.from('organization_members').select('user_id, org_role, status').eq('organization_id', orgId).eq('status', 'active'),
        supabase.from('sellers').select('user_id, name, email, role, active').eq('organization_id', orgId).eq('active', true),
        supabase.from('user_roles').select('user_id, role'),
      ]);

      if (membersResult.error) throw membersResult.error;
      if (sellersResult.error) throw sellersResult.error;
      if (rolesResult.error) throw rolesResult.error;

      const activeMemberIds = new Set((membersResult.data || []).map((member) => member.user_id).filter(Boolean));
      const orgRolesByUser = roleSetFor(membersResult.data || [], 'org_role');
      const appRolesByUser = roleSetFor(rolesResult.data || [], 'role');

      const hasBlockedAccessRole = (userId: string) => {
        const allRoles = [...(orgRolesByUser.get(userId) || []), ...(appRolesByUser.get(userId) || [])];
        return allRoles.some((role) => BLOCKED_ACCESS_ROLES.has(role));
      };

      const hasAppRole = (userId: string, role: 'sales' | 'cs') => appRolesByUser.get(userId)?.has(role) === true;

      const commercialUsers = (sellersResult.data || [])
        .filter((seller) => seller.user_id && activeMemberIds.has(seller.user_id) && !hasBlockedAccessRole(seller.user_id))
        .map((seller) => ({
          id: seller.user_id!,
          name: seller.name || seller.email || 'Usuário sem nome',
          email: seller.email,
          role: seller.role,
        })) as ResponsibleOption[];

      const byRole = (allowedSellerRoles: Set<string>, requiredAppRole: 'sales' | 'cs') =>
        commercialUsers
          .filter((user) => hasAppRole(user.id, requiredAppRole) && allowedSellerRoles.has(normalizeRole(user.role)))
          .sort((a, b) => a.name.localeCompare(b.name));

      return {
        owners: byRole(SALES_OWNER_ROLES, 'sales'),
        preSales: byRole(PRE_SALES_ROLES, 'sales'),
        cs: byRole(CS_ROLES, 'cs'),
      };
    },
    // Fase 1A: opções mudam raramente; cache 10min evita refetch a cada mount.
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });


  return {
    ownerUsers: query.data?.owners || [],
    preSalesUsers: query.data?.preSales || [],
    csUsers: query.data?.cs || [],
    isLoading: query.isLoading,
    error: query.error,
  };
}