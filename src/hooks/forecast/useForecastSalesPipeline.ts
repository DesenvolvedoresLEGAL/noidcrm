/**
 * Sprint F2.10 — Resolves the official sales pipeline for the Forecast V2 module.
 * The Forecast must always run against the canonical sales pipeline of the organization.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ForecastSalesPipelineInfo {
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

export function useForecastSalesPipeline({ organizationId, enabled = true }: Params) {
  const query = useQuery({
    queryKey: ['forecast-sales-pipeline-v2', organizationId],
    enabled: Boolean(enabled && organizationId),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async (): Promise<ForecastSalesPipelineInfo> => {
      const { data, error } = await supabase.rpc(
        'get_forecast_sales_pipeline_v2' as never,
        { p_organization_id: organizationId } as never,
      );
      if (error) throw error;
      const v = (data ?? {}) as Partial<ForecastSalesPipelineInfo>;
      return {
        pipeline_id: v.pipeline_id ?? null,
        pipeline_name: v.pipeline_name ?? null,
        pipeline_found: Boolean(v.pipeline_found),
        resolution_reason: v.resolution_reason ?? 'unknown',
        requires_configuration: Boolean(v.requires_configuration),
      };
    },
  });

  const info = query.data ?? null;

  return {
    salesPipelineId: info?.pipeline_id ?? null,
    salesPipelineName: info?.pipeline_name ?? null,
    pipelineFound: info?.pipeline_found ?? false,
    requiresConfiguration: info?.requires_configuration ?? false,
    resolutionReason: info?.resolution_reason ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
