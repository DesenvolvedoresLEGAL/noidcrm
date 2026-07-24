/**
 * @deprecated LEGACY STORAGE BRIDGE — ZERO ACTIVE CORE CONSUMERS (VERT-01.2E-B2B).
 * Substituto genérico: `@/inventory/hooks/useInventoryProductRequirements`.
 * O ProductInventoryRequirementsEditor (B2A) e o Proposal Inventory Demand (B2B)
 * já não consomem este módulo. Mantido apenas por compatibilidade enquanto as
 * colunas físicas `eventrix_*` continuam existindo em
 * `product_inventory_requirements`. NÃO criar novos consumers.
 */
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

// NOID-VERTICAL-1.0-VERT-01.2E-A
// Removidos `useEventrixInventoryCache` e `EventrixSyncCacheItem`: sem consumers
// ativos no repositório. A leitura genérica de categorias/famílias de inventário
// é feita via `useInventoryCategories`/`useInventoryFamilies` em
// `@/inventory/hooks/useInventoryProvider`. A tabela física
// `eventrix_inventory_sync_cache` permanece intocada e continua alimentando o
// EventrixInventoryProvider através do adapter.

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
