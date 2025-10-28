import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useCurrentOrganization';
import { useEntitlements } from './useEntitlements';

export function useUsage(metric: string) {
  const { organization } = useCurrentOrganization();
  const { limitNum } = useEntitlements();
  
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM

  const { data: usage, isLoading } = useQuery({
    queryKey: ['usage', organization?.id, metric, period],
    queryFn: async () => {
      if (!organization?.id) return null;
      
      const { data, error } = await supabase
        .from('usage_counters')
        .select('value')
        .eq('organization_id', organization.id)
        .eq('metric', metric)
        .eq('period', period)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data?.value || 0;
    },
    enabled: !!organization?.id,
  });

  const limit = limitNum(`${metric}_limit`);
  const current = usage || 0;
  const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return {
    current,
    limit,
    percentage,
    isNearLimit,
    isAtLimit,
    isLoading,
  };
}
