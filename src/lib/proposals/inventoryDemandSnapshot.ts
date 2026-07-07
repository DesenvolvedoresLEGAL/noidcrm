import type {
  ProposalInventoryDemandPreview,
  ProposalInventoryDemandInputItem,
} from '@/lib/proposals/inventoryDemandPreview';
import type { ProductInventoryRequirement } from '@/hooks/products/useProductInventoryRequirements';
import type { ProposalInventoryDemandSnapshot } from '@/schemas/proposalInventoryDemandSnapshot';

export interface SnapshotSummary {
  required_families: number;
  total_required_units: number;
  required_lines: number;
  optional_lines: number;
  manual_lines: number;
  incomplete_lines: number;
}

export function buildSnapshotSummary(
  preview: ProposalInventoryDemandPreview,
): SnapshotSummary {
  const lines = preview.lines ?? [];
  const requiredLines = lines.filter((l) => l.is_required);
  const optionalLines = lines.filter((l) => !l.is_required);
  const manualLines = lines.filter((l) => l.status === 'manual');
  const incompleteLines = lines.filter((l) => l.status === 'incomplete');
  const total = lines.reduce(
    (acc, l) =>
      acc + (l.status === 'calculated' && typeof l.required_quantity === 'number'
        ? l.required_quantity
        : 0),
    0,
  );
  return {
    required_families: requiredLines.length,
    total_required_units: total,
    required_lines: requiredLines.length,
    optional_lines: optionalLines.length,
    manual_lines: manualLines.length,
    incomplete_lines: incompleteLines.length,
  };
}

export function buildSourceProducts(
  preview: ProposalInventoryDemandPreview,
  proposalItems: ProposalInventoryDemandInputItem[],
) {
  const productIds = new Set<string>();
  for (const line of preview.lines ?? []) {
    for (const s of line.source_products ?? []) {
      if (s.product_id) productIds.add(s.product_id);
    }
  }
  const byId = new Map<string, ProposalInventoryDemandInputItem>();
  for (const it of proposalItems ?? []) {
    if (it.product_id && productIds.has(it.product_id) && !byId.has(it.product_id)) {
      byId.set(it.product_id, it);
    }
  }
  return Array.from(productIds).map((pid) => {
    const it = byId.get(pid);
    return {
      product_id: pid,
      product_name: it?.name ?? 'Produto',
      proposal_item_id: it?.id ?? null,
      quantity: Number(it?.quantity ?? it?.product_quantity ?? it?.item_quantity ?? 1),
    };
  });
}

export function buildSourceRequirements(
  preview: ProposalInventoryDemandPreview,
  requirements: ProductInventoryRequirement[],
) {
  const usedProductIds = new Set<string>();
  const usedKeys = new Set<string>();
  for (const line of preview.lines ?? []) {
    for (const s of line.source_products ?? []) {
      if (s.product_id) usedProductIds.add(s.product_id);
    }
    usedKeys.add(
      `${line.eventrix_category_id}|${line.eventrix_family_id}|${line.unit_basis}`,
    );
  }
  return (requirements ?? [])
    .filter(
      (r) =>
        r.is_active &&
        usedProductIds.has(r.product_id) &&
        usedKeys.has(
          `${r.eventrix_category_id}|${r.eventrix_family_id}|${r.unit_basis}`,
        ),
    )
    .map((r) => ({
      requirement_id: r.id,
      product_id: r.product_id,
      label: r.label,
      eventrix_category_id: r.eventrix_category_id,
      eventrix_category_name: r.eventrix_category_name,
      eventrix_family_id: r.eventrix_family_id,
      eventrix_family_name: r.eventrix_family_name,
      eventrix_item_kind: r.eventrix_item_kind,
      quantity: Number(r.quantity),
      unit_basis: r.unit_basis,
      is_required: r.is_required,
    }));
}

function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(',')}}`;
}

export function normalizePreviewForCompare(preview: ProposalInventoryDemandPreview) {
  return {
    summary: preview?.totals ?? {},
    commercial_context: preview?.payload?.commercial_context ?? {},
    requirements: preview?.payload?.requirements ?? [],
  };
}

export function normalizeSnapshotForCompare(snapshot: ProposalInventoryDemandSnapshot) {
  return {
    summary: {
      requiredFamilies: snapshot?.summary?.required_families ?? 0,
      totalRequiredUnits: snapshot?.summary?.total_required_units ?? 0,
      optionalFamilies: snapshot?.summary?.optional_lines ?? 0,
    },
    commercial_context: (snapshot?.payload as any)?.commercial_context ?? {},
    requirements: (snapshot?.payload as any)?.requirements ?? [],
  };
}

export function comparePreviewToSnapshot(
  preview: ProposalInventoryDemandPreview,
  snapshot: ProposalInventoryDemandSnapshot | null | undefined,
): 'no_snapshot' | 'aligned' | 'changed' {
  if (!snapshot) return 'no_snapshot';
  const a = stableStringify(normalizePreviewForCompare(preview));
  const b = stableStringify(normalizeSnapshotForCompare(snapshot));
  return a === b ? 'aligned' : 'changed';
}

export function computePreviewHash(preview: ProposalInventoryDemandPreview): string {
  // simple non-crypto hash of stable JSON — sufficient for change detection
  const str = stableStringify(normalizePreviewForCompare(preview));
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return `h${(h >>> 0).toString(16)}`;
}
