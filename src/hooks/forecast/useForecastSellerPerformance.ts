import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ForecastSellerPerformance } from '@/types/forecast-seller';

interface UseForecastSellerPerformanceParams {
  organizationId: string | null | undefined;
  pipelineId?: string | null;
  periodStart: string;
  periodEnd: string;
  enabled?: boolean;
}

export function useForecastSellerPerformance({
  organizationId,
  pipelineId,
  periodStart,
  periodEnd,
  enabled = true,
}: UseForecastSellerPerformanceParams) {
  const query = useQuery({
    queryKey: [
      'forecast-seller-performance-v2',
      organizationId,
      pipelineId ?? null,
      periodStart,
      periodEnd,
    ],
    enabled: Boolean(enabled && organizationId && pipelineId && periodStart && periodEnd),
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_forecast_seller_performance_v2' as never,
        {
          p_organization_id: organizationId,
          p_pipeline_id: pipelineId ?? null,
          p_period_start: periodStart,
          p_period_end: periodEnd,
        } as never
      );
      if (error) throw error;
      return (data ?? []) as ForecastSellerPerformance[];
    },
    staleTime: 60_000,
  });

  return {
    sellers: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
