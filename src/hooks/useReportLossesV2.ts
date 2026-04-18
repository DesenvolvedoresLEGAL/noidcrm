/**
 * Sprint 2.7 — Hook V2 edge-based para Losses (agregado).
 */
import { useQuery } from '@tanstack/react-query';
import { callReportEdgeFunction } from '@/lib/reports/edgeReportClient';
import type { ReportEdgeRequest, ReportEdgeResponse } from '@/types/reportEdgeV2';
import type { ReportLossesV2 } from '@/types/reportingV2';

interface Args {
  organizationId?: string | null;
  request?: ReportEdgeRequest;
  enabled?: boolean;
}

export function useReportLossesV2({ organizationId, request, enabled = true }: Args) {
  const query = useQuery({
    queryKey: ['report-losses-v2', organizationId, request?.filters, request?.options],
    enabled: enabled && !!organizationId && !!request,
    staleTime: 60_000,
    queryFn: async (): Promise<ReportEdgeResponse<ReportLossesV2[]>> => {
      return callReportEdgeFunction<ReportLossesV2[]>('report_losses_v2', request!);
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
