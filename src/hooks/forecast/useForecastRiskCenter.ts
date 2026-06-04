import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ForecastRiskCenterV2 } from '@/types/forecast-risk-center';

interface UseForecastRiskCenterParams {
  organizationId: string | null | undefined;
  pipelineId?: string | null;
  periodStart: string;
  periodEnd: string;
  sellerId?: string | null;
  enabled?: boolean;
}

export function useForecastRiskCenter({
  organizationId,
  pipelineId,
  periodStart,
  periodEnd,
  sellerId,
  enabled = true,
}: UseForecastRiskCenterParams) {
  const query = useQuery({
    queryKey: ['forecast-risk-center-v2', organizationId, pipelineId ?? null, periodStart, periodEnd, sellerId ?? null],
    enabled: !!organizationId && !!pipelineId && !!periodStart && !!periodEnd && enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<ForecastRiskCenterV2 | null> => {
      const { data, error } = await supabase.rpc('get_forecast_risk_center_v2' as any, {
        p_organization_id: organizationId,
        p_period_start: periodStart,
        p_period_end: periodEnd,
        p_pipeline_id: pipelineId ?? null,
        p_seller_id: sellerId ?? null,
      });
      if (error) throw error;
      return (data as unknown as ForecastRiskCenterV2) ?? null;
    },
  });

  return {
    riskCenter: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
