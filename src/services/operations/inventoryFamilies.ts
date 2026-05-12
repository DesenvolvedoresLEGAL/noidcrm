import { supabase } from '@/integrations/supabase/client';
import { normalizeSlug } from '@/lib/operations/inventoryClassification';

export type InventoryFamilyItemKind = 'serialized' | 'quantity';

export interface InventoryFamily {
  id: string;
  organization_id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  item_kind: InventoryFamilyItemKind;
  created_at: string;
  updated_at: string;
}

export interface InventoryFamilyInput {
  category_id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
  item_kind?: InventoryFamilyItemKind;
}

export async function listInventoryFamilies(
  organizationId: string,
  categoryId?: string,
) {
  let q = (supabase as any)
    .from('inventory_families')
    .select('*')
    .eq('organization_id', organizationId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (categoryId) q = q.eq('category_id', categoryId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as InventoryFamily[];
}

export async function createInventoryFamily(
  organizationId: string,
  userId: string | undefined,
  input: InventoryFamilyInput,
) {
  const slug =
    input.slug && input.slug.trim().length > 0
      ? normalizeSlug(input.slug)
      : normalizeSlug(input.name);
  const { data, error } = await (supabase as any)
    .from('inventory_families')
    .insert({
      organization_id: organizationId,
      category_id: input.category_id,
      name: input.name,
      slug,
      description: input.description ?? null,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
      item_kind: input.item_kind ?? 'serialized',
      created_by: userId ?? null,
      updated_by: userId ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as InventoryFamily;
}

export async function updateInventoryFamily(
  id: string,
  userId: string | undefined,
  input: Partial<InventoryFamilyInput>,
) {
  const patch: Record<string, unknown> = { ...input, updated_by: userId ?? null };
  if (input.slug !== undefined && input.slug !== null) {
    patch.slug = normalizeSlug(input.slug);
  }
  const { data, error } = await (supabase as any)
    .from('inventory_families')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as InventoryFamily;
}

export async function toggleInventoryFamilyStatus(
  id: string,
  isActive: boolean,
  userId: string | undefined,
) {
  return updateInventoryFamily(id, userId, { is_active: isActive });
}
