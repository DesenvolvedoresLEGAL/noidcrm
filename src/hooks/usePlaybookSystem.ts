import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { toast } from 'sonner';

export interface Playbook {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  steps: any[];
  trigger_conditions: any;
  target_persona: string | null;
  target_stage: string | null;
  target_temperature: string | null;
  success_metrics: any;
  is_active: boolean;
  is_ai_generated: boolean;
  usage_count: number;
  success_rate: number | null;
  avg_deal_value: number | null;
  version: number;
  current_version_id: string | null;
  roi_score: number;
  total_revenue_generated: number;
  total_cost_hours: number;
  conversion_rate: number;
  avg_cycle_time_days: number | null;
  auto_disabled: boolean;
  disabled_reason: string | null;
  disabled_at: string | null;
  min_sample_size: number;
  roi_threshold: number;
  category: string | null;
  complexity: string;
  estimated_hours: number;
  created_at: string;
  updated_at: string;
}

export interface PlaybookVersion {
  id: string;
  playbook_id: string;
  version_number: number;
  version_label: string | null;
  name: string;
  status: string;
  executions_count: number;
  success_count: number;
  conversion_rate: number;
  total_revenue: number;
  roi_score: number;
  deployed_at: string;
  deployed_by: string | null;
}

export interface PlaybookExecution {
  id: string;
  playbook_id: string;
  opportunity_id: string;
  status: string;
  outcome: string | null;
  started_at: string;
  finished_at: string | null;
  converted: boolean;
  revenue_generated: number;
  cost_hours: number | null;
  roi_value: number | null;
  cycle_time_days: number | null;
  effectiveness_rating: number | null;
  feedback: string | null;
}

export function usePlaybooks() {
  const { organization } = useCurrentOrganization();

  return useQuery({
    queryKey: ['playbooks', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];

      const { data, error } = await supabase
        .from('ai_playbooks')
        .select('*')
        .eq('organization_id', organization.id)
        .order('usage_count', { ascending: false });

      if (error) throw error;
      return data as Playbook[];
    },
    enabled: !!organization?.id,
  });
}

export function usePlaybookVersions(playbookId: string | null) {
  return useQuery({
    queryKey: ['playbook-versions', playbookId],
    queryFn: async () => {
      if (!playbookId) return [];

      const { data, error } = await supabase
        .from('playbook_versions')
        .select('*')
        .eq('playbook_id', playbookId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      return data as PlaybookVersion[];
    },
    enabled: !!playbookId,
  });
}

export function usePlaybookExecutions(playbookId?: string) {
  const { organization } = useCurrentOrganization();

  return useQuery({
    queryKey: ['playbook-executions', organization?.id, playbookId],
    queryFn: async () => {
      if (!organization?.id) return [];

      let query = supabase
        .from('playbook_executions')
        .select(`
          *,
          ai_playbooks(name, category),
          opportunities(title, valor_previsto)
        `)
        .eq('organization_id', organization.id)
        .order('started_at', { ascending: false })
        .limit(100);

      if (playbookId) {
        query = query.eq('playbook_id', playbookId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });
}

export function usePlaybookROIAnalysis() {
  const { organization } = useCurrentOrganization();

  return useQuery({
    queryKey: ['playbook-roi-analysis', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;

      const { data, error } = await supabase.functions.invoke('analyze-playbook-roi', {
        body: { organization_id: organization.id },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreatePlaybook() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

  return useMutation({
    mutationFn: async (playbook: Partial<Playbook>) => {
      if (!organization?.id) throw new Error('No organization');

      const insertData = {
        name: playbook.name || 'Novo Playbook',
        organization_id: organization.id,
        steps: playbook.steps || [],
        trigger_conditions: playbook.trigger_conditions || {},
        description: playbook.description,
        target_persona: playbook.target_persona,
        target_stage: playbook.target_stage,
        target_temperature: playbook.target_temperature,
        success_metrics: playbook.success_metrics,
        category: playbook.category,
        complexity: playbook.complexity || 'moderate',
        estimated_hours: playbook.estimated_hours || 2,
        is_active: playbook.is_active !== false,
      };

      const { data, error } = await supabase
        .from('ai_playbooks')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      toast.success('Playbook criado com sucesso');
    },
    onError: (error) => {
      console.error('Error creating playbook:', error);
      toast.error('Erro ao criar playbook');
    },
  });
}

export function useUpdatePlaybook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Playbook> & { id: string }) => {
      const { data, error } = await supabase
        .from('ai_playbooks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      toast.success('Playbook atualizado');
    },
    onError: (error) => {
      console.error('Error updating playbook:', error);
      toast.error('Erro ao atualizar playbook');
    },
  });
}

export function useDeployPlaybookVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ playbookId, versionLabel }: { playbookId: string; versionLabel?: string }) => {
      const { data, error } = await supabase.rpc('deploy_playbook_version', {
        p_playbook_id: playbookId,
        p_version_label: versionLabel || null,
        p_deployed_by: (await supabase.auth.getUser()).data.user?.id || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-versions'] });
      toast.success('Nova versão deployada com sucesso');
    },
    onError: (error) => {
      console.error('Error deploying version:', error);
      toast.error('Erro ao deployar versão');
    },
  });
}

export function useRollbackPlaybook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ playbookId, targetVersionId, reason }: { 
      playbookId: string; 
      targetVersionId: string;
      reason?: string;
    }) => {
      const { data, error } = await supabase.rpc('rollback_playbook_version', {
        p_playbook_id: playbookId,
        p_target_version_id: targetVersionId,
        p_reason: reason || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-versions'] });
      toast.success('Rollback realizado com sucesso');
    },
    onError: (error) => {
      console.error('Error rolling back:', error);
      toast.error('Erro ao fazer rollback');
    },
  });
}

