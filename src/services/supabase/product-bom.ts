import { supabase } from '@/integrations/supabase/client';

export interface ProductBomItem {
  id: string;
  organization_id: string;
  product_id: string;
  component_product_id: string | null;
  inventory_category_id: string | null;
  inventory_family_id: string | null;
  quantity_per_point: number;
  label: string | null;
  notes: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface ProductBomItemInput {
  component_product_id?: string | null;
  inventory_category_id?: string | null;
  inventory_family_id?: string | null;
  quantity_per_point: number;
  label?: string | null;
  notes?: string | null;
  order_index?: number;
}

export async function listProductBomItems(productId: string): Promise<ProductBomItem[]> {
  const { data, error } = await (supabase as any)
    .from('product_bom_items')
    .select('*')
    .eq('product_id', productId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProductBomItem[];
}

export async function replaceProductBomItems(
  organizationId: string,
  productId: string,
  items: ProductBomItemInput[],
): Promise<void> {
  const { error: delErr } = await (supabase as any)
    .from('product_bom_items')
    .delete()
    .eq('product_id', productId);
  if (delErr) throw delErr;

  if (!items.length) return;

  const rows = items.map((it, idx) => ({
    organization_id: organizationId,
    product_id: productId,
    component_product_id: it.component_product_id ?? null,
    inventory_category_id: it.inventory_category_id ?? null,
    inventory_family_id: it.inventory_family_id ?? null,
    quantity_per_point: Number(it.quantity_per_point) || 1,
    label: it.label ?? null,
    notes: it.notes ?? null,
    order_index: it.order_index ?? idx,
  }));

  const { error: insErr } = await (supabase as any)
    .from('product_bom_items')
    .insert(rows);
  if (insErr) throw insErr;
}
