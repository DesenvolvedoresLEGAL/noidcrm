import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';

export function useEntitlements() {
  const { organization } = useCurrentOrganization();
  const org = organization as any;
  const planId = org?.current_plan_id || 'freemium';

  const { data: entitlements, isLoading } = useQuery({
    queryKey: ['plan-entitlements', planId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_entitlements')
        .select('*')
        .eq('plan_id', planId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!planId,
  });

  const map = Object.fromEntries(
    (entitlements || []).map(e => [e.key, e.value])
  );

  const asBool = (v?: string) => v === 'true';
  const asNum = (v?: string, defaultValue = 0) => {
    const num = Number(v);
    return isNaN(num) ? defaultValue : num;
  };

  return {
    planId,
    isLoading,
    isTrial: org?.status === 'trial' && !!org?.trial_ends_at,
    trialEndsAt: org?.trial_ends_at,
    isPlanLocked: org?.is_plan_locked || false,
    
    // Checkers
    can: (feature: string) => asBool(map[feature]),
    get: (key: string, fallback?: string | number | boolean) => map[key] ?? fallback,
    limitNum: (key: string, defaultValue = 0) => asNum(map[key], defaultValue),
  };
}
