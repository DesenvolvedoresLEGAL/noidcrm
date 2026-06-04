/**
 * Sprint F2.10 — Resolves the official sales pipeline for the Forecast V2 module.
 * The Forecast must always run against the canonical sales pipeline of the organization.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ForecastSalesPipelineStatus = 'idle' | 'loading' | 'resolved' | 'not_configured' | 'error';

export interface ForecastSalesPipelineInfo {
  organization_id: string | null;
  pipeline_id: string | null;
  pipeline_name: string | null;
  pipeline_found: boolean;
  resolution_reason: string;
  requires_configuration: boolean;
}

interface Params {
  organizationId: string | null | undefined;
  enabled?: boolean;
}

function parseForecastSalesPipelineResponse(data: unknown, organizationId: string | null | undefined): ForecastSalesPipelineInfo {
  const v = (data ?? {}) as Record<string, unknown>;
  const pipelineId = typeof (v.pipeline_id ?? v.pipelineId) === 'string'
    ? ((v.pipeline_id ?? v.pipelineId) as string)
    : null;
  const pipelineName = typeof (v.pipeline_name ?? v.pipelineName) === 'string'
    ? ((v.pipeline_name ?? v.pipelineName) as string)
    : null;
  const pipelineFound = v.pipeline_found === true || v.pipelineFound === true;
  const requiresConfiguration = v.requires_configuration === true || v.requiresConfiguration === true;
  const resolutionReasonValue = v.resolution_reason ?? v.resolutionReason;

  return {
    organization_id: organizationId ?? null,
    pipeline_id: pipelineId,
    pipeline_name: pipelineName,
    pipeline_found: pipelineFound,
    resolution_reason: typeof resolutionReasonValue === 'string' ? resolutionReasonValue : 'unknown',
    requires_configuration: requiresConfiguration,
  };
}

export function useForecastSalesPipeline({ organizationId, enabled = true }: Params) {
  const queryEnabled = Boolean(enabled && organizationId);
  const query = useQuery({
    queryKey: ['forecast-sales-pipeline-v2', organizationId],
    enabled: queryEnabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<ForecastSalesPipelineInfo> => {
      const { data, error } = await supabase.rpc(
        'get_forecast_sales_pipeline_v2' as never,
        { p_organization_id: organizationId } as never,
      );
      if (error) throw error;
      return parseForecastSalesPipelineResponse(data, organizationId);
    },
  });

  const info = query.data ?? null;
  const infoMatchesOrganization = Boolean(info && info.organization_id === (organizationId ?? null));
  const hasPreviousData = Boolean(info && infoMatchesOrganization);
  const pipelineFound = infoMatchesOrganization && info?.pipeline_found === true;
  const pipelineId = infoMatchesOrganization ? (info?.pipeline_id ?? null) : null;
  const pipelineName = infoMatchesOrganization ? (info?.pipeline_name ?? null) : null;
  const requiresConfiguration = infoMatchesOrganization && info?.requires_configuration === true;
  const resolutionReason = infoMatchesOrganization ? (info?.resolution_reason ?? null) : null;
  const isResolved = queryEnabled && query.isSuccess && pipelineFound && Boolean(pipelineId);
  const status: ForecastSalesPipelineStatus = !queryEnabled
    ? 'idle'
    : query.isError
      ? 'error'
      : query.isSuccess && pipelineFound && Boolean(pipelineId)
        ? 'resolved'
        : query.isSuccess && pipelineFound === false && requiresConfiguration && resolutionReason === 'no_sales_pipeline_found'
          ? 'not_configured'
          : query.isLoading || (query.isFetching && !hasPreviousData) || !query.isSuccess
            ? 'loading'
            : 'loading';

  if (import.meta.env.DEV) {
    console.debug('[ForecastSalesPipeline]', {
      status,
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      isSuccess: query.isSuccess,
      pipelineFound,
      requiresConfiguration,
      pipelineId,
      pipelineName,
      resolutionReason,
    });
  }

  return {
    status,
    salesPipelineStatus: status,
    salesPipelineId: status === 'resolved' ? pipelineId : null,
    salesPipelineName: status === 'resolved' ? pipelineName : null,
    pipelineFound: status === 'resolved' ? pipelineFound : false,
    requiresConfiguration: status === 'not_configured' ? requiresConfiguration : false,
    resolutionReason,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isResolved,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
