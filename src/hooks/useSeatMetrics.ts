import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';

export interface SeatMetrics {
  plan_id: string | null;
  price_per_seat: number;
  active_seats: number;
  max_users: number | null;
  mrr: number;
  arr: number;
  expansion_mrr_this_month: number;
  contraction_mrr_this_month: number;
  net_mrr_change_this_month: number;
  seats_usage_percent: number | null;
}

export interface GlobalSeatMetrics {
  total_mrr: number;
  total_arr: number;
  total_seats: number;
  paying_orgs: number;
  avg_seats_per_org: number;
  revenue_per_seat: number;
  expansion_mrr: number;
  contraction_mrr: number;
  net_mrr_change: number;
  nrr_percent: number;
}

export function useSeatMetrics() {
  const { organization } = useCurrentUser();

  return useQuery({
    queryKey: ['seat-metrics', organization?.id],
    queryFn: async (): Promise<SeatMetrics | null> => {
      if (!organization?.id) return null;

      const { data, error } = await supabase.rpc('get_org_seat_metrics', {
        org_id: organization.id
      });

      if (error) {
        console.error('Error fetching seat metrics:', error);
        throw error;
      }

      return data as unknown as SeatMetrics;
    },
    enabled: !!organization?.id,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useGlobalSeatMetrics() {
  return useQuery({
    queryKey: ['global-seat-metrics'],
    queryFn: async (): Promise<GlobalSeatMetrics | null> => {
      const { data, error } = await supabase.rpc('get_global_seat_metrics');

      if (error) {
        console.error('Error fetching global seat metrics:', error);
        throw error;
      }

      return data as unknown as GlobalSeatMetrics;
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useSeatEvents(organizationId?: string, limit = 20) {
  return useQuery({
    queryKey: ['seat-events', organizationId, limit],
    queryFn: async () => {
      let query = supabase
        .from('seat_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching seat events:', error);
        throw error;
      }

      return data;
    },
    enabled: true,
    staleTime: 30 * 1000,
  });
}
