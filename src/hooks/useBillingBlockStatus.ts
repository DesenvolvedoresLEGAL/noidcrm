import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BillingBlockStatus {
  isBlocked: boolean;
  isLoading: boolean;
  billingStatus: {
    payment_status: string;
    blocked_at: string | null;
    block_reason: string | null;
    amount_due: number | null;
    billing_day: number | null;
    next_due_date: string | null;
  } | null;
}

export function useBillingBlockStatus(): BillingBlockStatus {
  const { organization, loading: orgLoading } = useCurrentOrganization();

  const { data: billingStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['billing-block-status', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      
      const { data, error } = await supabase
        .from('organization_billing_status')
        .select('payment_status, blocked_at, block_reason, amount_due, billing_day, next_due_date')
        .eq('organization_id', organization.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching billing status:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!organization?.id,
    staleTime: 1000 * 60, // 1 minute
  });

  const isBlocked = billingStatus?.payment_status === 'blocked';

  return {
    isBlocked,
    isLoading: orgLoading || statusLoading,
    billingStatus,
  };
}
