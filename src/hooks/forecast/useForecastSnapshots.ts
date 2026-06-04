import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ForecastDailySnapshot } from '@/types/forecast-snapshot';

interface UseForecastSnapshotsParams {
  organizationId?: string | null;
  pipelineId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  sellerId?: string | null;
  enabled?: boolean;
}

export function useForecastSnapshots(params: UseForecastSnapshotsParams) {
  const {
    organizationId,
    pipelineId = null,
    periodStart = null,
    periodEnd = null,
    sellerId = null,
    enabled = true,
  } = params;

  const query = useQuery({
    queryKey: [
      'forecast-snapshots',
      organizationId ?? null,
      pipelineId,
      periodStart,
      periodEnd,
      sellerId,
    ],
    enabled: enabled && !!organizationId && !!pipelineId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ForecastDailySnapshot[]> => {
      try {
        const { data, error } = await supabase.rpc('get_forecast_snapshots_v2', {
          p_organization_id: organizationId!,
          p_pipeline_id: pipelineId,
          p_period_start: periodStart,
          p_period_end: periodEnd,
          p_seller_id: sellerId,
        } as any);
        if (error) throw error;
        return (data || []) as unknown as ForecastDailySnapshot[];
      } catch (err) {
        // Resiliente: nunca quebrar UI
        console.error('[useForecastSnapshots] failed', err);
        return [];
      }
    },
  });

  const snapshots = query.data || [];
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const hasEnoughHistory = snapshots.length >= 5;

  return {
    snapshots,
    latestSnapshot,
    hasEnoughHistory,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

interface CreateSnapshotInput {
  organizationId: string;
  pipelineId: string;
  periodStart: string;
  periodEnd: string;
  sellerId?: string | null;
  snapshotDate?: string;
}

export function useCreateForecastSnapshot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSnapshotInput) => {
      const { data, error } = await supabase.rpc('create_forecast_daily_snapshot_v2', {
        p_organization_id: input.organizationId,
        p_pipeline_id: input.pipelineId,
        p_period_start: input.periodStart,
        p_period_end: input.periodEnd,
        p_seller_id: input.sellerId ?? null,
        p_snapshot_date: input.snapshotDate ?? new Date().toISOString().slice(0, 10),
      } as any);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Snapshot do Forecast gerado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['forecast-snapshots'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Falha ao gerar snapshot do Forecast');
    },
  });
}
