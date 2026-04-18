/**
 * Sprint 2.7 — Hook V2 edge-based para Summary.
 * Substitui implementação Sprint 2.5 (que lia view direto).
 */
import { useQuery } from '@tanstack/react-query';
import { callReportEdgeFunction } from '@/lib/reports/edgeReportClient';
import type { ReportEdgeRequest, ReportEdgeResponse } from '@/types/reportEdgeV2';
import type { ReportSummaryV2 } from '@/types/reportingV2';

interface Args {
  organizationId?: string | null;
  request?: ReportEdgeRequest;
  enabled?: boolean;
}

export function useReportSummaryV2({ organizationId, request, enabled = true }: Args) {
  const query = useQuery({
    queryKey: ['report-summary-v2', organizationId, request?.filters, request?.options],
    enabled: enabled && !!organizationId && !!request,
    staleTime: 60_000,
    queryFn: async (): Promise<ReportEdgeResponse<ReportSummaryV2>> => {
      const res = await callReportEdgeFunction<ReportSummaryV2>('report_summary_v2', request!);
      return res;
    },
  });

  return {
    data: query.data?.data ?? null,
    meta: query.data?.meta ?? null,
    error: query.error ?? (query.data?.error ? new Error(query.data.error.message) : null),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
