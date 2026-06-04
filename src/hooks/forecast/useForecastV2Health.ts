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
    enabled: !!organizationId && !!pipelineId && !!periodStart && !!periodEnd && enabled,
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
    onSuccess: (data: any) => {
      const summary = data && typeof data === 'object' ? data : null;
      const withOutcome = Number(summary?.predictions_with_outcome ?? 0);
      const total = Number(summary?.total_predictions ?? 0);
      if (!summary || (total === 0 && withOutcome === 0)) {
        toast.info('Acurácia recalculada', {
          description: 'Sem deals fechados com previsão registrada no período. Continue registrando previsões para acumular histórico.',
        });
      } else if (withOutcome === 0) {
        toast.info('Acurácia recalculada', {
          description: `${total} previsão(ões) registrada(s), aguardando deals serem fechados para medir acurácia.`,
        });
      } else {
        toast.success('Acurácia recalculada');
      }
      qc.invalidateQueries({ queryKey: ['forecast-v2-health'] });
      qc.invalidateQueries({ queryKey: ['forecast-accuracy-v2'] });
    },
    onError: (e: any) => toast.error('Falha ao calcular acurácia', { description: e?.message }),
  });
}

// F2.9 — Safe activator (UPSERT) for the Forecast V2 engine feature flag.
export function useActivateForecastV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { organizationId: string; enabled?: boolean }) => {
      const { data, error } = await supabase.rpc('activate_forecast_v2_engine' as any, {
        p_organization_id: p.organizationId,
        p_enabled: p.enabled ?? true,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Forecast Engine V2 ativada');
      qc.invalidateQueries({ queryKey: ['forecast-v2-health'] });
      qc.invalidateQueries({ queryKey: ['feature-flag'] });
    },
    onError: (e: any) =>
      toast.error('Não foi possível ativar a Forecast Engine V2', { description: e?.message }),
  });
}

export interface BootstrapStepResult {
  step: string;
  label: string;
  ok: boolean;
  error?: string;
}

// F2.9 — Bootstrap: roda em sequência audit → snapshot → accuracy → intelligence → risk → health.
// Cada etapa é independente: se uma falha, segue para a próxima.
export function useBootstrapForecastV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: ActionParams): Promise<BootstrapStepResult[]> => {
      const args = {
        p_organization_id: p.organizationId,
        p_pipeline_id: p.pipelineId ?? null,
        p_period_start: p.periodStart,
        p_period_end: p.periodEnd,
      };
      const steps: { step: string; label: string; rpc: string; payload: any }[] = [
        { step: 'run', label: 'Cálculo de auditoria', rpc: 'calculate_forecast_audit_v2', payload: args },
        { step: 'snapshot', label: 'Snapshot diário', rpc: 'create_forecast_daily_snapshot_v2', payload: args },
        { step: 'accuracy', label: 'Acurácia', rpc: 'calculate_forecast_accuracy_v2', payload: args },
        { step: 'intelligence', label: 'Forecast Intelligence', rpc: 'get_forecast_intelligence_v2', payload: { ...args, p_seller_id: null } },
        { step: 'risk', label: 'Risk Center', rpc: 'get_forecast_risk_center_v2', payload: { ...args, p_seller_id: null } },
        { step: 'health', label: 'Health Check', rpc: 'get_forecast_v2_health_check', payload: { p_organization_id: p.organizationId, p_period_start: p.periodStart, p_period_end: p.periodEnd, p_pipeline_id: p.pipelineId ?? null } },
      ];
      const results: BootstrapStepResult[] = [];
      for (const s of steps) {
        try {
          const { error } = await supabase.rpc(s.rpc as any, s.payload);
          if (error) throw error;
          results.push({ step: s.step, label: s.label, ok: true });
        } catch (err: any) {
          results.push({ step: s.step, label: s.label, ok: false, error: err?.message ?? 'erro' });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      const failed = results.filter((r) => !r.ok);
      if (failed.length === 0) {
        toast.success('Forecast V2 inicializado com sucesso');
      } else {
        toast.warning(`Forecast V2 inicializado com ${failed.length} alerta(s)`, {
          description: failed.map((f) => f.label).join(', '),
        });
      }
      qc.invalidateQueries({ queryKey: ['forecast-v2-health'] });
      qc.invalidateQueries({ queryKey: ['forecast-snapshots-v2'] });
      qc.invalidateQueries({ queryKey: ['forecast-snapshots'] });
      qc.invalidateQueries({ queryKey: ['forecast-accuracy-v2'] });
      qc.invalidateQueries({ queryKey: ['forecast-intelligence-v2'] });
      qc.invalidateQueries({ queryKey: ['forecast-risk-center-v2'] });
      qc.invalidateQueries({ queryKey: ['forecast-seller-performance-v2'] });
    },
    onError: (e: any) =>
      toast.error('Falha ao inicializar Forecast V2', { description: e?.message }),
  });
}
