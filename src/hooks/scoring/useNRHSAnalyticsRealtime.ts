// Sprint Scoring 1.4 — realtime invalidation for the Revenue Hygiene dashboard.
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useNRHSAnalyticsRealtime(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel(`nrhs-analytics-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'opportunities',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload: any) => {
          const oldRow = payload?.old || {};
          const newRow = payload?.new || {};
          if (oldRow.nrhs_score !== newRow.nrhs_score
            || oldRow.nrhs_status !== newRow.nrhs_status
            || oldRow.nrhs_updated_at !== newRow.nrhs_updated_at) {
            queryClient.invalidateQueries({ queryKey: ['nrhs-analytics'] });
            queryClient.invalidateQueries({ queryKey: ['nrhs-kpis'] });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [organizationId, queryClient]);
}
