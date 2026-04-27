import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useEnrichmentRun(prospectId: string | undefined) {
  return useQuery({
    queryKey: ['enrichment-run', prospectId],
    enabled: !!prospectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrichment_runs')
        .select('*')
        .eq('prospect_id', prospectId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useEnrichedCompanyProfile(prospectId: string | undefined) {
  return useQuery({
    queryKey: ['enriched-company-profile', prospectId],
    enabled: !!prospectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enriched_company_profiles')
        .select('*')
        .eq('prospect_id', prospectId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCommercialBrief(prospectId: string | undefined) {
  return useQuery({
    queryKey: ['commercial-brief', prospectId],
    enabled: !!prospectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commercial_briefs')
        .select('*')
        .eq('prospect_id', prospectId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useEnrichmentSignals(prospectId: string | undefined) {
  return useQuery({
    queryKey: ['enrichment-signals', prospectId],
    enabled: !!prospectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrichment_signals')
        .select('*')
        .eq('prospect_id', prospectId!)
        .order('weight', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useRunEnrichment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ prospectId, workspaceId, forceFallback }: { prospectId: string; workspaceId: string; forceFallback?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('run-enrichment', {
        body: { prospect_id: prospectId, workspace_id: workspaceId, force_fallback: !!forceFallback },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      const grade = (data as any)?.quality_grade;
      const score = (data as any)?.quality_score;
      const suffix = grade && typeof score === 'number' ? ` (${grade} · ${score}%)` : '';
      toast.success(`Enriquecimento concluído!${suffix}`);
      queryClient.invalidateQueries({ queryKey: ['enrichment-run', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['enriched-company-profile', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['commercial-brief', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['enrichment-signals', variables.prospectId] });
    },
    onError: (error) => {
      toast.error(`Erro no enriquecimento: ${error.message}`);
    },
  });
}
