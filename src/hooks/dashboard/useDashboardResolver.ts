import { useMutation, useQuery } from '@tanstack/react-query';
import {
  getDashboardProfiles,
  getDashboardResolutionLogs,
  resolveDashboardProfilePreview,
  type DashboardResolutionResult,
} from '@/services/crm/dashboardProfiles';

export function useDashboardProfiles(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ['crm-dashboard-profiles', tenantId],
    queryFn: () => getDashboardProfiles(tenantId as string),
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

export function useResolveDashboardPreview() {
  return useMutation<
    DashboardResolutionResult,
    Error,
    { tenantId: string; userId: string }
  >({
    mutationFn: ({ tenantId, userId }) => resolveDashboardProfilePreview(tenantId, userId),
  });
}

export function useDashboardResolutionLogs(
  tenantId: string | null | undefined,
  opts: { limit?: number; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['crm-dashboard-resolution-logs', tenantId, opts.limit ?? 50],
    queryFn: () => getDashboardResolutionLogs(tenantId as string, { limit: opts.limit }),
    enabled: !!tenantId && opts.enabled !== false,
    staleTime: 15_000,
  });
}

/**
 * Reserved hook for the future dashboard switch.
 * IMPORTANT: do NOT call this from the real dashboard yet — Sprint 4 keeps the
 * legacy dashboard untouched. This is created only so Sprint 5 can plug in.
 */
export function useResolvedDashboardForCurrentUser(
  tenantId: string | null | undefined,
  userId: string | null | undefined,
  enabled = false,
) {
  return useQuery({
    queryKey: ['crm-dashboard-resolved-current', tenantId, userId],
    queryFn: () => resolveDashboardProfilePreview(tenantId as string, userId as string),
    enabled: enabled && !!tenantId && !!userId,
    staleTime: 60_000,
  });
}
