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
  created_at: string;
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
  return useQuery({
    queryKey: ['playbook-runs', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('playbook_runs')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as PlaybookRun[];
    },
    enabled: !!organization?.id,
  });
}

export function useProspects(runId: string | null) {
  return useQuery({
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
  });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook-runs'] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      toast.success('Busca de leads concluída!');
    },
    onError: (error) => {
      console.error('Playbook run error:', error);
      toast.error('Erro ao executar busca de leads');
    },
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

      // Remove undefined
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
