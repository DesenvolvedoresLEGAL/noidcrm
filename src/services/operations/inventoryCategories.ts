import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type InventoryCategory = Database['public']['Tables']['inventory_categories']['Row'];
export type InventoryItemKind = Database['public']['Enums']['inventory_item_kind'];

export interface InventoryCategoryInput {
  name: string;
  description?: string | null;
  item_kind: InventoryItemKind;
  sort_order?: number;
  is_active?: boolean;
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
  const { data, error } = await supabase
    .from('inventory_categories')
    .insert({
      organization_id: organizationId,
      name: input.name,
      description: input.description ?? null,
      item_kind: input.item_kind,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
      created_by: userId ?? null,
      updated_by: userId ?? null,
    })
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
  const { data, error } = await supabase
    .from('inventory_categories')
    .update({
      ...input,
      updated_by: userId ?? null,
    })
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
