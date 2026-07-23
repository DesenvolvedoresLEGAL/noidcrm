// NOID-VERTICAL-1.0-VERT-01.2E-B1
// Hook genérico (não conectado à UI nesta sprint).
// Trabalha exclusivamente com `InventoryProductRequirement` do domínio;
// jamais expõe `eventrix_*` para o Core.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  mapInventoryRequirementCreateToStorage,
  mapInventoryRequirementUpdateToStorage,
  mapProductInventoryRequirementFromStorage,
  type LegacyProductInventoryRequirementStorageRow,
} from '@/inventory/requirements/storageMapper';
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
    queryFn: async (): Promise<InventoryProductRequirement[]> => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('organization_id', scope.organizationId)
        .eq('product_id', scope.productId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as LegacyProductInventoryRequirementStorageRow[]).map(
        mapProductInventoryRequirementFromStorage,
      );
    },
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
      const needsExistingMetadata =
        input.metadata !== undefined && input.provider_type === undefined;
      if (needsExistingMetadata) {
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
    },
  });
}

export function useDeactivateInventoryProductRequirement(scope: TenantScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const userId = await getUserId();
      // Soft delete apenas — nunca DELETE.
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
    },
  });
}
