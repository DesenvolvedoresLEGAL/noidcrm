import { supabase } from '@/integrations/supabase/client';
import type {
  AllocationItemType,
  AllocationStatus,
} from '@/lib/operations/inventoryPreReservations';

export interface AllocationCandidate {
  candidate_type: AllocationItemType;
  candidate_id: string;
  candidate_name: string;
  candidate_code: string;
  category_id: string | null;
  category_name: string | null;
  family_id: string | null;
  family_name: string | null;
  available_quantity: number;
  already_pre_reserved_quantity: number;
  status: 'available' | 'partial' | 'unavailable' | 'no_stock_control' | 'pending';
  message: string | null;
}

export interface AllocationRow {
  id: string;
  allocation_item_type: AllocationItemType;
  serialized_item_id: string | null;
  quantity_item_id: string | null;
  inventory_item_name: string | null;
  inventory_item_code: string | null;
  allocated_quantity: number;
  allocation_status: AllocationStatus;
  notes: string | null;
  created_at: string;
}

const ALLOC_TABLE = 'inventory_pre_reservation_allocations';

export async function findAllocationCandidates(
  preReservationItemId: string,
): Promise<AllocationCandidate[]> {
  const { data, error } = await supabase.rpc(
    'find_inventory_allocation_candidates' as never,
    { p_pre_reservation_item_id: preReservationItemId } as never,
  );
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    available_quantity: Number(r.available_quantity ?? 0),
    already_pre_reserved_quantity: Number(r.already_pre_reserved_quantity ?? 0),
  }));
}

export async function listAllocations(preReservationItemId: string): Promise<AllocationRow[]> {
  const { data, error } = await supabase.rpc(
    'list_pre_reservation_item_allocations' as never,
    { p_pre_reservation_item_id: preReservationItemId } as never,
  );
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    allocated_quantity: Number(r.allocated_quantity ?? 0),
  }));
}

export interface CreateAllocationPayload {
  organization_id: string;
  pre_reservation_id: string;
  pre_reservation_item_id: string;
  allocation_item_type: AllocationItemType;
  serialized_item_id?: string | null;
  quantity_item_id?: string | null;
  allocated_quantity: number;
  notes?: string | null;
  user_id?: string | null;
}

export async function createAllocation(payload: CreateAllocationPayload) {
  const { user_id, ...rest } = payload;
  const { data, error } = await supabase
    .from(ALLOC_TABLE as never)
    .insert({
      ...rest,
      serialized_item_id: rest.serialized_item_id ?? null,
      quantity_item_id: rest.quantity_item_id ?? null,
      created_by: user_id ?? null,
      updated_by: user_id ?? null,
    } as never)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function cancelAllocation(allocationId: string, userId?: string | null) {
  const { error } = await supabase
    .from(ALLOC_TABLE as never)
    .update({ allocation_status: 'cancelled', updated_by: userId ?? null } as never)
    .eq('id', allocationId);
  if (error) throw error;
}

export async function recalculatePreReservationItemAllocation(itemId: string) {
  const { data, error } = await supabase.rpc(
    'recalculate_pre_reservation_item_allocation' as never,
    { p_pre_reservation_item_id: itemId } as never,
  );
  if (error) throw error;
  return data;
}
