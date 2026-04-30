import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  getActiveUsers,
  getActiveSalesUsers,
  getActiveAssignableUsers,
  getActiveUsersByDepartment,
  getActiveUsersByBusinessFunction,
} from '@/services/crm/activeUsers';
import type { ActiveUserOption } from '@/types/activeUser';

const STALE = 60_000;

const useTenantId = () =>
  useQuery({
    queryKey: ['current-tenant-id'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_organization_id');
      if (error) throw error;
      return (data as string) ?? null;
    },
    staleTime: 5 * 60_000,
  });

export function useActiveUsers() {
  const { data: tenantId } = useTenantId();
  return useQuery<ActiveUserOption[]>({
    queryKey: ['active-users', tenantId, 'all'],
    queryFn: () => getActiveUsers(tenantId),
    enabled: !!tenantId,
    staleTime: STALE,
  });
}

export function useActiveSalesUsers() {
  const { data: tenantId } = useTenantId();
  return useQuery<ActiveUserOption[]>({
    queryKey: ['active-users', tenantId, 'sales'],
    queryFn: () => getActiveSalesUsers(tenantId),
    enabled: !!tenantId,
    staleTime: STALE,
  });
}

export function useActiveAssignableUsers() {
  const { data: tenantId } = useTenantId();
  return useQuery<ActiveUserOption[]>({
    queryKey: ['active-users', tenantId, 'assignable'],
    queryFn: () => getActiveAssignableUsers(tenantId),
    enabled: !!tenantId,
    staleTime: STALE,
  });
}

export function useActiveUsersByDepartment(departmentKey: string | null | undefined) {
  const { data: tenantId } = useTenantId();
  return useQuery<ActiveUserOption[]>({
    queryKey: ['active-users', tenantId, 'department', departmentKey],
    queryFn: () => getActiveUsersByDepartment(departmentKey || '', tenantId),
    enabled: !!tenantId && !!departmentKey,
    staleTime: STALE,
  });
}

export function useActiveUsersByFunction(functionKey: string | null | undefined) {
  const { data: tenantId } = useTenantId();
  return useQuery<ActiveUserOption[]>({
    queryKey: ['active-users', tenantId, 'function', functionKey],
    queryFn: () => getActiveUsersByBusinessFunction(functionKey || '', tenantId),
    enabled: !!tenantId && !!functionKey,
    staleTime: STALE,
  });
}
