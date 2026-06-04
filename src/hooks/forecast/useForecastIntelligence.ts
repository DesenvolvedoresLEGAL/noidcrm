import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ForecastIntelligenceV2 } from '@/types/forecast-intelligence';

interface Params {
  organizationId: string | null | undefined;
  pipelineId?: string | null;
  periodStart: string;
  periodEnd: string;
  sellerId?: string | null;
  enabled?: boolean;
}

export function useForecastIntelligence({
  organizationId,
  pipelineId,
  periodStart,
  periodEnd,
  sellerId,
  enabled = true,
}: Params) {
  const query = useQuery({
    queryKey: [
      'forecast-intelligence-v2',
      organizationId,
      pipelineId ?? null,
      periodStart,
      periodEnd,
      sellerId ?? null,
    ],
    enabled: Boolean(enabled && organizationId && pipelineId && periodStart && periodEnd),
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_forecast_intelligence_v2' as never,
        {
          p_organization_id: organizationId,
          p_pipeline_id: pipelineId ?? null,
          p_period_start: periodStart,
          p_period_end: periodEnd,
          p_seller_id: sellerId ?? null,
        } as never
      );
      if (error) throw error;
      return (data ?? null) as ForecastIntelligenceV2 | null;
    },
    staleTime: 60_000,
    retry: 1,
  });

  return {
    intelligence: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}
