import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useCurrentOrganization';
import { toast } from 'sonner';
import { oteKeys } from '@/lib/query-keys';

export interface OTELevel {
  id: string;
  organization_id: string;
  level_name: string;
  level_code: string;
  base_salary: number;
  variable_target: number;
  monthly_goal: number;
  goal_type: 'revenue' | 'leads';
  description?: string;
  order_index: number;
  is_active: boolean;
  is_team_target?: boolean;
}

export interface OTEMultiplier {
  id: string;
  organization_id: string;
  min_percentage: number;
  max_percentage: number;
  multiplier: number;
  description?: string;
  order_index: number;
}

export interface OTESellerConfig {
  id: string;
  organization_id: string;
  user_id: string;
  ote_level_id?: string;
  custom_goal_override?: number;
  custom_variable_override?: number;
  effective_date: string;
  end_date?: string;
  notes?: string;
  // Campos de atividades diárias
  daily_calls_target?: number;
  daily_leads_target?: number;
  daily_proposals_target?: number;
  daily_sales_target?: number;
  daily_revenue_target?: number;
  revenue_share?: number;
  ote_level?: OTELevel;
  profile?: {
    full_name: string;
    avatar_url?: string;
  };
}

export interface OTEMonthlyResult {
  id: string;
  organization_id: string;
  user_id: string;
  period_month: string;
  ote_level_id?: string;
  level_name_snapshot?: string;
  total_sales: number;
  goal_amount: number;
  achievement_percentage: number;
  ote_multiplier: number;
  base_variable: number;
  flag_color?: 'blue' | 'yellow' | 'red';
  flag_reason?: string;
  roleplay_score?: number;
  roleplay_accelerator: number;
  crm_completion_score?: number;
  crm_accelerator: number;
  fitscore_avg?: number;
  fitscore_accelerator: number;
  training_score?: number;
  training_accelerator: number;
  total_accelerator_percentage: number;
  total_decelerator_percentage: number;
  final_adjustment_percentage: number;
  final_variable_amount: number;
  calculated_at: string;
  calculated_by?: string;
  approved_at?: string;
  approved_by?: string;
  status: 'pending' | 'approved' | 'paid' | 'disputed';
  notes?: string;
  is_team_target?: boolean;
  team_member_count?: number;
  goal_type?: 'revenue' | 'leads';
  profile?: {
    full_name: string;
    avatar_url?: string;
  };
  ote_level?: OTELevel;
}

export interface OTESalesRecord {
  id: string;
  organization_id: string;
  ote_result_id: string;
  opportunity_id?: string;
  proposal_id?: string;
  proposal_number?: string;
  client_name: string;
  sale_value: number;
  sale_date: string;
  payment_status: 'pending' | 'paid' | 'partial' | 'cancelled';
  payment_date?: string;
  observations?: string;
}

export interface OTERule {
  id: string;
  organization_id: string;
  rule_type: 'flag' | 'accelerator' | 'decelerator';
  rule_name: string;
  condition_field: string;
  condition_operator: string;
  condition_value?: number;
  condition_value_max?: number;
  effect_type?: 'percentage' | 'fixed' | 'flag_color';
  effect_value?: number;
  effect_flag_color?: string;
  priority: number;
  is_active: boolean;
  description?: string;
}

// Hook para níveis OTE
export function useOTELevels() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: oteKeys.levels(organization?.id),
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('ote_levels')
        .select('*')
        .eq('organization_id', organization.id)
        .order('order_index');
      if (error) throw error;
      return data as OTELevel[];
    },
    enabled: !!organization?.id,
  });

  const createLevel = useMutation({
    mutationFn: async (level: Omit<OTELevel, 'id' | 'organization_id'>) => {
      const { data, error } = await supabase
        .from('ote_levels')
        .insert([{ ...level, organization_id: organization?.id! }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oteKeys.levelsAll() });
      toast.success('Nível OTE criado');
    },
    onError: () => toast.error('Erro ao criar nível'),
  });

  const updateLevel = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OTELevel> & { id: string }) => {
      const { data, error } = await supabase
        .from('ote_levels')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oteKeys.levelsAll() });
      toast.success('Nível OTE atualizado');
    },
    onError: () => toast.error('Erro ao atualizar nível'),
  });

  const deleteLevel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ote_levels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oteKeys.levelsAll() });
      toast.success('Nível OTE removido');
    },
    onError: () => toast.error('Erro ao remover nível'),
  });

  return { ...query, createLevel, updateLevel, deleteLevel };
}

// Hook para multiplicadores OTE
export function useOTEMultipliers() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: oteKeys.multipliers(organization?.id),
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('ote_multipliers')
        .select('*')
        .eq('organization_id', organization.id)
        .order('min_percentage');
      if (error) throw error;
      return data as OTEMultiplier[];
    },
    enabled: !!organization?.id,
  });

  const createMultiplier = useMutation({
    mutationFn: async (multiplier: Omit<OTEMultiplier, 'id' | 'organization_id'>) => {
      const { data, error } = await supabase
        .from('ote_multipliers')
        .insert([{ ...multiplier, organization_id: organization?.id! }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oteKeys.multipliersAll() });
      toast.success('Multiplicador criado');
    },
    onError: () => toast.error('Erro ao criar multiplicador'),
  });

  const updateMultiplier = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OTEMultiplier> & { id: string }) => {
      const { data, error } = await supabase
        .from('ote_multipliers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oteKeys.multipliersAll() });
      toast.success('Multiplicador atualizado');
    },
    onError: () => toast.error('Erro ao atualizar multiplicador'),
  });

  const deleteMultiplier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ote_multipliers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oteKeys.multipliersAll() });
      toast.success('Multiplicador removido');
    },
    onError: () => toast.error('Erro ao remover multiplicador'),
  });

  return { ...query, createMultiplier, updateMultiplier, deleteMultiplier };
}

