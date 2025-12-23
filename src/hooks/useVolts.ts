import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { usePlanType } from '@/hooks/usePlanType';

export interface VoltsBalance {
  id: string;
  organization_id: string;
  included_volts: number;
  used_volts: number;
  extra_volts: number;
  reset_at: string | null;
  period_start: string;
  period_end: string;
}

export interface ConsumeVoltsResult {
  success: boolean;
  error?: string;
  consumed?: number;
  used_total?: number;
  available?: number;
  requested?: number;
}

export function useVolts() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();
  const { consumesVolts, isAutonomous } = usePlanType();
  
  const organizationId = organization?.id;

  // Fetch current balance
  const { data: balance, isLoading, error } = useQuery({
    queryKey: ['volts-balance', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      const { data, error } = await supabase
        .from('org_volts_balance')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) throw error;
      
      // Return default balance if not found
      if (!data) {
        return {
          id: '',
          organization_id: organizationId,
          included_volts: 1000,
          used_volts: 0,
          extra_volts: 0,
          reset_at: null,
          period_start: new Date().toISOString(),
          period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        } as VoltsBalance;
      }

      return data as VoltsBalance;
    },
    enabled: !!organizationId && isAutonomous,
  });

  // Consume volts mutation
  const consumeMutation = useMutation({
    mutationFn: async ({ amount, actionType }: { amount: number; actionType?: string }) => {
      if (!organizationId) throw new Error('No organization');

      const { data, error } = await supabase.rpc('consume_volts', {
        p_org_id: organizationId,
        p_amount: amount,
        p_action_type: actionType || 'ai_action',
      });

      if (error) throw error;
      return data as unknown as ConsumeVoltsResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volts-balance', organizationId] });
    },
  });

  // Calculated values
  const totalVolts = (balance?.included_volts || 0) + (balance?.extra_volts || 0);
  const usedVolts = balance?.used_volts || 0;
  const availableVolts = Math.max(0, totalVolts - usedVolts);
  const usagePercentage = totalVolts > 0 ? Math.min(100, (usedVolts / totalVolts) * 100) : 0;
  
  // Status thresholds
  const isLow = usagePercentage >= 80;
  const isCritical = usagePercentage >= 95;
  const isDepleted = availableVolts <= 0;

  // Check if can execute an action
  const canExecute = (requiredVolts: number = 1) => {
    if (!consumesVolts()) return true; // Neural plans don't consume volts
    return availableVolts >= requiredVolts;
  };

  // Period info
  const periodEnd = balance?.period_end ? new Date(balance.period_end) : null;
  const daysUntilReset = periodEnd 
    ? Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    // Balance data
    balance,
    isLoading,
    error,

    // Calculated values
    totalVolts,
    usedVolts,
    availableVolts,
    usagePercentage,

    // Status flags
    isLow,
    isCritical,
    isDepleted,
    
    // Check functions
    canExecute,
    consumesVolts: consumesVolts(),

    // Period info
    periodEnd,
    daysUntilReset,

    // Actions
    consumeVolts: consumeMutation.mutateAsync,
    isConsuming: consumeMutation.isPending,
  };
}
