import { supabase } from '@/integrations/supabase/client';
import type {
  PreReservationStatus,
  PreReservationRiskLevel,
  PreReservationItemType,
  PreReservationAvailability,
  PreReservationSource,
  PreReservationAllocationStatus,
  DemandSource,
} from '@/lib/operations/inventoryPreReservations';

export interface PreReservationRow {
  id: string;
  organization_id: string;
  proposal_id: string | null;
  opportunity_id: string | null;
  account_id: string | null;
  contact_id: string | null;
  reservation_code: string;
  title: string;
  source: PreReservationSource;
  operational_start_date: string;
  operational_end_date: string;
  event_start_date: string | null;
  event_end_date: string | null;
  status: PreReservationStatus;
  risk_level: PreReservationRiskLevel;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PreReservationItemRow {
  id: string;
  organization_id: string;
  pre_reservation_id: string;
  inventory_item_type: PreReservationItemType;
  serialized_item_id: string | null;
  quantity_item_id: string | null;
  category_id: string | null;
  family_id: string | null;
  requested_quantity: number;
  pre_reserved_quantity: number;
  availability_status: PreReservationAvailability;
  conflict_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PreReservationWithItems extends PreReservationRow {
  items: (PreReservationItemRow & {
    serialized_item?: { id: string; name: string; asset_code: string | null } | null;
    quantity_item?: { id: string; name: string; unit_of_measure: string | null } | null;
    category?: { id: string; name: string } | null;
    family?: { id: string; name: string } | null;
  })[];
}

export interface PreReservationFilters {
  status?: PreReservationStatus | 'all';
  risk?: PreReservationRiskLevel | 'all';
  search?: string;
  startDate?: string;
  endDate?: string;
}

const TABLE = 'inventory_pre_reservations';
const ITEMS_TABLE = 'inventory_pre_reservation_items';

export async function listPreReservations(
  organizationId: string,
  filters: PreReservationFilters = {},
): Promise<(PreReservationRow & { items_count: number; conflicts_count: number })[]> {
  let q = supabase
    .from(TABLE as never)
    .select('*, items:inventory_pre_reservation_items(id,availability_status)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
  if (filters.risk && filters.risk !== 'all') q = q.eq('risk_level', filters.risk);
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
    conflicts_count:
      r.items?.filter((i: any) =>
        ['partial', 'unavailable'].includes(i.availability_status),
      ).length ?? 0,
  }));
}

export async function getPreReservation(id: string): Promise<PreReservationWithItems> {
  const { data, error } = await supabase
    .from(TABLE as never)
    .select(
      `*,
       items:inventory_pre_reservation_items(
         *,
         serialized_item:inventory_items!inventory_pre_reservation_items_serialized_item_id_fkey(id,name,asset_code),
         quantity_item:inventory_items!inventory_pre_reservation_items_quantity_item_id_fkey(id,name,unit_of_measure),
         category:inventory_categories(id,name),
         family:inventory_families(id,name)
       )`,
    )
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as PreReservationWithItems;
}

export interface CreatePreReservationPayload {
  organization_id: string;
  user_id?: string | null;
  title: string;
  source?: PreReservationSource;
  proposal_id?: string | null;
  opportunity_id?: string | null;
  account_id?: string | null;
  contact_id?: string | null;
  operational_start_date: string;
  operational_end_date: string;
  event_start_date?: string | null;
  event_end_date?: string | null;
  status?: PreReservationStatus;
  notes?: string | null;
  items: Array<{
    inventory_item_type: PreReservationItemType;
    serialized_item_id?: string | null;
    quantity_item_id?: string | null;
    category_id?: string | null;
    family_id?: string | null;
    requested_quantity: number;
    notes?: string | null;
  }>;
}

export async function createPreReservation(
  payload: CreatePreReservationPayload,
): Promise<PreReservationRow> {
  const { items, user_id, organization_id, ...rest } = payload;
  const { data: reservation, error } = await supabase
    .from(TABLE as never)
    .insert({
      organization_id,
      created_by: user_id ?? null,
      updated_by: user_id ?? null,
      source: 'manual',
      status: 'active',
      ...rest,
    } as never)
    .select('*')
    .single();
  if (error) throw error;

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from(ITEMS_TABLE as never).insert(
      items.map((it) => ({
        organization_id,
        pre_reservation_id: (reservation as any).id,
        inventory_item_type: it.inventory_item_type,
        serialized_item_id: it.serialized_item_id ?? null,
        quantity_item_id: it.quantity_item_id ?? null,
        category_id: it.category_id ?? null,
        family_id: it.family_id ?? null,
        requested_quantity: it.requested_quantity,
        notes: it.notes ?? null,
      })) as never,
    );
    if (itemsError) throw itemsError;
  }

  await recalculatePreReservation((reservation as any).id);
  return reservation as unknown as PreReservationRow;
}

