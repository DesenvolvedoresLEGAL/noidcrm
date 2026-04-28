import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  enableCloserPilot,
  disableCloserPilot,
  disableTenantDynamicDashboards,
  getTenantDynamicFlag,
  listPilotLogs,
} from '@/services/crm/closerDashboardPilot';

const invalidateGuards = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['dynamic-dashboard-guard'] });
  qc.invalidateQueries({ queryKey: ['tenant-dynamic-flag'] });
  qc.invalidateQueries({ queryKey: ['user-contexts'] });
  qc.invalidateQueries({ queryKey: ['pilot-logs'] });
  qc.invalidateQueries({ queryKey: ['closer-pilot-entrypoint'] });
};

export function useEnableCloserPilot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: enableCloserPilot,
    onSuccess: () => invalidateGuards(qc),
  });
}

export function useDisableCloserPilot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: disableCloserPilot,
    onSuccess: () => invalidateGuards(qc),
  });
}

export function useDisableTenantDynamicDashboards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: disableTenantDynamicDashboards,
    onSuccess: () => invalidateGuards(qc),
  });
}

export function useTenantDynamicFlag(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ['tenant-dynamic-flag', tenantId],
    queryFn: () => getTenantDynamicFlag(tenantId as string),
    enabled: !!tenantId,
    staleTime: 15_000,
  });
}

export function usePilotLogs(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ['pilot-logs', tenantId],
    queryFn: () => listPilotLogs(tenantId as string),
    enabled: !!tenantId,
    staleTime: 15_000,
  });
}
