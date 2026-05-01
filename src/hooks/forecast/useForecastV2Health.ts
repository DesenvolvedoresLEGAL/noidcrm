import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ForecastV2HealthCheck } from '@/types/forecast-health';

interface UseHealthParams {
  organizationId: string | null | undefined;
  pipelineId?: string | null;
  periodStart: string;
  periodEnd: string;
  enabled?: boolean;
}

export function useForecastV2Health({ organizationId, pipelineId, periodStart, periodEnd, enabled = true }: UseHealthParams) {
  const query = useQuery({
    queryKey: ['forecast-v2-health', organizationId, pipelineId ?? null, periodStart, periodEnd],
    enabled: !!organizationId && !!periodStart && !!periodEnd && enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<ForecastV2HealthCheck | null> => {
      const { data, error } = await supabase.rpc('get_forecast_v2_health_check' as any, {
        p_organization_id: organizationId,
        p_period_start: periodStart,
        p_period_end: periodEnd,
        p_pipeline_id: pipelineId ?? null,
      });
      if (error) throw error;
      return (data as unknown as ForecastV2HealthCheck) ?? null;
    },
  });

  return {
    health: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

interface ActionParams {
  organizationId: string;
  pipelineId?: string | null;
  periodStart: string;
  periodEnd: string;
}

export function useRecalculateForecast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: ActionParams) => {
      const { data, error } = await supabase.rpc('calculate_forecast_audit_v2' as any, {
        p_organization_id: p.organizationId,
        p_pipeline_id: p.pipelineId ?? null,
        p_period_start: p.periodStart,
        p_period_end: p.periodEnd,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Forecast recalculado com sucesso');
      qc.invalidateQueries({ queryKey: ['forecast-v2-health'] });
      qc.invalidateQueries({ queryKey: ['forecast-snapshots-v2'] });
      qc.invalidateQueries({ queryKey: ['forecast-intelligence-v2'] });
      qc.invalidateQueries({ queryKey: ['forecast-risk-center-v2'] });
      qc.invalidateQueries({ queryKey: ['forecast-seller-performance-v2'] });
    },
    onError: (e: any) => toast.error('Falha ao recalcular Forecast', { description: e?.message }),
  });
}

export function useGenerateSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: ActionParams) => {
      const { data, error } = await supabase.rpc('create_forecast_daily_snapshot_v2' as any, {
        p_organization_id: p.organizationId,
        p_pipeline_id: p.pipelineId ?? null,
        p_period_start: p.periodStart,
        p_period_end: p.periodEnd,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Snapshot gerado');
      qc.invalidateQueries({ queryKey: ['forecast-v2-health'] });
      qc.invalidateQueries({ queryKey: ['forecast-snapshots-v2'] });
      qc.invalidateQueries({ queryKey: ['forecast-accuracy-v2'] });
    },
    onError: (e: any) => toast.error('Falha ao gerar snapshot', { description: e?.message }),
  });
}

export function useCalculateAccuracy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: ActionParams) => {
      const { data, error } = await supabase.rpc('calculate_forecast_accuracy_v2' as any, {
        p_organization_id: p.organizationId,
        p_pipeline_id: p.pipelineId ?? null,
        p_period_start: p.periodStart,
        p_period_end: p.periodEnd,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Acurácia recalculada');
      qc.invalidateQueries({ queryKey: ['forecast-v2-health'] });
      qc.invalidateQueries({ queryKey: ['forecast-accuracy-v2'] });
    },
    onError: (e: any) => toast.error('Falha ao calcular acurácia', { description: e?.message }),
  });
}
