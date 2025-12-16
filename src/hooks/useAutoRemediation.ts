import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AutoRemediationTrigger {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_conditions: {
    health_score_below?: number;
    days_in_stage_above?: number;
    driver_present?: string;
  };
  action_type: 'execute_playbook' | 'create_activity' | 'notify' | 'escalate';
  playbook_id: string | null;
  action_config: Record<string, any> | null;
  cooldown_hours: number;
  max_triggers_per_deal: number;
  trigger_count: number;
  success_count: number;
  last_triggered_at: string | null;
  created_at: string;
}

export interface AutoRemediationExecution {
  id: string;
  organization_id: string;
  trigger_id: string | null;
  opportunity_id: string;
  health_score_at_trigger: number | null;
  drivers_at_trigger: any[] | null;
  playbook_id: string | null;
  playbook_execution_id: string | null;
  status: 'triggered' | 'executing' | 'completed' | 'failed' | 'skipped';
  health_score_after: number | null;
  outcome_status: 'improved' | 'unchanged' | 'worsened' | 'deal_won' | 'deal_lost' | null;
  outcome_recorded_at: string | null;
  created_at: string;
}

export function useAutoRemediationTriggers() {
  return useQuery({
    queryKey: ['auto-remediation-triggers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_remediation_triggers')
        .select(`
          *,
          ai_playbooks:playbook_id (id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (AutoRemediationTrigger & { ai_playbooks?: { id: string; name: string } })[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useAutoRemediationExecutions(opportunityId?: string) {
  return useQuery({
    queryKey: ['auto-remediation-executions', opportunityId],
    queryFn: async () => {
      let query = supabase
        .from('auto_remediation_executions')
        .select(`
          *,
          auto_remediation_triggers:trigger_id (name, action_type),
          ai_playbooks:playbook_id (name),
          opportunities:opportunity_id (title)
        `)
        .order('created_at', { ascending: false });

      if (opportunityId) {
        query = query.eq('opportunity_id', opportunityId);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data as (AutoRemediationExecution & { 
        auto_remediation_triggers?: { name: string; action_type: string };
        ai_playbooks?: { name: string };
        opportunities?: { title: string };
      })[];
    },
    staleTime: 1 * 60 * 1000,
  });
}

export function useCreateRemediationTrigger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trigger: Omit<AutoRemediationTrigger, 'id' | 'organization_id' | 'created_at' | 'trigger_count' | 'success_count' | 'last_triggered_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('No organization');

      const { data, error } = await supabase
        .from('auto_remediation_triggers')
        .insert({
          organization_id: profile.organization_id,
          ...trigger
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-remediation-triggers'] });
      toast.success('Trigger de remediação criado');
    },
    onError: () => {
      toast.error('Erro ao criar trigger');
    }
  });
}

export function useUpdateRemediationTrigger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AutoRemediationTrigger> & { id: string }) => {
      const { data, error } = await supabase
        .from('auto_remediation_triggers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-remediation-triggers'] });
      toast.success('Trigger atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar trigger');
    }
  });
}

export function useDeleteRemediationTrigger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('auto_remediation_triggers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-remediation-triggers'] });
      toast.success('Trigger removido');
    },
    onError: () => {
      toast.error('Erro ao remover trigger');
    }
  });
}

export function useRemediationStats() {
  return useQuery({
    queryKey: ['remediation-stats'],
    queryFn: async () => {
      const { data: executions, error } = await supabase
        .from('auto_remediation_executions')
        .select('status, outcome_status, health_score_at_trigger, health_score_after')
        .not('outcome_status', 'is', null);

      if (error) throw error;

      const total = executions.length;
      const improved = executions.filter(e => e.outcome_status === 'improved' || e.outcome_status === 'deal_won').length;
      const worsened = executions.filter(e => e.outcome_status === 'worsened' || e.outcome_status === 'deal_lost').length;
      const unchanged = executions.filter(e => e.outcome_status === 'unchanged').length;

      const avgImprovement = executions
        .filter(e => e.health_score_after !== null && e.health_score_at_trigger !== null)
        .reduce((sum, e) => sum + ((e.health_score_after || 0) - (e.health_score_at_trigger || 0)), 0) / (total || 1);

      return {
        total,
        improved,
        worsened,
        unchanged,
        successRate: total > 0 ? (improved / total) * 100 : 0,
        avgImprovement
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
