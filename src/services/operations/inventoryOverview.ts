import { supabase } from '@/integrations/supabase/client';
import type { InventoryItemStatus } from '@/lib/operations/inventoryLabels';

export interface OverviewItemSummary {
  id: string;
  item_kind: 'serialized' | 'quantity';
  status: InventoryItemStatus;
  quantity_total: number | null;
  quantity_available: number | null;
  quantity_minimum: number | null;
  updated_at: string;
}

export interface OverviewItemRow {
  id: string;
  name: string;
  item_kind: 'serialized' | 'quantity';
  status: InventoryItemStatus;
  quantity_total: number | null;
  quantity_available: number | null;
  quantity_minimum: number | null;
  updated_at: string;
  category: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
}

export interface StatusHistoryRow {
  id: string;
  item_id: string;
  from_status: InventoryItemStatus | null;
  to_status: InventoryItemStatus;
  reason: string | null;
  created_at: string;
  item: { name: string; item_kind: 'serialized' | 'quantity' } | null;
}

const ITEM_REFS_SELECT =
  'id,name,item_kind,status,quantity_total,quantity_available,quantity_minimum,updated_at,category:inventory_categories(id,name),location:inventory_locations(id,name)';

export async function listOverviewItems(orgId: string): Promise<OverviewItemSummary[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id,item_kind,status,quantity_total,quantity_available,quantity_minimum,updated_at')
    .eq('organization_id', orgId);
  if (error) throw error;
  return (data ?? []) as unknown as OverviewItemSummary[];
}

export async function countCategories(orgId: string): Promise<number> {
  const { count, error } = await supabase
    .from('inventory_categories')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId);
  if (error) throw error;
  return count ?? 0;
}

export async function countLocations(orgId: string): Promise<number> {
  const { count, error } = await supabase
    .from('inventory_locations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId);
  if (error) throw error;
  return count ?? 0;
}

export async function listCriticalItems(orgId: string): Promise<OverviewItemRow[]> {
  // PostgREST does not support OR with mixed conditions easily; fetch the union of:
  //  (a) status in (maintenance, damaged, lost)
  //  (b) item_kind = quantity AND quantity_available = 0
  //  (c) item_kind = quantity AND quantity_available < quantity_minimum (filtered client-side)
  const base = supabase
    .from('inventory_items')
    .select(ITEM_REFS_SELECT)
    .eq('organization_id', orgId);

  const [byStatus, byQuantity] = await Promise.all([
    base.in('status', ['maintenance', 'damaged', 'lost']),
    supabase
      .from('inventory_items')
      .select(ITEM_REFS_SELECT)
      .eq('organization_id', orgId)
      .eq('item_kind', 'quantity'),
  ]);

  if (byStatus.error) throw byStatus.error;
  if (byQuantity.error) throw byQuantity.error;

  const rows = [
    ...((byStatus.data ?? []) as unknown as OverviewItemRow[]),
    ...(((byQuantity.data ?? []) as unknown as OverviewItemRow[]).filter((it) => {
      const a = Number(it.quantity_available ?? 0);
      if (a === 0) return true;
      if (it.quantity_minimum !== null && it.quantity_minimum !== undefined) {
        return a < Number(it.quantity_minimum);
      }
      return false;
    })),
  ];

  // Dedup by id
  const seen = new Set<string>();
  const merged = rows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  // Sort: zerado > abaixo do min > manutenção > danificado > perdido > resto, then updated_at desc
  const rank = (r: OverviewItemRow) => {
    const a = Number(r.quantity_available ?? 0);
    if (r.item_kind === 'quantity' && a === 0) return 1;
    if (
      r.item_kind === 'quantity' &&
      r.quantity_minimum !== null &&
      r.quantity_minimum !== undefined &&
      a < Number(r.quantity_minimum)
    )
      return 2;
    if (r.status === 'maintenance') return 3;
    if (r.status === 'damaged') return 4;
    if (r.status === 'lost') return 5;
    return 9;
  };

  merged.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
  });

  return merged.slice(0, 10);
}

export async function listRecentItems(orgId: string): Promise<OverviewItemRow[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select(ITEM_REFS_SELECT)
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false })
    .limit(8);
  if (error) throw error;
  return (data ?? []) as unknown as OverviewItemRow[];
}

export async function listRecentStatusHistory(orgId: string): Promise<StatusHistoryRow[]> {
  const { data, error } = await supabase
    .from('inventory_status_history')
    .select(
      'id,item_id,from_status,to_status,reason,created_at,item:inventory_items(name,item_kind)',
    )
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(8);
  if (error) throw error;
  return (data ?? []) as unknown as StatusHistoryRow[];
}

export interface CategoryOverviewRow {
  category_id: string;
  category_name: string;
  category_slug: string | null;
  category_color: string | null;
  category_icon: string | null;
  total_skus: number;
  total_units: number;
  available_units: number;
  reserved_units: number;
  maintenance_units: number;
  critical_items: number;
}

export async function getCategoryOverview(orgId: string): Promise<CategoryOverviewRow[]> {
  const { data, error } = await (supabase as any).rpc('get_inventory_category_overview', {
    p_org_id: orgId,
  });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    category_id: r.category_id,
    category_name: r.category_name,
    category_slug: r.category_slug,
    category_color: r.category_color,
    category_icon: r.category_icon,
    total_skus: Number(r.total_skus ?? 0),
    total_units: Number(r.total_units ?? 0),
    available_units: Number(r.available_units ?? 0),
    reserved_units: Number(r.reserved_units ?? 0),
    maintenance_units: Number(r.maintenance_units ?? 0),
    critical_items: Number(r.critical_items ?? 0),
  }));
}
