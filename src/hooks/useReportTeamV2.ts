/**
 * Sprint 2.7 — Hook V2 edge-based para Team Performance.
 */
import { useQuery } from '@tanstack/react-query';
import { callReportEdgeFunction } from '@/lib/reports/edgeReportClient';
import type { ReportEdgeRequest, ReportEdgeResponse } from '@/types/reportEdgeV2';
import type { ReportTeamV2 } from '@/types/reportingV2';

interface Args {
  organizationId?: string | null;
  request?: ReportEdgeRequest;
  enabled?: boolean;
}

export function useReportTeamV2({ organizationId, request, enabled = true }: Args) {
  const query = useQuery({
    queryKey: ['report-team-v2', organizationId, request?.filters, request?.options],
    enabled: enabled && !!organizationId && !!request,
    staleTime: 60_000,
    queryFn: async (): Promise<ReportEdgeResponse<ReportTeamV2[]>> => {
      return callReportEdgeFunction<ReportTeamV2[]>('report_team_v2', request!);
    },
  });

  return {
    data: query.data?.data ?? [],
    meta: query.data?.meta ?? null,
    error: query.error ?? (query.data?.error ? new Error(query.data.error.message) : null),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
