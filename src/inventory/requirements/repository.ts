// NOID-VERTICAL-1.0-VERT-01.2E-B2B
// Repository genérico de Product Inventory Requirements.
// Única fronteira de leitura runtime que traduz storage físico
// (colunas `eventrix_*`) para o domínio genérico via storageMapper.
//
// Regras:
// - Sempre filtrar `organization_id` (tenant scope obrigatório).
// - Nunca retornar `eventrix_*` — apenas InventoryProductRequirement.
// - Não conter lógica React (hooks/queries). Consumido por hooks React
//   e por qualquer outro código server-side/edge que precise ler
//   requisitos genéricos.
// - Metadata inválida propaga `InventoryRequirementMetadataError`.

import { supabase } from '@/integrations/supabase/client';
import {
  mapProductInventoryRequirementFromStorage,
  type LegacyProductInventoryRequirementStorageRow,
} from './storageMapper';
import type { InventoryProductRequirement } from './types';

const TABLE = 'product_inventory_requirements' as const;

export interface ListInventoryProductRequirementsParams {
  organizationId: string;
  productId?: string;
  productIds?: string[];
  activeOnly?: boolean;
}

export function dedupeProductIds(ids: ReadonlyArray<string | null | undefined>): string[] {
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id === 'string' && id.length > 0) seen.add(id);
  }
  return Array.from(seen).sort();
}

export async function listInventoryProductRequirements(
  params: ListInventoryProductRequirementsParams,
): Promise<InventoryProductRequirement[]> {
  const { organizationId, productId, productIds, activeOnly } = params;
  if (!organizationId) {
    throw new Error('listInventoryProductRequirements: organizationId é obrigatório.');
  }

  // Escopo por produto — aceita productId único ou lista.
  const ids = productIds
    ? dedupeProductIds(productIds)
    : productId
      ? [productId]
      : null;

  if (ids && ids.length === 0) {
    // Nunca chamar `.in()` com array vazio (retornaria "sempre falso"
    // silencioso ou erro dependendo do driver). Caller deve tratar.
    return [];
  }

  let query = (supabase as any)
    .from(TABLE)
    .select('*')
    .eq('organization_id', organizationId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (ids) {
    query = ids.length === 1 ? query.eq('product_id', ids[0]) : query.in('product_id', ids);
  }
  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as LegacyProductInventoryRequirementStorageRow[]).map(
    mapProductInventoryRequirementFromStorage,
  );
}
