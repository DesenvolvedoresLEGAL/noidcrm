// NOID-VERTICAL-1.0-VERT-01.2D-B
// Reader de snapshots v1 (Eventrix) e v2 (genérico). NÃO grava em banco.
// Snapshots v1 são normalizados em runtime — o histórico permanece intocado.
import type { InventoryProviderType } from '@/inventory/providers/types';
import type { InventoryDemandStatus } from './types';

export interface NormalizedSnapshotLine {
  key: string;
  provider_type: InventoryProviderType;
  category_ref: string;
  category_name: string;
  family_ref: string;
  family_name: string;
  item_kind: string | null;
  unit_basis: string;
  is_required: boolean;
  required_quantity: number | null;
  requirement_quantity: number;
  calculation_label: string;
  status: 'calculated' | 'manual' | 'incomplete';
  source_products: any[];
}

export interface NormalizedSnapshotRequirement {
  requirement_id?: string;
  product_id?: string;
  label?: string;
  provider_type: InventoryProviderType;
  category_ref: string;
  category_name: string;
  family_ref: string;
  family_name: string;
  item_kind: string | null;
  quantity: number;
  unit_basis: string;
  is_required: boolean;
}

export interface NormalizedInventoryDemandSnapshot {
  valid: boolean;
  error_code?: 'malformed' | 'missing_lines' | 'unknown';
  warnings: string[];
  schema_version: 1 | 2;
  raw_schema_version?: unknown;
  provider_type: InventoryProviderType;
  status: InventoryDemandStatus | 'unknown';
  summary: Record<string, any>;
  payload: Record<string, any>;
  commercial_context: Record<string, any>;
  lines: NormalizedSnapshotLine[];
  warnings_payload: string[];
  source_products: any[];
  source_requirements: NormalizedSnapshotRequirement[];
  hash: string | null;
  algorithm_version?: string;
}

function pickString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return '';
}

function pickNullableString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim().length > 0) return v;
    if (v === null) return null;
  }
  return null;
}

function normalizeLine(raw: any): NormalizedSnapshotLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const provider_type = (raw.provider_type as InventoryProviderType) ??
    (raw.eventrix_category_id || raw.eventrix_family_id ? 'eventrix' : 'eventrix');
  const category_ref = pickString(raw.category_ref, raw.eventrix_category_id);
  const family_ref = pickString(raw.family_ref, raw.eventrix_family_id);
  if (!category_ref || !family_ref) return null;
  return {
    key: pickString(raw.key, `${category_ref}|${family_ref}|${raw.unit_basis ?? ''}`),
    provider_type,
    category_ref,
    category_name: pickString(
      raw.category_name,
      raw.eventrix_category_name,
      category_ref,
    ),
    family_ref,
    family_name: pickString(raw.family_name, raw.eventrix_family_name, family_ref),
    item_kind: pickNullableString(raw.item_kind, raw.eventrix_item_kind),
    unit_basis: pickString(raw.unit_basis, 'per_event'),
    is_required: raw.is_required !== false,
    required_quantity:
      raw.required_quantity == null ? null : Number(raw.required_quantity),
    requirement_quantity: Number(raw.requirement_quantity ?? raw.quantity ?? 0),
    calculation_label: pickString(raw.calculation_label, ''),
    status: (raw.status as any) ?? 'calculated',
    source_products: Array.isArray(raw.source_products) ? raw.source_products : [],
  };
}

function normalizeRequirement(raw: any): NormalizedSnapshotRequirement | null {
  if (!raw || typeof raw !== 'object') return null;
  const provider_type: InventoryProviderType =
    (raw.provider_type as InventoryProviderType) ?? 'eventrix';
  const category_ref = pickString(raw.category_ref, raw.eventrix_category_id);
  const family_ref = pickString(raw.family_ref, raw.eventrix_family_id);
  if (!category_ref || !family_ref) return null;
  return {
    requirement_id: raw.requirement_id,
    product_id: raw.product_id,
    label: raw.label,
    provider_type,
    category_ref,
    category_name: pickString(
      raw.category_name,
      raw.eventrix_category_name,
      category_ref,
    ),
    family_ref,
    family_name: pickString(raw.family_name, raw.eventrix_family_name, family_ref),
    item_kind: pickNullableString(raw.item_kind, raw.eventrix_item_kind),
    quantity: Number(raw.quantity ?? 0),
    unit_basis: pickString(raw.unit_basis, 'per_event'),
    is_required: raw.is_required !== false,
  };
}

/**
 * Normaliza um snapshot v1 (Eventrix legado) ou v2 (genérico) para o
 * formato de leitura interno. Nunca escreve — nunca lança para a UI.
 */
export function normalizeInventoryDemandSnapshot(
  raw: any,
): NormalizedInventoryDemandSnapshot {
  const warnings: string[] = [];
  const rawSchema = raw?.payload?.schema_version ?? raw?.schema_version;
  const isV2 = rawSchema === 2 || rawSchema === '2';
  const schema_version: 1 | 2 = isV2 ? 2 : 1;

  if (!raw || typeof raw !== 'object') {
    return {
      valid: false,
      error_code: 'malformed',
      warnings: ['Snapshot ausente ou inválido.'],
      schema_version: 1,
      raw_schema_version: rawSchema,
      provider_type: 'eventrix',
      status: 'unknown',
      summary: {},
      payload: {},
      commercial_context: {},
      lines: [],
      warnings_payload: [],
      source_products: [],
      source_requirements: [],
      hash: null,
    };
  }

  const provider_type: InventoryProviderType =
    (raw?.payload?.provider_type as InventoryProviderType) ??
    (raw?.provider_type as InventoryProviderType) ??
    'eventrix';

  const linesRaw = Array.isArray(raw.lines) ? raw.lines : [];
  const lines = linesRaw
    .map(normalizeLine)
    .filter((l): l is NormalizedSnapshotLine => l !== null);

  const reqsRaw = Array.isArray(raw.source_requirements)
    ? raw.source_requirements
    : [];
  const source_requirements = reqsRaw
    .map(normalizeRequirement)
    .filter((r): r is NormalizedSnapshotRequirement => r !== null);

  const valid = lines.length === linesRaw.length && reqsRaw.length === source_requirements.length;
  if (!valid) warnings.push('Snapshot contém linhas com referência inválida.');

  return {
    valid,
    error_code: valid ? undefined : 'malformed',
    warnings,
    schema_version,
    raw_schema_version: rawSchema,
    provider_type,
    status: (raw?.status as any) ?? 'unknown',
    summary: (raw.summary as any) ?? {},
    payload: (raw.payload as any) ?? {},
    commercial_context:
      (raw.commercial_context as any) ??
      (raw?.payload?.commercial_context as any) ??
      {},
    lines,
    warnings_payload: Array.isArray(raw.warnings) ? raw.warnings : [],
    source_products: Array.isArray(raw.source_products) ? raw.source_products : [],
    source_requirements,
    hash: typeof raw.hash === 'string' ? raw.hash : null,
    algorithm_version:
      typeof raw.algorithm_version === 'string' ? raw.algorithm_version : undefined,
  };
}
