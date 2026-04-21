import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PushQueueErrorPattern {
  error: string;
  count: number;
}

export interface PushQueueHealthMetrics {
  snapshot_at: string;
  pending_count: number;
  processing_count: number;
  sent_count: number;
  failed_count: number;
  exhausted_count: number;
  retrying_count: number;
  recent_failed_count: number;
  recent_errors: PushQueueErrorPattern[];
}

export function usePushQueueHealth(organizationId?: string | null, lookbackHours = 24) {
  return useQuery({
    queryKey: ['push-queue-health', organizationId, lookbackHours],
    enabled: !!organizationId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_push_delivery_jobs_health', {
        p_organization_id: organizationId!,
        p_lookback_hours: lookbackHours,
      });
      if (error) throw error;

      const row = (data?.[0] ?? null) as any;
      if (!row) return null;

      return {
        ...row,
        recent_errors: Array.isArray(row.recent_errors) ? row.recent_errors : [],
      } as PushQueueHealthMetrics;
    },
  });
}
