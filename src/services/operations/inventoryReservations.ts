import { supabase } from '@/integrations/supabase/client';
import type {
  ReservationStatus,
  ReservationRiskLevel,
  ReservationSource,
  ReservationConfirmationTrigger,
  ReservationItemType,
  ReservationItemStatus,
} from '@/lib/operations/inventoryReservations';
import { canTransitionReservation } from '@/lib/operations/inventoryReservations';

export interface ReservationRow {
  id: string;
  organization_id: string;
  pre_reservation_id: string | null;
  proposal_id: string | null;
  opportunity_id: string | null;
  account_id: string | null;
  contact_id: string | null;
  reservation_code: string;
  title: string;
  source: ReservationSource;
  operational_start_date: string;
  operational_end_date: string;
  event_start_date: string | null;
  event_end_date: string | null;
  status: ReservationStatus;
  risk_level: ReservationRiskLevel;
  confirmation_trigger: ReservationConfirmationTrigger;
  confirmed_at: string | null;
  confirmed_by: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReservationItemRow {
  id: string;
  organization_id: string;
  reservation_id: string;
  source_pre_reservation_item_id: string | null;
  inventory_item_type: ReservationItemType;
  serialized_item_id: string | null;
  quantity_item_id: string | null;
  category_id: string | null;
  family_id: string | null;
  requested_quantity: number;
  reserved_quantity: number;
  demand_label: string | null;
  demand_source: string;
  reservation_status: ReservationItemStatus;
  conflict_reason: string | null;
  notes: string | null;
}

export interface ReservationAllocationRow {
  id: string;
  reservation_id: string;
  reservation_item_id: string;
  allocation_item_type: 'serialized' | 'quantity';
  serialized_item_id: string | null;
  quantity_item_id: string | null;
  allocated_quantity: number;
  allocation_status: 'active' | 'cancelled' | 'replaced';
  notes: string | null;
}

export interface ReservationWithItems extends ReservationRow {
  items: (ReservationItemRow & {
    serialized_item?: { id: string; name: string; asset_code: string | null } | null;
    quantity_item?: { id: string; name: string; unit_of_measure: string | null } | null;
    category?: { id: string; name: string } | null;
    family?: { id: string; name: string } | null;
  })[];
  allocations: (ReservationAllocationRow & {
    serialized_item?: { id: string; name: string; asset_code: string | null } | null;
    quantity_item?: { id: string; name: string; unit_of_measure: string | null } | null;
  })[];
}

export interface ReservationFilters {
  status?: ReservationStatus | 'all';
  risk?: ReservationRiskLevel | 'all';
  source?: ReservationSource | 'all';
  search?: string;
  startDate?: string;
  endDate?: string;
}

const TABLE = 'inventory_reservations';
const ITEMS_TABLE = 'inventory_reservation_items';
const ALLOC_TABLE = 'inventory_reservation_allocations';

export async function listReservations(
  organizationId: string,
  filters: ReservationFilters = {},
): Promise<(ReservationRow & { items_count: number })[]> {
  let q = supabase
    .from(TABLE as never)
    .select('*, items:inventory_reservation_items(id)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
  if (filters.risk && filters.risk !== 'all') q = q.eq('risk_level', filters.risk);
  if (filters.source && filters.source !== 'all') q = q.eq('source', filters.source);
  if (filters.startDate) q = q.gte('operational_end_date', filters.startDate);
  if (filters.endDate) q = q.lte('operational_start_date', filters.endDate);
  if (filters.search) {
    q = q.or(`title.ilike.%${filters.search}%,reservation_code.ilike.%${filters.search}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    items_count: r.items?.length ?? 0,
  }));
}

export async function getReservation(id: string): Promise<ReservationWithItems> {
  const { data, error } = await supabase
    .from(TABLE as never)
    .select(
      `*,
       items:inventory_reservation_items(
         *,
         serialized_item:inventory_items!inventory_reservation_items_serialized_item_id_fkey(id,name,asset_code),
         quantity_item:inventory_items!inventory_reservation_items_quantity_item_id_fkey(id,name,unit_of_measure),
         category:inventory_categories(id,name),
         family:inventory_families(id,name)
       ),
       allocations:inventory_reservation_allocations(
         *,
         serialized_item:inventory_items!inventory_reservation_allocations_serialized_item_id_fkey(id,name,asset_code),
         quantity_item:inventory_items!inventory_reservation_allocations_quantity_item_id_fkey(id,name,unit_of_measure)
       )`,
    )
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as ReservationWithItems;
}

export async function listReservationsByProposal(
  organizationId: string,
  proposalId: string,
): Promise<ReservationWithItems[]> {
  const { data, error } = await supabase
    .from(TABLE as never)
    .select('*, items:inventory_reservation_items(*), allocations:inventory_reservation_allocations(*)')
    .eq('organization_id', organizationId)
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ReservationWithItems[];
}

export async function convertPreReservationToReservation(input: {
  pre_reservation_id: string;
  confirmation_trigger?: ReservationConfirmationTrigger;
}): Promise<{
  success: boolean;
  reservation_id?: string;
  reason?: string;
  message?: string;
  conflicts?: any[];
}> {
  const { data, error } = await supabase.rpc(
    'convert_pre_reservation_to_reservation' as never,
    {
      p_pre_reservation_id: input.pre_reservation_id,
      p_confirmation_trigger: input.confirmation_trigger ?? 'manual',
    } as never,
  );
  if (error) throw error;
  return (data as any) ?? { success: false };
}

export async function updateReservationStatus(
  id: string,
  nextStatus: ReservationStatus,
  current?: ReservationStatus,
  userId?: string | null,
): Promise<void> {
  if (current && nextStatus !== 'cancelled' && !canTransitionReservation(current, nextStatus)) {
    throw new Error(`Transição inválida: ${current} → ${nextStatus}`);
  }
  const { error } = await supabase
    .from(TABLE as never)
    .update({ status: nextStatus, updated_by: userId ?? null } as never)
    .eq('id', id);
  if (error) throw error;
}

export async function cancelReservation(id: string, userId?: string | null) {
  const { data: current, error: fetchErr } = await supabase
    .from(TABLE as never)
    .select('status')
    .eq('id', id)
    .single();
  if (fetchErr) throw fetchErr;
  const status = (current as any)?.status as ReservationStatus | undefined;
  if (status && !['confirmed', 'in_preparation'].includes(status)) {
    throw new Error(
      'Apenas reservas em status Confirmada ou Em preparação podem ser canceladas.',
    );
  }
  const { error } = await supabase
    .from(TABLE as never)
    .update({ status: 'cancelled', updated_by: userId ?? null } as never)
    .eq('id', id);
  if (error) throw error;
}

export async function checkReservationConflict(input: {
  organization_id: string;
  allocation_item_type: 'serialized' | 'quantity';
  serialized_item_id?: string | null;
  quantity_item_id?: string | null;
  requested_quantity: number;
  start_date: string;
  end_date: string;
  ignore_reservation_id?: string | null;
}) {
  const { data, error } = await supabase.rpc(
    'check_inventory_reservation_conflict' as never,
    {
      p_organization_id: input.organization_id,
      p_allocation_item_type: input.allocation_item_type,
      p_serialized_item_id: input.serialized_item_id ?? null,
      p_quantity_item_id: input.quantity_item_id ?? null,
      p_requested_quantity: input.requested_quantity,
      p_start_date: input.start_date,
      p_end_date: input.end_date,
      p_ignore_reservation_id: input.ignore_reservation_id ?? null,
    } as never,
  );
  if (error) throw error;
  return (data as any)?.[0] ?? null;
}

export interface ReservationsOverview {
  active_reservations: number;
  reserved_items: number;
  reservations_in_preparation: number;
  reservations_dispatched: number;
  reservations_in_operation: number;
  next_operational_start: string | null;
}

export async function getReservationsOverview(): Promise<ReservationsOverview> {
  const { data, error } = await supabase.rpc(
    'get_inventory_reservations_overview' as never,
  );
  if (error) throw error;
  const row = (data as any)?.[0] ?? {};
  return {
    active_reservations: Number(row.active_reservations ?? 0),
    reserved_items: Number(row.reserved_items ?? 0),
    reservations_in_preparation: Number(row.reservations_in_preparation ?? 0),
    reservations_dispatched: Number(row.reservations_dispatched ?? 0),
    reservations_in_operation: Number(row.reservations_in_operation ?? 0),
    next_operational_start: row.next_operational_start ?? null,
  };
}

// Marker exports for unused
export const RESERVATION_TABLES = { TABLE, ITEMS_TABLE, ALLOC_TABLE };
