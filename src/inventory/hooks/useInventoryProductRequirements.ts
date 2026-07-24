// NOID-VERTICAL-1.0-VERT-01.2E-B1 (repository extraction — B2B)
// Hooks React genéricos. Toda leitura runtime passa pelo
// repository (`@/inventory/requirements/repository`) para garantir
// ONE STORAGE READ BOUNDARY. Nenhum consumidor Core enxerga
// `eventrix_*` — apenas `InventoryProductRequirement`.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  mapInventoryRequirementCreateToStorage,
  mapInventoryRequirementUpdateToStorage,
  mapProductInventoryRequirementFromStorage,
  type LegacyProductInventoryRequirementStorageRow,
} from '@/inventory/requirements/storageMapper';
import {
  dedupeProductIds,
  listInventoryProductRequirements,
} from '@/inventory/requirements/repository';
import type {
  InventoryProductRequirement,
  InventoryProductRequirementInput,
} from '@/inventory/requirements/types';

const TABLE = 'product_inventory_requirements' as const;

interface TenantScope {
  organizationId: string;
  productId: string;
}

function key(scope: TenantScope) {
  return ['inventory-product-requirements', scope.organizationId, scope.productId] as const;
}

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export function useInventoryProductRequirements(scope: Partial<TenantScope>) {
  const enabled = !!scope.organizationId && !!scope.productId;
  return useQuery({
    queryKey: key({
      organizationId: scope.organizationId ?? '',
      productId: scope.productId ?? '',
    }),
    enabled,
    queryFn: (): Promise<InventoryProductRequirement[]> =>
      listInventoryProductRequirements({
        organizationId: scope.organizationId!,
        productId: scope.productId!,
      }),
  });
}

export interface UseInventoryProductRequirementsForProductsParams {
  organizationId: string | null | undefined;
  productIds: ReadonlyArray<string | null | undefined>;
  activeOnly?: boolean;
  enabled?: boolean;
}

/**
 * Bulk read genérica usada pelo Proposal Demand.
 * Nunca dispara `.in()` com array vazio; a query key é provider-neutral.
 */
export function useInventoryProductRequirementsForProducts(
  params: UseInventoryProductRequirementsForProductsParams,
) {
  const { organizationId, productIds, activeOnly = true, enabled = true } = params;
  const deduped = dedupeProductIds(productIds);
  const canRun = enabled && !!organizationId && deduped.length > 0;
  return useQuery({
    queryKey: [
      'inventory-product-requirements-bulk',
      organizationId ?? null,
      activeOnly,
      deduped.join(','),
    ] as const,
    enabled: canRun,
    queryFn: (): Promise<InventoryProductRequirement[]> =>
      listInventoryProductRequirements({
        organizationId: organizationId!,
        productIds: deduped,
        activeOnly,
      }),
  });
}

export function useCreateInventoryProductRequirement(scope: TenantScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: InventoryProductRequirementInput,
    ): Promise<InventoryProductRequirement> => {
      const userId = await getUserId();
      const payload = mapInventoryRequirementCreateToStorage(input);
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .insert({
          ...payload,
          organization_id: scope.organizationId,
          product_id: scope.productId,
          created_by: userId,
          updated_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return mapProductInventoryRequirementFromStorage(
        data as LegacyProductInventoryRequirementStorageRow,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(scope) });
      qc.invalidateQueries({ queryKey: ['inventory-product-requirements-bulk'] });
    },
  });
}

export function useUpdateInventoryProductRequirement(scope: TenantScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: Partial<InventoryProductRequirementInput>;
    }): Promise<InventoryProductRequirement> => {
      const userId = await getUserId();

      let existingMetadata: Record<string, unknown> | null = null;
      const shouldReadExistingMetadata =
        input.metadata !== undefined || input.provider_type !== undefined;
      if (shouldReadExistingMetadata) {
        const { data: current, error: readErr } = await (supabase as any)
          .from(TABLE)
          .select('metadata')
          .eq('id', id)
          .eq('organization_id', scope.organizationId)
          .eq('product_id', scope.productId)
          .single();
        if (readErr) throw readErr;
        existingMetadata = (current?.metadata ?? null) as Record<string, unknown> | null;
      }

      const patch = mapInventoryRequirementUpdateToStorage(input, existingMetadata);
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update({ ...patch, updated_by: userId })
        .eq('id', id)
        .eq('organization_id', scope.organizationId)
        .eq('product_id', scope.productId)
        .select()
        .single();
      if (error) throw error;
      return mapProductInventoryRequirementFromStorage(
        data as LegacyProductInventoryRequirementStorageRow,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(scope) });
      qc.invalidateQueries({ queryKey: ['inventory-product-requirements-bulk'] });
    },
  });
}

export function useDeactivateInventoryProductRequirement(scope: TenantScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const userId = await getUserId();
      const { error } = await (supabase as any)
        .from(TABLE)
        .update({ is_active: false, updated_by: userId })
        .eq('id', id)
        .eq('organization_id', scope.organizationId)
        .eq('product_id', scope.productId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(scope) });
      qc.invalidateQueries({ queryKey: ['inventory-product-requirements-bulk'] });
    },
  });
}
