import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  getQuantityAvailableForStatus,
  type InventoryItemStatus,
} from '@/lib/operations/inventoryLabels';

export type InventoryItemRow = Database['public']['Tables']['inventory_items']['Row'];

export interface InventoryItemWithRefs extends InventoryItemRow {
  category: { id: string; name: string; item_kind: string } | null;
  location: { id: string; name: string; location_type: string } | null;
}

export interface SerializedItemInput {
  name: string;
  description?: string | null;
  category_id: string;
  location_id: string;
  status: InventoryItemStatus;
  asset_code?: string | null;
  serial_number?: string | null;
  brand?: string | null;
  model?: string | null;
  notes?: string | null;
}

const SELECT_WITH_REFS =
  '*, category:inventory_categories(id,name,item_kind), location:inventory_locations(id,name,location_type)';

const emptyToNull = (v?: string | null) => {
  if (v === undefined || v === null) return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
};

export async function listSerializedItems(organizationId: string) {
  const { data, error } = await supabase
    .from('inventory_items')
    .select(SELECT_WITH_REFS)
    .eq('organization_id', organizationId)
    .eq('item_kind', 'serialized')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as InventoryItemWithRefs[];
}

export async function createSerializedItem(
  organizationId: string,
  userId: string | undefined,
  input: SerializedItemInput,
) {
  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      organization_id: organizationId,
      item_kind: 'serialized',
      quantity_total: 1,
      quantity_available: getQuantityAvailableForStatus(input.status),
      unit_of_measure: 'un',
      metadata: {},
      name: input.name.trim(),
      description: emptyToNull(input.description),
      category_id: input.category_id,
      location_id: input.location_id,
      status: input.status,
      asset_code: emptyToNull(input.asset_code),
      serial_number: emptyToNull(input.serial_number),
      brand: emptyToNull(input.brand),
      model: emptyToNull(input.model),
      notes: emptyToNull(input.notes),
      created_by: userId ?? null,
      updated_by: userId ?? null,
    })
    .select(SELECT_WITH_REFS)
    .single();
  if (error) throw error;
  return data as unknown as InventoryItemWithRefs;
}

export async function updateSerializedItem(
  id: string,
  userId: string | undefined,
  input: Partial<SerializedItemInput>,
) {
  const patch: Record<string, unknown> = {
    updated_by: userId ?? null,
    item_kind: 'serialized',
    quantity_total: 1,
  };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = emptyToNull(input.description);
  if (input.category_id !== undefined) patch.category_id = input.category_id;
  if (input.location_id !== undefined) patch.location_id = input.location_id;
  if (input.asset_code !== undefined) patch.asset_code = emptyToNull(input.asset_code);
  if (input.serial_number !== undefined)
    patch.serial_number = emptyToNull(input.serial_number);
  if (input.brand !== undefined) patch.brand = emptyToNull(input.brand);
  if (input.model !== undefined) patch.model = emptyToNull(input.model);
  if (input.notes !== undefined) patch.notes = emptyToNull(input.notes);
  if (input.status !== undefined) {
    patch.status = input.status;
    patch.quantity_available = getQuantityAvailableForStatus(input.status);
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .update(patch)
    .eq('id', id)
    .select(SELECT_WITH_REFS)
    .single();
  if (error) throw error;
  return data as unknown as InventoryItemWithRefs;
}

export async function updateSerializedItemStatus(
  id: string,
  status: InventoryItemStatus,
  userId: string | undefined,
) {
  return updateSerializedItem(id, userId, { status });
}