export async function updatePreReservation(
  id: string,
  patch: Partial<{
    title: string;
    operational_start_date: string;
    operational_end_date: string;
    event_start_date: string | null;
    event_end_date: string | null;
    notes: string | null;
    status: PreReservationStatus;
  }>,
  userId?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from(TABLE as never)
    .update({ ...patch, updated_by: userId ?? null } as never)
    .eq('id', id);
  if (error) throw error;
}

export async function cancelPreReservation(id: string, userId?: string | null) {
  return updatePreReservation(id, { status: 'cancelled' }, userId);
}

export async function recalculatePreReservation(id: string) {
  const { data, error } = await supabase.rpc(
    'recalculate_inventory_pre_reservation_status' as never,
    { p_pre_reservation_id: id } as never,
  );
  if (error) throw error;
  return data;
}

export async function checkAvailabilityForPeriod(input: {
  organization_id: string;
  inventory_item_type: PreReservationItemType;
  serialized_item_id?: string | null;
  quantity_item_id?: string | null;
  requested_quantity: number;
  start_date: string;
  end_date: string;
  ignore_pre_reservation_id?: string | null;
}) {
  const { data, error } = await supabase.rpc(
    'check_inventory_availability_for_period' as never,
    {
      p_organization_id: input.organization_id,
      p_inventory_item_type: input.inventory_item_type,
      p_serialized_item_id: input.serialized_item_id ?? null,
      p_quantity_item_id: input.quantity_item_id ?? null,
      p_requested_quantity: input.requested_quantity,
      p_start_date: input.start_date,
      p_end_date: input.end_date,
      p_ignore_pre_reservation_id: input.ignore_pre_reservation_id ?? null,
    } as never,
  );
  if (error) throw error;
  return (data as any)?.[0] ?? null;
}

export interface PreReservationsOverview {
  active_pre_reservations: number;
  pre_reserved_items: number;
  availability_conflicts: number;
  critical_risk_reservations: number;
  next_operational_start: string | null;
}

export async function getPreReservationsOverview(): Promise<PreReservationsOverview> {
  const { data, error } = await supabase.rpc(
    'get_inventory_pre_reservations_overview' as never,
  );
  if (error) throw error;
  const row = (data as any)?.[0] ?? {};
  return {
    active_pre_reservations: Number(row.active_pre_reservations ?? 0),
    pre_reserved_items: Number(row.pre_reserved_items ?? 0),
    availability_conflicts: Number(row.availability_conflicts ?? 0),
    critical_risk_reservations: Number(row.critical_risk_reservations ?? 0),
    next_operational_start: row.next_operational_start ?? null,
  };
}

export async function getItemPreReservationSummary(input: {
  inventory_item_type: 'serialized' | 'quantity';
  serialized_item_id?: string | null;
  quantity_item_id?: string | null;
}) {
  const { data, error } = await supabase.rpc(
    'get_inventory_item_pre_reservation_summary' as never,
    {
      p_inventory_item_type: input.inventory_item_type,
      p_serialized_item_id: input.serialized_item_id ?? null,
      p_quantity_item_id: input.quantity_item_id ?? null,
    } as never,
  );
  if (error) throw error;
  const row = (data as any)?.[0] ?? {};
  return {
    active_pre_reservations: Number(row.active_pre_reservations ?? 0),
    pre_reserved_quantity: Number(row.pre_reserved_quantity ?? 0),
    next_reserved_until: (row.next_reserved_until as string | null) ?? null,
  };
}

export async function listPreReservationsByProposal(
  organizationId: string,
  proposalId: string,
) {
  const { data, error } = await supabase
    .from(TABLE as never)
    .select('*, items:inventory_pre_reservation_items(id,availability_status)')
    .eq('organization_id', organizationId)
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as (PreReservationRow & {
    items: { id: string; availability_status: PreReservationAvailability }[];
  })[];
}
