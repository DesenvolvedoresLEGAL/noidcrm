import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { toast } from 'sonner';

export interface SalesConfig {
  id: string;
  organization_id: string;
  monthly_revenue_target: number;
  quarterly_goal: number;
  semester_goal: number;
  yearly_goal: number;
  average_ticket: number;
  working_days_per_month: number;
  // Outbound rates
  outbound_call_to_lead: number;
  outbound_lead_to_mql: number;
  outbound_mql_to_proposal: number;
  outbound_proposal_to_sale: number;
  // Inbound rates
  inbound_lead_to_mql: number;
  inbound_mql_to_proposal: number;
  inbound_proposal_to_sale: number;
  // Referral rates
  referral_request_to_lead: number;
  referral_lead_to_proposal: number;
  referral_proposal_to_sale: number;
  // Revenue share
  revenue_share_outbound: number;
  revenue_share_inbound: number;
  revenue_share_referral: number;
  updated_at: string;
}

export interface SellerTarget {
  id: string;
  organization_id: string;
  user_id: string;
  period_month: string;
  monthly_revenue_target: number;
  revenue_share: number;
  daily_calls_target: number;
  daily_leads_target: number;
  daily_proposals_target: number;
  daily_sales_target: number;
  daily_revenue_target: number;
}

export interface Holiday {
  id: string;
  organization_id: string;
  holiday_date: string;
  name: string;
  is_national: boolean;
}

export function useSalesConfig() {
  const { organization } = useCurrentUser();
  const queryClient = useQueryClient();

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['sales-config', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      
      const { data, error } = await supabase
        .from('sales_config')
        .select('*')
        .eq('organization_id', organization.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as SalesConfig | null;
    },
    enabled: !!organization?.id,
  });

  const { mutateAsync: upsertConfig } = useMutation({
    mutationFn: async (updates: Partial<SalesConfig>) => {
      if (!organization?.id) throw new Error('No organization');
      
      const { data, error } = await supabase
        .from('sales_config')
        .upsert({
          organization_id: organization.id,
          ...updates,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-config'] });
      toast.success('Configurações salvas');
    },
    onError: (error) => {
      toast.error('Erro ao salvar configurações');
      console.error(error);
    },
  });

  return {
    config,
    configLoading,
    upsertConfig,
  };
}

export function useSellerTargets(periodMonth?: string) {
  const { organization } = useCurrentUser();
  const queryClient = useQueryClient();

  const { data: targets, isLoading } = useQuery({
    queryKey: ['seller-targets', organization?.id, periodMonth],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      let query = supabase
        .from('seller_targets')
        .select('*')
        .eq('organization_id', organization.id);
      
      if (periodMonth) {
        query = query.eq('period_month', periodMonth);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as SellerTarget[];
    },
    enabled: !!organization?.id,
  });

  const { mutateAsync: upsertTarget } = useMutation({
    mutationFn: async (target: Partial<SellerTarget> & { user_id: string; period_month: string }) => {
      if (!organization?.id) throw new Error('No organization');
      
      const { data, error } = await supabase
        .from('seller_targets')
        .upsert({
          organization_id: organization.id,
          ...target,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-targets'] });
      toast.success('Meta salva');
    },
  });

  const { mutateAsync: deleteTarget } = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('seller_targets')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-targets'] });
    },
  });

  return {
    targets,
    isLoading,
    upsertTarget,
    deleteTarget,
  };
}

export function useHolidays(year?: number) {
  const { organization } = useCurrentUser();
  const queryClient = useQueryClient();
  const currentYear = year || new Date().getFullYear();

  const { data: holidays, isLoading } = useQuery({
    queryKey: ['holidays', organization?.id, currentYear],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const startDate = `${currentYear}-01-01`;
      const endDate = `${currentYear}-12-31`;
      
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .eq('organization_id', organization.id)
        .gte('holiday_date', startDate)
        .lte('holiday_date', endDate)
        .order('holiday_date');
      
      if (error) throw error;
      return data as Holiday[];
    },
    enabled: !!organization?.id,
  });

  const { mutateAsync: addHoliday } = useMutation({
    mutationFn: async (holiday: { holiday_date: string; name: string; is_national?: boolean }) => {
      if (!organization?.id) throw new Error('No organization');
      
      const { data, error } = await supabase
        .from('holidays')
        .insert({
          organization_id: organization.id,
          ...holiday,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast.success('Feriado adicionado');
    },
  });

  const { mutateAsync: deleteHoliday } = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('holidays')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
    },
  });

  return {
    holidays,
    isLoading,
    addHoliday,
    deleteHoliday,
  };
}
