import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCloserDashboardViews, setUserDynamicDashboard } from '@/services/crm/closerDashboardAudit';

export function useCloserDashboardViews(tenantId: string | null | undefined, limit = 100) {
  return useQuery({
    queryKey: ['crm-closer-dashboard-views', tenantId, limit],
    queryFn: () => listCloserDashboardViews(tenantId as string, { limit }),
    enabled: !!tenantId,
    staleTime: 15_000,
  });
}

export function useSetUserDynamicDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setUserDynamicDashboard,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['user-contexts', vars.tenantId] });
      qc.invalidateQueries({ queryKey: ['crm-user-contexts'] });
    },
  });
}