export function useStartPlaybookExecution() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

  return useMutation({
    mutationFn: async ({ playbookId, opportunityId }: { playbookId: string; opportunityId: string }) => {
      const { data, error } = await supabase.functions.invoke('execute-playbook', {
        body: {
          action: 'start',
          playbook_id: playbookId,
          opportunity_id: opportunityId,
          organization_id: organization?.id,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook-executions'] });
      toast.success('Execução do playbook iniciada');
    },
    onError: (error) => {
      console.error('Error starting execution:', error);
      toast.error('Erro ao iniciar execução');
    },
  });
}

export function useFinishPlaybookExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      executionId, 
      outcome, 
      feedback, 
      effectivenessRating 
    }: { 
      executionId: string; 
      outcome?: string;
      feedback?: string;
      effectivenessRating?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('execute-playbook', {
        body: {
          action: 'finish',
          execution_id: executionId,
          outcome,
          feedback,
          effectiveness_rating: effectivenessRating,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook-executions'] });
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-roi-analysis'] });
      toast.success('Execução finalizada');
    },
    onError: (error) => {
      console.error('Error finishing execution:', error);
      toast.error('Erro ao finalizar execução');
    },
  });
}

export function useTogglePlaybook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { data, error } = await supabase
        .from('ai_playbooks')
        .update({ 
          is_active: isActive,
          auto_disabled: false,
          disabled_reason: null,
          disabled_at: null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      toast.success(isActive ? 'Playbook ativado' : 'Playbook desativado');
    },
  });
}

export function useGeneratePlaybookFromWinLoss() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

  return useMutation({
    mutationFn: async (params: {
      target_stage?: string;
      target_persona?: string;
      category?: string;
    }) => {
      if (!organization?.id) throw new Error('No organization');

      const { data, error } = await supabase.functions.invoke('generate-playbook-from-winloss', {
        body: {
          organization_id: organization.id,
          ...params,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      toast.success('Playbook gerado com sucesso a partir dos dados de Win/Loss');
    },
    onError: (error) => {
      console.error('Error generating playbook from win/loss:', error);
      toast.error('Erro ao gerar playbook');
    },
  });
}
