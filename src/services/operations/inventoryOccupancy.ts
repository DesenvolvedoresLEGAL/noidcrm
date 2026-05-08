import { supabase } from '@/integrations/supabase/client';
import type {
  AvailabilitySnapshot,
  CapacityRow,
  InventoryAvailabilitySnapshotPayload,
  InventoryOccupancyFilters,
  OccupancyRow,
} from '@/lib/operations/inventoryOccupancy';

export async function getOccupancyCalendar(
  filters: InventoryOccupancyFilters,
): Promise<OccupancyRow[]> {
  const { data, error } = await supabase.rpc('get_inventory_occupancy_calendar', {
    p_start_date: filters.start_date,
    p_end_date: filters.end_date,
    p_category_id: filters.category_id ?? null,
    p_family_id: filters.family_id ?? null,
    p_status: filters.status ?? null,
    p_view_mode: filters.view_mode ?? 'item',
  } as never);
  if (error) throw error;
  return (data ?? []) as unknown as OccupancyRow[];
}

export async function getCapacityByPeriod(
  filters: Pick<InventoryOccupancyFilters, 'start_date' | 'end_date' | 'category_id' | 'family_id'>,
): Promise<CapacityRow[]> {
  const { data, error } = await supabase.rpc('get_inventory_capacity_by_period', {
    p_start_date: filters.start_date,
    p_end_date: filters.end_date,
    p_category_id: filters.category_id ?? null,
    p_family_id: filters.family_id ?? null,
  } as never);
  if (error) throw error;
  return (data ?? []) as unknown as CapacityRow[];
}

export async function getAvailabilitySnapshot(
  payload: InventoryAvailabilitySnapshotPayload,
): Promise<AvailabilitySnapshot | null> {
  const { data, error } = await supabase.rpc('get_inventory_availability_snapshot', {
    p_start_date: payload.start_date,
    p_end_date: payload.end_date,
    p_category_id: payload.category_id ?? null,
    p_family_id: payload.family_id ?? null,
    p_requested_quantity: payload.requested_quantity,
  } as never);
  if (error) throw error;
  const rows = (data ?? []) as unknown as AvailabilitySnapshot[];
  return rows[0] ?? null;
}
