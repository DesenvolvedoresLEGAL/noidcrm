import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDynamicDashboardGuard } from './useDynamicDashboardGuard';
import { supabase } from '@/integrations/supabase/client';

/**
 * Determines if the legacy dashboard should display the opt-in button
 * pointing to /app/dynamic-dashboard. Conservative: requires ALL conditions.
 */
export function useCloserPilotEntrypoint() {
  const { user, organization } = useCurrentUser();
  const tenantId = organization?.id ?? null;
  const userId = user?.id ?? null;

  const guard = useDynamicDashboardGuard(tenantId, userId);

  // Validate requires_review independently
  const reviewQ = useQuery({
    queryKey: ['closer-pilot-entrypoint', 'review', tenantId, userId],
    enabled: !!tenantId && !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_user_contexts' as any)
        .select('metadata')
        .eq('tenant_id', tenantId as string)
        .eq('user_id', userId as string)
        .maybeSingle();
      const requiresReview = !!(data as any)?.metadata?.requires_review;
      return { requiresReview };
    },
  });

  const visible =
    !!guard.data?.allowed &&
    guard.data?.context.businessFunctionKey === 'closer' &&
    !reviewQ.data?.requiresReview;

  return {
    visible,
    isLoading: guard.isLoading || reviewQ.isLoading,
    context: guard.data?.context,
  };
}
