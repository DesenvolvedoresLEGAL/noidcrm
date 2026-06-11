import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  listAutopilotRuns, getAutopilotRun, listAutopilotItems, listAutopilotLogs, getAutopilotKpis,
  type AutopilotRun, type AutopilotItem, type AutopilotLog, type AutopilotKpis, type AutopilotConfig,
} from '@/services/intelligence/autopilot';

export function useAutopilotRuns() {
  const { organization } = useCurrentUser();
  const qc = useQueryClient();

  useEffect(() => {
    if (!organization?.id) return;
    const ch = supabase
      .channel(`autopilot-runs-${organization.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kairos_batch_runs', filter: `organization_id=eq.${organization.id}` }, () => {
        qc.invalidateQueries({ queryKey: ['autopilot-runs'] });
        qc.invalidateQueries({ queryKey: ['autopilot-kpis'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [organization?.id, qc]);

  return useQuery<AutopilotRun[]>({
    queryKey: ['autopilot-runs', organization?.id],
    enabled: !!organization?.id,
    queryFn: () => listAutopilotRuns(organization!.id),
    staleTime: 15_000,
  });
}

export function useAutopilotRun(runId: string | null | undefined) {
  return useQuery<AutopilotRun | null>({
    queryKey: ['autopilot-run', runId],
    enabled: !!runId,
    queryFn: () => getAutopilotRun(runId!),
    refetchInterval: 5000,
  });
}

export function useAutopilotItems(runId: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!runId) return;
    const ch = supabase
      .channel(`autopilot-items-${runId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kairos_batch_run_items', filter: `run_id=eq.${runId}` }, () => {
        qc.invalidateQueries({ queryKey: ['autopilot-items', runId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [runId, qc]);
  return useQuery<AutopilotItem[]>({
    queryKey: ['autopilot-items', runId],
    enabled: !!runId,
    queryFn: () => listAutopilotItems(runId!),
  });
}

export function useAutopilotLogs(runId: string | null | undefined) {
  return useQuery<AutopilotLog[]>({
    queryKey: ['autopilot-logs', runId],
    enabled: !!runId,
    queryFn: () => listAutopilotLogs(runId!),
    refetchInterval: 5000,
  });
}

export function useAutopilotKpis() {
  const { organization } = useCurrentUser();
  return useQuery<AutopilotKpis>({
    queryKey: ['autopilot-kpis', organization?.id],
    enabled: !!organization?.id,
    queryFn: () => getAutopilotKpis(organization!.id),
    staleTime: 30_000,
  });
}

export interface StartAutopilotInput {
  prospect_ids?: string[];
  playbook_run_id?: string;
  event_id?: string | null;
  lead_search_id?: string | null;
  run_name?: string;
  config?: AutopilotConfig;
  estimate_only?: boolean;
}

export function useEstimateAutopilot() {
  return useMutation({
    mutationFn: async (input: StartAutopilotInput) => {
      const { data, error } = await supabase.functions.invoke('kairos-autopilot-start', {
        body: { ...input, estimate_only: true },
      });
      if (error) throw error;
      return data as { eligible: number; total: number; apollo_eligible: number; credits_estimated: number; credits_limit?: number };
    },
  });
}

export function useStartAutopilot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: StartAutopilotInput) => {
      const { data, error } = await supabase.functions.invoke('kairos-autopilot-start', { body: input });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['autopilot-runs'] });
      toast.success('Autopilot iniciado');
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao iniciar Autopilot'),
  });
}

export function useAutopilotControl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ run_id, action }: { run_id: string; action: 'pause' | 'resume' | 'cancel' }) => {
      const { data, error } = await supabase.functions.invoke('kairos-autopilot-control', {
        body: { run_id, action },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['autopilot-runs'] });
      qc.invalidateQueries({ queryKey: ['autopilot-run', vars.run_id] });
      toast.success(vars.action === 'pause' ? 'Execução pausada' : vars.action === 'resume' ? 'Execução retomada' : 'Execução cancelada');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
