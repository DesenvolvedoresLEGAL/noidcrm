import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { normalizeSlug } from '@/lib/operations/inventoryClassification';

export type InventoryCategory = Database['public']['Tables']['inventory_categories']['Row'];
export type InventoryItemKind = Database['public']['Enums']['inventory_item_kind'];

export type InventoryCategoryControlMode = 'serialized' | 'quantity' | 'mixed';

export interface InventoryCategoryInput {
  name: string;
  slug?: string | null;
  description?: string | null;
  item_kind: InventoryItemKind;
  control_mode?: InventoryCategoryControlMode;
  color?: string | null;
  icon?: string | null;
  sort_order?: number;
  is_active?: boolean;
  /**
   * Opaque profile marker persisted verbatim. Core does not know about
   * Connectivity Pack profiles (router / sim_card); those literals are owned
   * by `@/vertical-packs/connectivity/inventory`. Legacy default: `generic`.
   */
  equipment_profile?: string | null;
}

export async function listInventoryCategories(organizationId: string) {
  const { data, error } = await supabase
    .from('inventory_categories')
    .select('*')
    .eq('organization_id', organizationId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as InventoryCategory[];
}

export async function createInventoryCategory(
  organizationId: string,
  userId: string | undefined,
  input: InventoryCategoryInput,
) {
  const slug = (input.slug && input.slug.trim().length > 0
    ? normalizeSlug(input.slug)
    : normalizeSlug(input.name));
  const { data, error } = await supabase
    .from('inventory_categories')
    .insert({
      organization_id: organizationId,
      name: input.name,
      slug,
      description: input.description ?? null,
      item_kind: input.item_kind,
      control_mode: input.control_mode ?? (input.item_kind as any),
      color: input.color ?? null,
      icon: input.icon ?? null,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
      equipment_profile: input.equipment_profile ?? 'generic',
      created_by: userId ?? null,
      updated_by: userId ?? null,
    } as any)
    .select('*')
    .single();
  if (error) throw error;
  return data as InventoryCategory;
}

export async function updateInventoryCategory(
  id: string,
  userId: string | undefined,
  input: Partial<InventoryCategoryInput>,
) {
  const patch: Record<string, unknown> = { ...input, updated_by: userId ?? null };
  if (input.slug !== undefined && input.slug !== null) {
    patch.slug = normalizeSlug(input.slug);
  }
  const { data, error } = await supabase
    .from('inventory_categories')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as InventoryCategory;
}

export async function toggleInventoryCategoryStatus(
  id: string,
  isActive: boolean,
  userId: string | undefined,
) {
  return updateInventoryCategory(id, userId, { is_active: isActive });
}
