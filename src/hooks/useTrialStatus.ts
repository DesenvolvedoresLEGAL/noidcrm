import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type TrialStatusType = 'active' | 'warning' | 'critical' | 'expired' | 'blocked' | 'paid';

export interface TrialStatus {
  trialEndsAt: string | null;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  isExpired: boolean;
  isBlocked: boolean;
  isTrial: boolean;
  isPaid: boolean;
  showWarning: boolean;
  showCriticalWarning: boolean;
  status: TrialStatusType;
  gracePeriodEndsAt: string | null;
  dataDeletionAt: string | null;
}

export function useTrialStatus(): TrialStatus & { isLoading: boolean } {
  const { organization, loading: orgLoading } = useCurrentOrganization();

  // Check if organization is blocked
  const { data: blockData, isLoading: blockLoading } = useQuery({
    queryKey: ['trial-block', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      
      const { data, error } = await supabase
        .from('trial_blocks')
        .select('*')
        .eq('organization_id', organization.id)
        .is('unblocked_at', null)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching trial block:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!organization?.id,
    staleTime: 1000 * 60, // 1 minute
  });

  const now = new Date();
  const trialEndsAt = organization?.trial_ends_at || null;
  const orgStatus = organization?.status;

  // Calculate days remaining
  let daysRemaining: number | null = null;
  let hoursRemaining: number | null = null;
  
  if (trialEndsAt) {
    const endDate = new Date(trialEndsAt);
    const diffMs = endDate.getTime() - now.getTime();
    daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    hoursRemaining = Math.ceil(diffMs / (1000 * 60 * 60));
  }

  const isTrial = orgStatus === 'trial';
  const isPaid = orgStatus === 'active';
  const isExpired = isTrial && daysRemaining !== null && daysRemaining <= 0;
  const isBlocked = !!blockData || orgStatus === 'suspended';
  const showCriticalWarning = isTrial && daysRemaining !== null && daysRemaining <= 3 && daysRemaining > 0;
  const showWarning = isTrial && daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 3;

  // Determine status
  let status: TrialStatusType = 'active';
  if (isPaid) {
    status = 'paid';
  } else if (isBlocked) {
    status = 'blocked';
  } else if (isExpired) {
    status = 'expired';
  } else if (showCriticalWarning) {
    status = 'critical';
  } else if (showWarning) {
    status = 'warning';
  }

  return {
    trialEndsAt,
    daysRemaining,
    hoursRemaining,
    isExpired,
    isBlocked,
    isTrial,
    isPaid,
    showWarning,
    showCriticalWarning,
    status,
    gracePeriodEndsAt: blockData?.grace_period_ends_at || null,
    dataDeletionAt: blockData?.data_deletion_scheduled_at || null,
    isLoading: orgLoading || blockLoading,
  };
}
