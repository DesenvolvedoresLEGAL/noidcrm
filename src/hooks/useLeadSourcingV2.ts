import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { toast } from 'sonner';

export interface SourcingPlaybook {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  playbook_type: string;
  description: string | null;
  input_schema: Record<string, any>;
  execution_config: Record<string, any>;
  source_config: Record<string, any>;
  approval_mode: string;
  auto_create_opportunities: boolean;
  auto_assign_owner: boolean;
  is_active: boolean;
  created_at: string;
}

export interface PlaybookRun {
  id: string;
  organization_id: string;
  playbook_id: string | null;
  icp_profile_id: string | null;
  triggered_by: string | null;
  status: string;
  input_payload: Record<string, any>;
  execution_log: any[];
  stats: Record<string, any>;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  error_summary?: string | null;
  retry_count?: number;
  execution_time_ms?: number | null;
}

export interface Prospect {
  id: string;
  organization_id: string;
  playbook_run_id: string;
  company_name: string;
  normalized_company_name: string | null;
  website: string | null;
  normalized_domain: string | null;
  industry: string | null;
  subcategory: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  phone_public: string | null;
  email_public: string | null;
  linkedin_url: string | null;
  summary: string | null;
  status: string;
  confidence: number | null;
  raw_data: Record<string, any>;
  source_label: string | null;
  source_url: string | null;
  duplicate_candidate: boolean;
  review_needed: boolean;
  recommended_next_action: string | null;
  matched_account_id: string | null;
  dedupe_status: string | null;
  approval_status: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  event_name: string | null;
  event_url: string | null;
  exhibitor_profile_url: string | null;
  booth: string | null;
  // Identity enrichment fields
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnae_code: string | null;
  cnae_desc: string | null;
  porte: string | null;
  endereco: string | null;
  cidade_enriched: string | null;
  uf_enriched: string | null;
  cep: string | null;
  identity_enriched_at: string | null;
  created_at: string;
  relationship_status?: 'customer' | 'opportunity_existing' | 'account_existing' | 'new_prospect' | null;
  prospect_scores: ProspectScore[] | null;
}

export interface ProspectScore {
  id: string;
  icp_fit_score: number;
  signal_score: number;
  data_quality_score: number;
  source_trust_score: number;
  penalty_score: number;
  priority_score: number;
  reasoning: Record<string, any>;
  grade: string | null;
}

export interface RunEvent {
  id: string;
  workspace_id: string;
  playbook_run_id: string;
  level: string;
  message: string;
  payload: Record<string, any>;
  created_at: string;
}

export function useSourcingPlaybooks() {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: ['sourcing-playbooks', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('sourcing_playbooks')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as SourcingPlaybook[];
    },
    enabled: !!organization?.id,
  });
}

export function usePlaybookRuns() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const orgId = organization?.id;

  // Realtime: invalida cache em mudanças (substitui polling de 5s)
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`playbook-runs-${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'playbook_runs', filter: `organization_id=eq.${orgId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['playbook-runs', orgId] });
          queryClient.invalidateQueries({ queryKey: ['playbook-runs-paginated', orgId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, queryClient]);

  return useQuery({
    queryKey: ['playbook-runs', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('playbook_runs')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as PlaybookRun[];
    },
    enabled: !!orgId,
    // Fallback polling (caso o realtime caia) — antes 5s, agora 60s
    refetchInterval: 60000,
  });
}

export function usePlaybookRunsPaginated(page: number, pageSize: number = 20) {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: ['playbook-runs-paginated', organization?.id, page, pageSize],
    queryFn: async () => {
      if (!organization?.id) return { runs: [], total: 0 };
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { count } = await supabase
        .from('playbook_runs')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organization.id);

      const { data, error } = await supabase
        .from('playbook_runs')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { runs: (data || []) as PlaybookRun[], total: count || 0 };
    },
    enabled: !!organization?.id,
    // Realtime já invalida via usePlaybookRuns — fallback 60s
    refetchInterval: 60000,
  });
}

