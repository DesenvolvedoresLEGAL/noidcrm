// Sprint Scoring 1.4 — realtime invalidation for the Revenue Hygiene dashboard.
// AUTH.1.3 — gate por sessão para evitar inscrição sem JWT válido.
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useNRHSAnalyticsRealtime(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  const { hasSession, sessionChecked } = useCurrentUser();

  useEffect(() => {
    if (!sessionChecked || !hasSession || !organizationId) return;
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
  }, [organizationId, hasSession, sessionChecked, queryClient]);
}
