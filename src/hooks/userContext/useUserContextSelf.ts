import { useQuery } from '@tanstack/react-query';
import { fetchUserContextSelf } from '@/services/crm/userContextSelf';

export function useUserContextSelf(
  tenantId: string | null | undefined,
  userId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['user-context-self', tenantId, userId],
    queryFn: () => fetchUserContextSelf(tenantId!, userId!),
    enabled: !!tenantId && !!userId,
    staleTime: 30 * 1000,
  });
}