export function useRunEvents(runId: string | null) {
  const queryClient = useQueryClient();

  // Realtime no run específico — sem polling agressivo
  useEffect(() => {
    if (!runId) return;
    const channel = supabase
      .channel(`run-events-${runId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'run_events', filter: `playbook_run_id=eq.${runId}` },
        () => queryClient.invalidateQueries({ queryKey: ['run-events', runId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [runId, queryClient]);

  return useQuery({
    queryKey: ['run-events', runId],
    queryFn: async () => {
      if (!runId) return [];
      const { data, error } = await supabase
        .from('run_events')
        .select('*')
        .eq('playbook_run_id', runId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as RunEvent[];
    },
    enabled: !!runId,
    // Realtime ativo acima; fallback longo apenas para reconexão.
    refetchInterval: 120000,
  });

}

export function useProspects(runId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!runId) return;
    const channel = supabase
      .channel(`prospects-${runId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prospects', filter: `playbook_run_id=eq.${runId}` },
        () => queryClient.invalidateQueries({ queryKey: ['prospects', runId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [runId, queryClient]);

  const query = useQuery({
    queryKey: ['prospects', runId],
    queryFn: async () => {
      if (!runId) return [];
      const { data, error } = await supabase
        .from('prospects')
        .select('*, prospect_scores(*)')
        .eq('playbook_run_id', runId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Prospect[];
    },
    enabled: !!runId,
    // Realtime ativo acima; fallback longo apenas para reconexão.
    refetchInterval: 180000,
  });


  // Background: classifica relationship_status de prospects ainda não verificados
  useEffect(() => {
    const list = query.data;
    if (!list || list.length === 0) return;
    const unverified = list.filter((p) => !p.relationship_status).map((p) => p.id);
    if (unverified.length === 0) return;

    let cancelled = false;
    (async () => {
      const BATCH = 5;
      for (let i = 0; i < unverified.length && !cancelled; i += BATCH) {
        const chunk = unverified.slice(i, i + BATCH);
        await Promise.all(
          chunk.map((prospect_id) =>
            supabase.functions
              .invoke('kairos-match-company', { body: { prospect_id } })
              .catch((err) => console.warn('[kairos-match] failed', prospect_id, err)),
          ),
        );
      }
      if (!cancelled) {
        queryClient.invalidateQueries({ queryKey: ['prospects', runId] });
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, runId]);

  return query;
}


export function useCreatePlaybookRun() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

  return useMutation({
    mutationFn: async (params: {
      playbookType: string;
      icpProfileId: string | null;
      inputPayload: Record<string, any>;
      importRules: {
        approvalMode: string;
        scoreThreshold: number;
        autoImport: boolean;
        autoCreateOpportunity: boolean;
        autoAssignOwner: boolean;
      };
    }) => {
      if (!organization?.id) throw new Error('No organization');

      const { data, error } = await supabase.functions.invoke('lead-sourcing', {
        body: {
          organization_id: organization.id,
          playbook_type: params.playbookType,
          icp_profile_id: params.icpProfileId,
          input_payload: params.inputPayload,
          import_rules: params.importRules,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['playbook-runs'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-runs-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      if (data?.async || data?.status === 'running') {
        toast.success('Busca de leads iniciada em background!');
        return;
      }
      toast.success('Busca de leads concluída!');
    },
    onError: (error) => {
      console.error('Playbook run error:', error);
      toast.error('Erro ao executar busca de leads');
    },
  });
}

export function useRetryPlaybookRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runId: string) => {
      const { data, error } = await supabase.functions.invoke('lead-sourcing', {
        body: { action: 'retry', run_id: runId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook-runs'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-runs-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['run-events'] });
      toast.success('Retry executado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao reprocessar execução');
    },
  });
}

export function usePlaybookPerformanceStats() {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: ['playbook-performance-stats', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;

      // Get all runs
      const { data: runs, error: runsError } = await supabase
        .from('playbook_runs')
        .select('id, status, stats, input_payload, execution_time_ms, created_at')
        .eq('organization_id', organization.id);
      if (runsError) throw runsError;

      // Get prospect counts by status
      const { data: prospects, error: prospectsError } = await supabase
        .from('prospects')
        .select('id, status, approval_status, playbook_run_id')
        .eq('organization_id', organization.id);
      if (prospectsError) throw prospectsError;

      // Get opportunities linked to lead_sourcing
      const { data: opportunities, error: oppsError } = await supabase
        .from('opportunities')
        .select('id, status, valor_previsto, owner_user_id, prospect_id, playbook_run_id')
        .eq('organization_id', organization.id)
        .not('prospect_id', 'is', null);
      if (oppsError) throw oppsError;

      // Get owner names for distribution
      const ownerIds = [...new Set((opportunities || []).map(o => o.owner_user_id).filter(Boolean))];
      let ownerMap: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', ownerIds);
        for (const p of (profiles || [])) {
          ownerMap[p.id] = p.full_name || 'Sem nome';
        }
      }

      const allRuns = runs || [];
      const allProspects = prospects || [];
      const allOpps = opportunities || [];

      const totalRuns = allRuns.length;
      const completedRuns = allRuns.filter(r => r.status === 'completed').length;
      const failedRuns = allRuns.filter(r => r.status === 'failed').length;
      const totalProspects = allProspects.length;
      const approvedProspects = allProspects.filter(p => p.status === 'approved' || p.approval_status === 'approved' || p.approval_status === 'imported').length;
      const importedProspects = allProspects.filter(p => p.approval_status === 'imported' || p.status === 'converted').length;
      const approvalRate = totalProspects > 0 ? (approvedProspects / totalProspects) * 100 : 0;
      const importRate = approvedProspects > 0 ? (importedProspects / approvedProspects) * 100 : 0;

      // Opportunity stats
      const totalOpps = allOpps.length;
      const wonOpps = allOpps.filter(o => o.status === 'won').length;
      const lostOpps = allOpps.filter(o => o.status === 'lost').length;
      const pipelineValue = allOpps.filter(o => o.status === 'open').reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
      const wonValue = allOpps.filter(o => o.status === 'won').reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
      const oppConversionRate = totalOpps > 0 ? (wonOpps / totalOpps) * 100 : 0;

      // Distribution by owner
      const byOwner: Record<string, { name: string; count: number; won: number; value: number }> = {};
      for (const o of allOpps) {
        const ownerId = o.owner_user_id || 'unassigned';
        if (!byOwner[ownerId]) byOwner[ownerId] = { name: ownerMap[ownerId] || 'Não atribuído', count: 0, won: 0, value: 0 };
        byOwner[ownerId].count++;
        if (o.status === 'won') { byOwner[ownerId].won++; byOwner[ownerId].value += (o.valor_previsto || 0); }
      }

      // Breakdown by type
      const byType: Record<string, { runs: number; prospects: number; approved: number; imported: number; opps: number; won: number }> = {};
      for (const run of allRuns) {
        const rPayload = run.input_payload as Record<string, any> | null;
        const type = rPayload?.playbookType || 'unknown';
        if (!byType[type]) byType[type] = { runs: 0, prospects: 0, approved: 0, imported: 0, opps: 0, won: 0 };
        byType[type].runs++;
      }
      for (const p of allProspects) {
        const run = allRuns.find(r => r.id === p.playbook_run_id);
        const rPayload2 = run?.input_payload as Record<string, any> | null;
        const type = rPayload2?.playbookType || 'unknown';
        if (!byType[type]) byType[type] = { runs: 0, prospects: 0, approved: 0, imported: 0, opps: 0, won: 0 };
        byType[type].prospects++;
        if (p.status === 'approved' || p.approval_status === 'approved' || p.approval_status === 'imported') byType[type].approved++;
        if (p.approval_status === 'imported' || p.status === 'converted') byType[type].imported++;
      }
      for (const o of allOpps) {
        if (o.playbook_run_id) {
          const run = allRuns.find(r => r.id === o.playbook_run_id);
          const rPayload3 = run?.input_payload as Record<string, any> | null;
          const type = rPayload3?.playbookType || 'unknown';
          if (byType[type]) {
            byType[type].opps++;
            if (o.status === 'won') byType[type].won++;
          }
        }
      }

      const avgExecutionTime = allRuns
        .filter(r => r.execution_time_ms)
        .reduce((sum, r, _, arr) => sum + (r.execution_time_ms || 0) / arr.length, 0);

      return {
        totalRuns,
        completedRuns,
        failedRuns,
        totalProspects,
        approvedProspects,
        importedProspects,
        approvalRate,
        importRate,
        avgExecutionTime,
        byType,
        totalOpps,
        wonOpps,
        lostOpps,
        pipelineValue,
        wonValue,
        oppConversionRate,
        byOwner,
      };
    },
    enabled: !!organization?.id,
  });
}

export function useUpdateProspectStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ prospectId, status }: { prospectId: string; status: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      const updateData: Record<string, any> = {
        status,
        updated_at: now,
        approval_status: status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : undefined,
      };

      if (status === 'approved') {
        updateData.approved_by = user?.id || null;
        updateData.approved_at = now;
      } else if (status === 'rejected') {
        updateData.rejected_by = user?.id || null;
        updateData.rejected_at = now;
      }

      Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

      const { data, error } = await supabase
        .from('prospects')
        .update(updateData)
        .eq('id', prospectId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-runs'] });
    },
  });
}

export function useDeletePlaybookRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runId: string) => {
      // Delete in order: signals → scores → prospects → events → sources/pages → run
      const { data: prospects } = await supabase
        .from('prospects')
        .select('id')
        .eq('playbook_run_id', runId);

      const prospectIds = (prospects || []).map(p => p.id);

      if (prospectIds.length > 0) {
        // Delete signals and scores for these prospects
        for (const chunk of chunkIds(prospectIds, 50)) {
          await supabase.from('prospect_signals').delete().in('prospect_id', chunk);
          await supabase.from('prospect_scores').delete().in('prospect_id', chunk);
        }
        // Delete prospects
        for (const chunk of chunkIds(prospectIds, 50)) {
          await supabase.from('prospects').delete().in('id', chunk);
        }
      }

      // Delete run events
      await supabase.from('run_events').delete().eq('playbook_run_id', runId);

      // Delete source pages and lead sources
      const { data: sources } = await supabase
        .from('lead_sources')
        .select('id')
        .eq('playbook_run_id', runId);
      
      if (sources?.length) {
        const sourceIds = sources.map(s => s.id);
        await supabase.from('source_pages').delete().in('lead_source_id', sourceIds);
        await supabase.from('lead_sources').delete().in('id', sourceIds);
      }

      // Delete the run itself
      const { error } = await supabase.from('playbook_runs').delete().eq('id', runId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook-runs'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-runs-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['run-events'] });
      toast.success('Execução deletada com sucesso');
    },
    onError: () => {
      toast.error('Erro ao deletar execução');
    },
  });
}

export function useCancelPlaybookRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runId: string) => {
      const { error } = await supabase
        .from('playbook_runs')
        .update({
          status: 'failed',
          error_summary: 'Execução cancelada manualmente pelo usuário',
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook-runs'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-runs-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['run-events'] });
      toast.success('Execução cancelada');
    },
    onError: () => {
      toast.error('Erro ao cancelar execução');
    },
  });
}

function chunkIds(ids: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

export function useBulkUpdateProspects() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ prospectIds, status }: { prospectIds: string[]; status: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      const updateData: Record<string, any> = {
        status,
        updated_at: now,
        approval_status: status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : undefined,
      };

      if (status === 'approved') {
        updateData.approved_by = user?.id || null;
        updateData.approved_at = now;
      } else if (status === 'rejected') {
        updateData.rejected_by = user?.id || null;
        updateData.rejected_at = now;
      }

      Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

      const { data, error } = await supabase
        .from('prospects')
        .update(updateData)
        .in('id', prospectIds)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-runs'] });
      toast.success(`${variables.prospectIds.length} prospects ${variables.status === 'approved' ? 'aprovados' : 'rejeitados'}`);
    },
    onError: () => {
      toast.error('Erro ao atualizar prospects');
    },
  });
}
