import { useQuery } from '@tanstack/react-query';
import {
  getAvailabilitySnapshot,
  getCapacityByPeriod,
  getOccupancyCalendar,
} from '@/services/operations/inventoryOccupancy';
import type {
  InventoryAvailabilitySnapshotPayload,
  InventoryOccupancyFilters,
} from '@/lib/operations/inventoryOccupancy';

export function useInventoryOccupancyCalendar(
  filters: InventoryOccupancyFilters,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['inventory', 'occupancy', 'calendar', filters],
    queryFn: () => getOccupancyCalendar(filters),
    enabled: options?.enabled ?? Boolean(filters.start_date && filters.end_date),
    staleTime: 60_000,
  });
}

export function useInventoryCapacityByPeriod(
  filters: Pick<
    InventoryOccupancyFilters,
    'start_date' | 'end_date' | 'category_id' | 'family_id'
  >,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['inventory', 'occupancy', 'capacity', filters],
    queryFn: () => getCapacityByPeriod(filters),
    enabled: options?.enabled ?? Boolean(filters.start_date && filters.end_date),
    staleTime: 60_000,
  });
}

export function useInventoryAvailabilitySnapshot(
  payload: InventoryAvailabilitySnapshotPayload | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['inventory', 'occupancy', 'snapshot', payload],
    queryFn: () => getAvailabilitySnapshot(payload as InventoryAvailabilitySnapshotPayload),
    enabled:
      (options?.enabled ?? true) &&
      Boolean(payload?.start_date && payload?.end_date && (payload?.requested_quantity ?? 0) > 0),
    staleTime: 30_000,
  });
}
