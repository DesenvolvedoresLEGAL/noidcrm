import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  getQuantityAvailableForStatus,
  type InventoryItemStatus,
} from '@/lib/operations/inventoryLabels';
import type { Criticality, OperationalType } from '@/lib/operations/inventoryClassification';
import {
  mergeTechnicalSpecs,
  sanitizeTechnicalSpecs,
  type TechnicalSpec,
} from '@/lib/operations/inventoryTechnicalSpecs';

export type InventoryItemRow = Database['public']['Tables']['inventory_items']['Row'] & {
  family_id?: string | null;
  operational_type?: OperationalType;
  criticality?: Criticality;
};

export interface InventoryItemWithRefs extends InventoryItemRow {
  category:
    | { id: string; name: string; item_kind: string; slug?: string | null; color?: string | null; icon?: string | null }
    | null;
  family: { id: string; name: string; slug?: string | null } | null;
  location: { id: string; name: string; location_type: string } | null;
}

export interface ClassificationFields {
  family_id?: string | null;
  operational_type?: OperationalType;
  criticality?: Criticality;
}

export interface SerializedItemInput extends ClassificationFields {
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
  technical_specs?: TechnicalSpec[];
  _currentMetadata?: unknown;
}

const SELECT_WITH_REFS =
  '*, category:inventory_categories(id,name,item_kind,slug,color,icon), family:inventory_families(id,name,slug), location:inventory_locations(id,name,location_type)';

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
      metadata: { technical_specs: sanitizeTechnicalSpecs(input.technical_specs ?? []) } as any,
      name: input.name.trim(),
      description: emptyToNull(input.description),
      category_id: input.category_id,
      location_id: input.location_id,
      family_id: input.family_id ?? null,
      operational_type: input.operational_type ?? 'equipment',
      criticality: input.criticality ?? 'medium',
      status: input.status,
      asset_code: emptyToNull(input.asset_code),
      serial_number: emptyToNull(input.serial_number),
      brand: emptyToNull(input.brand),
      model: emptyToNull(input.model),
      notes: emptyToNull(input.notes),
      created_by: userId ?? null,
      updated_by: userId ?? null,
    } as any)
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
  if (input.family_id !== undefined) patch.family_id = input.family_id ?? null;
  if (input.operational_type !== undefined) patch.operational_type = input.operational_type;
  if (input.criticality !== undefined) patch.criticality = input.criticality;
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
  if (input.technical_specs !== undefined) {
    patch.metadata = mergeTechnicalSpecs(
      input._currentMetadata,
      sanitizeTechnicalSpecs(input.technical_specs),
    );
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

// ---------- Quantity items ----------

export interface QuantityItemInput extends ClassificationFields {
  name: string;
  description?: string | null;
  category_id: string;
  location_id: string;
  status: InventoryItemStatus;
  unit_of_measure: string;
  quantity_total: number;
  quantity_available: number;
  quantity_minimum?: number | null;
  brand?: string | null;
  model?: string | null;
  notes?: string | null;
  technical_specs?: TechnicalSpec[];
  _currentMetadata?: unknown;
}

function quantityAvailableForStatus(
  status: InventoryItemStatus,
  requested: number,
  total: number,
): number {
  if (status !== 'available') return 0;
  const v = Number.isFinite(requested) ? requested : 0;
  return Math.max(0, Math.min(v, total));
}

export async function listQuantityItems(organizationId: string) {
  const { data, error } = await supabase
    .from('inventory_items')
    .select(SELECT_WITH_REFS)
    .eq('organization_id', organizationId)
    .eq('item_kind', 'quantity')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as InventoryItemWithRefs[];
}

export async function createQuantityItem(
  organizationId: string,
  userId: string | undefined,
  input: QuantityItemInput,
) {
  const total = Number(input.quantity_total);
  const available = quantityAvailableForStatus(input.status, Number(input.quantity_available), total);
  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      organization_id: organizationId,
      item_kind: 'quantity',
      name: input.name.trim(),
      description: emptyToNull(input.description),
      category_id: input.category_id,
      location_id: input.location_id,
      status: input.status,
      unit_of_measure: input.unit_of_measure,
      quantity_total: total,
      quantity_available: available,
      quantity_minimum:
        input.quantity_minimum === null || input.quantity_minimum === undefined
          ? null
          : Number(input.quantity_minimum),
      brand: emptyToNull(input.brand),
      model: emptyToNull(input.model),
      notes: emptyToNull(input.notes),
      metadata: { technical_specs: sanitizeTechnicalSpecs(input.technical_specs ?? []) } as any,
      created_by: userId ?? null,
      updated_by: userId ?? null,
    })
    .select(SELECT_WITH_REFS)
    .single();
  if (error) throw error;
  return data as unknown as InventoryItemWithRefs;
}

export async function updateQuantityItem(
  id: string,
  userId: string | undefined,
  input: Partial<QuantityItemInput> & { _currentTotal?: number },
) {
  const patch: Record<string, unknown> = {
    updated_by: userId ?? null,
    item_kind: 'quantity',
  };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = emptyToNull(input.description);
  if (input.category_id !== undefined) patch.category_id = input.category_id;
  if (input.location_id !== undefined) patch.location_id = input.location_id;
  if (input.unit_of_measure !== undefined) patch.unit_of_measure = input.unit_of_measure;
  if (input.brand !== undefined) patch.brand = emptyToNull(input.brand);
  if (input.model !== undefined) patch.model = emptyToNull(input.model);
  if (input.notes !== undefined) patch.notes = emptyToNull(input.notes);
  if (input.quantity_minimum !== undefined) {
    patch.quantity_minimum =
      input.quantity_minimum === null ? null : Number(input.quantity_minimum);
  }

  const total =
    input.quantity_total !== undefined ? Number(input.quantity_total) : input._currentTotal;
  if (input.quantity_total !== undefined) patch.quantity_total = total;

  if (input.status !== undefined || input.quantity_available !== undefined) {
    const status = (input.status ?? 'available') as InventoryItemStatus;
    if (input.status !== undefined) patch.status = status;
    const requested = Number(input.quantity_available ?? 0);
    patch.quantity_available = quantityAvailableForStatus(status, requested, total ?? requested);
  }
  if (input.technical_specs !== undefined) {
    patch.metadata = mergeTechnicalSpecs(
      input._currentMetadata,
      sanitizeTechnicalSpecs(input.technical_specs),
    );
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

export async function updateQuantityItemStatus(
  id: string,
  status: InventoryItemStatus,
  userId: string | undefined,
  quantityAvailable: number,
  total: number,
) {
  return updateQuantityItem(id, userId, {
    status,
    quantity_available: quantityAvailable,
    _currentTotal: total,
  });
}
