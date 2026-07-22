import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  ProductInventoryRequirementInput,
  UnitBasis,
} from '@/schemas/productInventoryRequirement';

export interface ProductInventoryRequirement {
  id: string;
  organization_id: string;
  product_id: string;
  label: string;
  eventrix_category_id: string;
  eventrix_category_name: string;
  eventrix_family_id: string;
  eventrix_family_name: string;
  eventrix_item_kind: string | null;
  quantity: number;
  unit_basis: UnitBasis;
  is_required: boolean;
  notes: string | null;
  sort_order: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

const TABLE = 'product_inventory_requirements' as const;

export interface EventrixSyncCacheItem {
  id: string;
  organization_id: string;
  eventrix_entity_id: string;
  entity_type: 'category' | 'family';
  name: string;
  description: string | null;
  parent_eventrix_entity_id: string | null;
  control_mode: string | null;
  item_kind: string | null;
  is_active: boolean;
  payload: Record<string, unknown> | null;
  synced_at: string | null;
}

/**
 * @deprecated NOID-VERTICAL-1.0-VERT-01.2A
 * Use `useInventoryCategories` / `useInventoryFamilies` de
 * `@/inventory/hooks/useInventoryProvider`. Preservado apenas para
 * compatibilidade legada e será removido em VERT-01.2B.
 */
export function useEventrixInventoryCache(organizationId?: string | null) {
  return useQuery({
    queryKey: ['eventrix-inventory-cache', organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<EventrixSyncCacheItem[]> => {
      const { data, error } = await (supabase as any)
        .from('eventrix_inventory_sync_cache')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as EventrixSyncCacheItem[];
    },
  });
}

export function useProductInventoryRequirements(productId?: string | null) {
  return useQuery({
    queryKey: ['product-inventory-requirements', productId],
    enabled: !!productId,
    queryFn: async (): Promise<ProductInventoryRequirement[]> => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProductInventoryRequirement[];
    },
  });
}

async function getUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export function useCreateProductInventoryRequirement(
  organizationId: string,
  productId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProductInventoryRequirementInput) => {
      const userId = await getUserId();
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .insert({
          organization_id: organizationId,
          product_id: productId,
          ...input,
          created_by: userId,
          updated_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ProductInventoryRequirement;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-inventory-requirements', productId] });
    },
  });
}

export function useUpdateProductInventoryRequirement(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: Partial<ProductInventoryRequirementInput>;
    }) => {
      const userId = await getUserId();
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update({ ...input, updated_by: userId })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ProductInventoryRequirement;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-inventory-requirements', productId] });
    },
  });
}

export function useDeactivateProductInventoryRequirement(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const userId = await getUserId();
      const { error } = await (supabase as any)
        .from(TABLE)
        .update({ is_active: false, updated_by: userId })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-inventory-requirements', productId] });
    },
  });
}
