/**
 * Sprint 2.7 — Hook V2 edge-based para Forecast.
 */
import { useQuery } from '@tanstack/react-query';
import { callReportEdgeFunction } from '@/lib/reports/edgeReportClient';
import type { ReportEdgeRequest, ReportEdgeResponse } from '@/types/reportEdgeV2';

interface Args {
  organizationId?: string | null;
  request?: ReportEdgeRequest;
  enabled?: boolean;
}

export function useReportForecastV2({ organizationId, request, enabled = true }: Args) {
  const query = useQuery({
    queryKey: ['report-forecast-v2', organizationId, request?.filters, request?.options],
    enabled: enabled && !!organizationId && !!request,
    staleTime: 60_000,
    queryFn: async (): Promise<ReportEdgeResponse<any>> => {
      return callReportEdgeFunction<any>('report_forecast_v2', request!);
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
