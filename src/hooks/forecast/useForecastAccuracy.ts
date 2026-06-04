import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  ForecastAccuracySummary,
  ForecastSellerAccuracy,
} from '@/types/forecast-accuracy';

interface UseForecastAccuracyParams {
  organizationId: string | null | undefined;
  pipelineId?: string | null;
  periodStart: string;
  periodEnd: string;
  sellerId?: string | null;
  enabled?: boolean;
}

export function useForecastAccuracy({
  organizationId,
  pipelineId,
  periodStart,
  periodEnd,
  sellerId,
  enabled = true,
}: UseForecastAccuracyParams) {
  const qc = useQueryClient();
  const ready = Boolean(enabled && organizationId && pipelineId && periodStart && periodEnd);

  const summaryKey = [
    'forecast-accuracy-v2',
    organizationId,
    pipelineId ?? null,
    periodStart,
    periodEnd,
    sellerId ?? null,
  ];

  const sellerKey = [
    'forecast-seller-accuracy-v2',
    organizationId,
    pipelineId ?? null,
    periodStart,
    periodEnd,
  ];

  const summaryQuery = useQuery({
    queryKey: summaryKey,
    enabled: ready,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'calculate_forecast_accuracy_v2' as never,
        {
          p_organization_id: organizationId,
          p_pipeline_id: pipelineId ?? null,
          p_period_start: periodStart,
          p_period_end: periodEnd,
          p_seller_id: sellerId ?? null,
        } as never
      );
      if (error) throw error;
      return (data ?? null) as ForecastAccuracySummary | null;
    },
  });

  const sellerQuery = useQuery({
    queryKey: sellerKey,
    enabled: ready && !sellerId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_forecast_seller_accuracy_v2' as never,
        {
          p_organization_id: organizationId,
          p_pipeline_id: pipelineId ?? null,
          p_period_start: periodStart,
          p_period_end: periodEnd,
        } as never
      );
      if (error) throw error;
      return (data ?? []) as ForecastSellerAccuracy[];
    },
  });

  const calculateAccuracy = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: summaryKey }),
      qc.invalidateQueries({ queryKey: sellerKey }),
    ]);
    await Promise.all([summaryQuery.refetch(), sellerQuery.refetch()]);
  };

  return {
    accuracy: summaryQuery.data ?? null,
    sellerAccuracy: sellerQuery.data ?? [],
    isLoading: summaryQuery.isLoading || sellerQuery.isLoading,
    error: (summaryQuery.error || sellerQuery.error) as Error | null,
    calculateAccuracy,
    refetch: () => {
      summaryQuery.refetch();
      sellerQuery.refetch();
    },
  };
}
