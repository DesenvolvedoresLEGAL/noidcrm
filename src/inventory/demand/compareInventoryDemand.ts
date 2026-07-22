// NOID-VERTICAL-1.0-VERT-01.2D-B
// Comparação semântica entre preview atual e snapshot persistido (v1/v2).
// Ignora aliases Eventrix, schema_version, algorithm_version isolados e
// ordem de propriedades. Hash não criptográfico — apenas detecção de mudança.
import type { InventoryDemandPreview } from './types';
import {
  normalizeInventoryDemandSnapshot,
  type NormalizedInventoryDemandSnapshot,
} from './snapshotCompatibility';

export type DemandComparisonResult = 'no_snapshot' | 'aligned' | 'changed';

function sortedRequirement(r: any) {
  return {
    provider_type: r.provider_type ?? 'eventrix',
    category_ref: r.category_ref ?? r.eventrix_category_id ?? '',
    family_ref: r.family_ref ?? r.eventrix_family_id ?? '',
    item_kind: r.item_kind ?? r.eventrix_item_kind ?? null,
    unit_basis: r.unit_basis ?? '',
    is_required: !!r.is_required,
    quantity: r.quantity == null ? null : Number(r.quantity),
  };
}

export function normalizeInventoryDemandPreviewForCompare(
  preview: InventoryDemandPreview,
) {
  const reqs = (preview?.payload?.requirements ?? []).map(sortedRequirement);
  reqs.sort((a, b) =>
    `${a.provider_type}|${a.category_ref}|${a.family_ref}|${a.unit_basis}`.localeCompare(
      `${b.provider_type}|${b.category_ref}|${b.family_ref}|${b.unit_basis}`,
    ),
  );
  return {
    provider_type: preview?.provider_type ?? 'eventrix',
    commercial_context: preview?.payload?.commercial_context ?? {},
    requirements: reqs,
  };
}

export function normalizeInventoryDemandSnapshotForCompare(
  snapshot: NormalizedInventoryDemandSnapshot | any,
) {
  const s: NormalizedInventoryDemandSnapshot =
    snapshot && typeof snapshot === 'object' && 'schema_version' in snapshot &&
    'lines' in snapshot && Array.isArray((snapshot as any).lines) &&
    typeof (snapshot as any).valid === 'boolean'
      ? (snapshot as NormalizedInventoryDemandSnapshot)
      : normalizeInventoryDemandSnapshot(snapshot);

  const reqsSource =
    (s.payload?.requirements as any[]) ??
    s.source_requirements ??
    s.lines.map((l) => ({
      provider_type: l.provider_type,
      category_ref: l.category_ref,
      family_ref: l.family_ref,
      item_kind: l.item_kind,
      unit_basis: l.unit_basis,
      is_required: l.is_required,
      quantity: l.required_quantity,
    }));
  const reqs = reqsSource.map(sortedRequirement);
  reqs.sort((a, b) =>
    `${a.provider_type}|${a.category_ref}|${a.family_ref}|${a.unit_basis}`.localeCompare(
      `${b.provider_type}|${b.category_ref}|${b.family_ref}|${b.unit_basis}`,
    ),
  );
  return {
    provider_type: s.provider_type,
    commercial_context: s.commercial_context ?? {},
    requirements: reqs,
  };
}

function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(',')}}`;
}

export function compareInventoryDemand(
  preview: InventoryDemandPreview,
  snapshot: NormalizedInventoryDemandSnapshot | any | null | undefined,
): DemandComparisonResult {
  if (!snapshot) return 'no_snapshot';
  const a = stableStringify(normalizeInventoryDemandPreviewForCompare(preview));
  const b = stableStringify(normalizeInventoryDemandSnapshotForCompare(snapshot));
  return a === b ? 'aligned' : 'changed';
}

/**
 * Hash não criptográfico usado apenas para detecção de mudança.
 * NÃO utilizar como mecanismo de segurança.
 */
export function computeInventoryDemandHash(
  preview: InventoryDemandPreview,
): string {
  const str = stableStringify(normalizeInventoryDemandPreviewForCompare(preview));
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return `h${(h >>> 0).toString(16)}`;
}
