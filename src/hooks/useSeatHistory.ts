import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';

export interface SeatEvent {
  id: string;
  event_type: string;
  old_seat_count: number;
  new_seat_count: number;
  seats_delta: number;
  old_mrr: number;
  new_mrr: number;
  delta_mrr: number;
  price_per_seat: number;
  created_at: string;
}

// Map database column names to our interface
function mapSeatEvent(event: Record<string, unknown>): SeatEvent {
  const previousSeats = Number(event.previous_seats) || 0;
  const newSeats = Number(event.new_seats) || 0;
  return {
    id: event.id as string,
    event_type: event.event_type as string,
    old_seat_count: previousSeats,
    new_seat_count: newSeats,
    seats_delta: newSeats - previousSeats,
    old_mrr: Number(event.previous_mrr) || 0,
    new_mrr: Number(event.new_mrr) || 0,
    delta_mrr: Number(event.delta_mrr) || 0,
    price_per_seat: Number(event.price_per_seat) || 0,
    created_at: event.created_at as string,
  };
}

export function useSeatHistory(limit = 50) {
  const { organization } = useCurrentUser();

  return useQuery({
    queryKey: ['seat-history', organization?.id, limit],
    queryFn: async (): Promise<SeatEvent[]> => {
      if (!organization?.id) return [];

      const { data, error } = await supabase
        .from('seat_events')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching seat history:', error);
        throw error;
      }

      return (data || []).map(event => mapSeatEvent(event as unknown as Record<string, unknown>));
    },
    enabled: !!organization?.id,
    staleTime: 30 * 1000,
  });
}

export function useBillingProjection() {
  const { organization } = useCurrentUser();

  return useQuery({
    queryKey: ['billing-projection', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;

      // Get current seat count
      const { count: seatCount } = await supabase
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .eq('status', 'active');

      // Get organization pricing - use active_seats and calculated_mrr columns
      const { data: org } = await supabase
        .from('organizations')
        .select('active_seats, calculated_mrr')
        .eq('id', organization.id)
        .single();

      // Default price per seat
      const defaultPricePerSeat = 199.90;
      const currentMrr = Number(org?.calculated_mrr) || (seatCount || 0) * defaultPricePerSeat;
      const seats = seatCount || Number(org?.active_seats) || 0;
      const pricePerSeat = seats > 0 ? currentMrr / seats : defaultPricePerSeat;

      return {
        currentSeats: seats,
        pricePerSeat,
        currentMrr,
        projectedMrrWithOneMore: currentMrr + pricePerSeat,
        projectedMrrWithOneLess: Math.max(0, currentMrr - pricePerSeat),
        arr: currentMrr * 12,
      };
    },
    enabled: !!organization?.id,
    staleTime: 30 * 1000,
  });
}
