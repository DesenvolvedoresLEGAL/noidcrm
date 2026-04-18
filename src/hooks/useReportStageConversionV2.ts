/**
 * Sprint 2.8 — Hook V2 edge-based para Conversão por Estágio.
 */
import { useQuery } from '@tanstack/react-query';
import { callReportEdgeFunction } from '@/lib/reports/edgeReportClient';
import type { ReportEdgeRequest, ReportEdgeResponse } from '@/types/reportEdgeV2';
import type { ReportStageConversionV2 } from '@/types/reportingV2';

interface Args {
  organizationId?: string | null;
  request?: ReportEdgeRequest;
  enabled?: boolean;
}

export function useReportStageConversionV2({ organizationId, request, enabled = true }: Args) {
  const query = useQuery({
    queryKey: ['report-stage-conversion-v2', organizationId, request?.filters, request?.options],
    enabled: enabled && !!organizationId && !!request,
    staleTime: 60_000,
    queryFn: async (): Promise<ReportEdgeResponse<ReportStageConversionV2[]>> => {
      return callReportEdgeFunction<ReportStageConversionV2[]>('report_stage_conversion_v2', request!);
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