// Hook para configuração de vendedores
export function useOTESellerConfigs() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: oteKeys.sellerConfigs(organization?.id),
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('ote_seller_config')
        .select(`
          *,
          ote_level:ote_levels(*)
        `)
        .eq('organization_id', organization.id)
        .is('end_date', null);
      if (error) throw error;
      return data as OTESellerConfig[];
    },
    enabled: !!organization?.id,
  });

  const upsertConfig = useMutation({
    mutationFn: async (config: Partial<OTESellerConfig>) => {
      // First, close any existing config
      if (config.user_id) {
        await supabase
          .from('ote_seller_config')
          .update({ end_date: new Date().toISOString().split('T')[0] })
          .eq('user_id', config.user_id)
          .eq('organization_id', organization?.id)
          .is('end_date', null);
      }

      const insertData = {
        user_id: config.user_id!,
        ote_level_id: config.ote_level_id,
        custom_goal_override: config.custom_goal_override,
        custom_variable_override: config.custom_variable_override,
        effective_date: config.effective_date,
        end_date: config.end_date,
        notes: config.notes,
        daily_calls_target: config.daily_calls_target,
        daily_leads_target: config.daily_leads_target,
        daily_proposals_target: config.daily_proposals_target,
        daily_sales_target: config.daily_sales_target,
        daily_revenue_target: config.daily_revenue_target,
        revenue_share: config.revenue_share,
        organization_id: organization?.id!,
      };
      const { data, error } = await supabase
        .from('ote_seller_config')
        .insert([insertData])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oteKeys.sellerConfigsAll() });
      toast.success('Configuração do vendedor salva');
    },
    onError: () => toast.error('Erro ao salvar configuração'),
  });

  const deleteConfig = useMutation({
    mutationFn: async (configId: string) => {
      const { error } = await supabase
        .from('ote_seller_config')
        .update({ end_date: new Date().toISOString().split('T')[0] })
        .eq('id', configId)
        .eq('organization_id', organization?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oteKeys.sellerConfigsAll() });
      toast.success('Vendedor removido da configuração OTE');
    },
    onError: () => toast.error('Erro ao remover vendedor'),
  });

  return { ...query, upsertConfig, deleteConfig };
}

// Hook para resultados mensais
export function useOTEMonthlyResults(periodMonth?: string) {
  const { organization } = useCurrentOrganization();

  return useQuery({
    queryKey: oteKeys.monthlyResults(organization?.id, periodMonth),
    queryFn: async () => {
      if (!organization?.id) return [];
      let query = supabase
        .from('ote_monthly_results')
        .select(`
          *,
          ote_level:ote_levels(*)
        `)
        .eq('organization_id', organization.id)
        .order('period_month', { ascending: false });

      if (periodMonth) {
        query = query.eq('period_month', periodMonth);
      }

      const { data: results, error } = await query;
      if (error) throw error;

      // Fetch profiles for user names. Não remover usuários sem profile: resultados
      // históricos de usuários excluídos/inativos precisam permanecer visíveis.
      const userIds = results?.map(r => r.user_id) || [];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        return results
          .map(r => ({
            ...r,
            profile: profileMap.get(r.user_id) || undefined,
          })) as OTEMonthlyResult[];
      }

      return results as OTEMonthlyResult[];
    },
    enabled: !!organization?.id,
  });
}

// Hook para regras OTE
export function useOTERules() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: oteKeys.rules(organization?.id),
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('ote_rules')
        .select('*')
        .eq('organization_id', organization.id)
        .order('priority');
      if (error) throw error;
      return data as OTERule[];
    },
    enabled: !!organization?.id,
  });

  const createRule = useMutation({
    mutationFn: async (rule: Omit<OTERule, 'id' | 'organization_id'>) => {
      const { data, error } = await supabase
        .from('ote_rules')
        .insert([{ ...rule, organization_id: organization?.id! }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oteKeys.rulesAll() });
      toast.success('Regra criada');
    },
    onError: () => toast.error('Erro ao criar regra'),
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OTERule> & { id: string }) => {
      const { data, error } = await supabase
        .from('ote_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oteKeys.rulesAll() });
      toast.success('Regra atualizada');
    },
    onError: () => toast.error('Erro ao atualizar regra'),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ote_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oteKeys.rulesAll() });
      toast.success('Regra removida');
    },
    onError: () => toast.error('Erro ao remover regra'),
  });

  return { ...query, createRule, updateRule, deleteRule };
}

// Hook para calcular OTE
export function useCalculateOTE() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { periodMonth: string; userId?: string }) => {
      const { data, error } = await supabase.functions.invoke('calculate-ote', {
        body: params,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oteKeys.monthlyResultsAll() });
      toast.success('Cálculo OTE concluído');
    },
    onError: (error) => {
      console.error('OTE calculation error:', error);
      toast.error('Erro ao calcular OTE');
    },
  });
}

// Hook para aprovar resultado OTE
export function useApproveOTEResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (resultId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('ote_monthly_results')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        })
        .eq('id', resultId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: oteKeys.monthlyResultsAll() });
      toast.success('Resultado aprovado');
    },
    onError: () => toast.error('Erro ao aprovar resultado'),
  });
}
