// NOID-VERTICAL-1.0-VERT-01.2E-B1
// Única fronteira autorizada a ler/escrever as colunas físicas
// `eventrix_*` de `product_inventory_requirements`.
//
// Contrato:
// - Core sempre trabalha com `InventoryProductRequirement` genérico.
// - Storage físico mantém `eventrix_*` intocado (sem migration).
// - `metadata.inventory_provider_type` identifica o provider quando presente.
// - Registros históricos SEM metadata são interpretados como 'eventrix'
//   porque esse é o significado físico real das colunas atuais.

import type { InventoryProviderType } from '@/inventory/providers/types';
import type { UnitBasis } from './unitBasis';
import {
  INVENTORY_PROVIDER_METADATA_KEY,
  InventoryRequirementMetadataError,
  InventoryRequirementProviderNotSupportedError,
  type InventoryProductRequirement,
  type InventoryProductRequirementInput,
} from './types';

/**
 * Shape físico atual da row em `product_inventory_requirements`.
 * NÃO exportar como contrato de domínio — uso restrito ao mapper e testes.
 */
export interface LegacyProductInventoryRequirementStorageRow {
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
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

const SUPPORTED_STORAGE_PROVIDERS = new Set<InventoryProviderType>(['eventrix']);

function readProviderFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): InventoryProviderType {
  if (!metadata || !(INVENTORY_PROVIDER_METADATA_KEY in metadata)) {
    // Fallback histórico: chave AUSENTE → colunas `eventrix_*` são a verdade física.
    return 'eventrix';
  }
  const raw = metadata[INVENTORY_PROVIDER_METADATA_KEY];
  if (raw === 'eventrix' || raw === 'native') return raw;
  // Chave presente com valor inválido = corrupção, não legado. Nunca reinterpretar.
  throw new InventoryRequirementMetadataError(
    `metadata.${INVENTORY_PROVIDER_METADATA_KEY} inválido: ${JSON.stringify(raw)}`,
  );
}

/**
 * Storage → Domain. Não muta a entrada.
 */
export function mapProductInventoryRequirementFromStorage(
  row: LegacyProductInventoryRequirementStorageRow,
): InventoryProductRequirement {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const provider_type = readProviderFromMetadata(metadata);
  return {
    id: row.id,
    organization_id: row.organization_id,
    product_id: row.product_id,
    label: row.label,
    provider_type,
    category_ref: row.eventrix_category_id,
    category_name: row.eventrix_category_name,
    family_ref: row.eventrix_family_id,
    family_name: row.eventrix_family_name,
    item_kind: row.eventrix_item_kind,
    quantity: Number(row.quantity),
    unit_basis: row.unit_basis,
    is_required: !!row.is_required,
    notes: row.notes,
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : 0,
    is_active: row.is_active !== false,
    metadata: { ...metadata },
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function ensureSupportedProvider(provider: InventoryProviderType | string) {
  if (!SUPPORTED_STORAGE_PROVIDERS.has(provider as InventoryProviderType)) {
    throw new InventoryRequirementProviderNotSupportedError(String(provider));
  }
}

function mergeProviderMetadata(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown> | null | undefined,
  provider: InventoryProviderType,
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    ...(incoming ?? {}),
    [INVENTORY_PROVIDER_METADATA_KEY]: provider,
  };
}

/**
 * Domain → Storage (INSERT). Não muta a entrada.
 * Rejeita providers sem contrato de persistência (por ora, apenas Eventrix).
 */
export function mapInventoryRequirementCreateToStorage(
  input: InventoryProductRequirementInput,
): Omit<
  LegacyProductInventoryRequirementStorageRow,
  'id' | 'organization_id' | 'product_id' | 'created_by' | 'updated_by' | 'created_at' | 'updated_at'
> {
  ensureSupportedProvider(input.provider_type);
  return {
    label: input.label,
    eventrix_category_id: input.category_ref,
    eventrix_category_name: input.category_name,
    eventrix_family_id: input.family_ref,
    eventrix_family_name: input.family_name,
    eventrix_item_kind: input.item_kind ?? null,
    quantity: input.quantity,
    unit_basis: input.unit_basis,
    is_required: input.is_required ?? true,
    notes: input.notes ?? null,
    sort_order: input.sort_order ?? 0,
    is_active: input.is_active ?? true,
    metadata: mergeProviderMetadata(null, input.metadata, input.provider_type),
  };
}

/**
 * Domain → Storage (UPDATE parcial). Preserva metadata existente via merge.
 * `existingMetadata` deve ser fornecido pelo caller quando `metadata` do input
 * for parcial, para evitar sobrescrita destrutiva.
 */
export function mapInventoryRequirementUpdateToStorage(
  input: Partial<InventoryProductRequirementInput>,
  existingMetadata?: Record<string, unknown> | null,
): Partial<LegacyProductInventoryRequirementStorageRow> {
  if (input.provider_type) ensureSupportedProvider(input.provider_type);
  const out: Partial<LegacyProductInventoryRequirementStorageRow> = {};
  if (input.label !== undefined) out.label = input.label;
  if (input.category_ref !== undefined) out.eventrix_category_id = input.category_ref;
  if (input.category_name !== undefined) out.eventrix_category_name = input.category_name;
  if (input.family_ref !== undefined) out.eventrix_family_id = input.family_ref;
  if (input.family_name !== undefined) out.eventrix_family_name = input.family_name;
  if (input.item_kind !== undefined) out.eventrix_item_kind = input.item_kind ?? null;
  if (input.quantity !== undefined) out.quantity = input.quantity;
  if (input.unit_basis !== undefined) out.unit_basis = input.unit_basis;
  if (input.is_required !== undefined) out.is_required = input.is_required;
  if (input.notes !== undefined) out.notes = input.notes ?? null;
  if (input.sort_order !== undefined) out.sort_order = input.sort_order;
  if (input.is_active !== undefined) out.is_active = input.is_active;

  const shouldTouchMetadata =
    input.metadata !== undefined || input.provider_type !== undefined;
  if (shouldTouchMetadata) {
    const provider = input.provider_type ?? readProviderFromMetadata(existingMetadata);
    ensureSupportedProvider(provider);
    out.metadata = mergeProviderMetadata(existingMetadata, input.metadata, provider);
  }
  return out;
}
