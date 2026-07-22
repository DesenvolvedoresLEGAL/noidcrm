// NOID-VERTICAL-1.0-VERT-01.2D-B
// @deprecated — ponte de compatibilidade. Delegado ao domínio genérico
// (`src/inventory/demand`). Persistência real (`useProposalInventoryDemandSnapshots`)
// permanece intocada nesta sprint.
import type {
  ProposalInventoryDemandPreview,
  ProposalInventoryDemandInputItem,
} from '@/lib/proposals/inventoryDemandPreview';
import type { ProductInventoryRequirement } from '@/hooks/products/useProductInventoryRequirements';
import type { ProposalInventoryDemandSnapshot } from '@/schemas/proposalInventoryDemandSnapshot';
import {
  buildInventoryDemandSourceProducts,
  buildInventoryDemandSourceRequirements,
  compareInventoryDemand,
  computeInventoryDemandHash,
  normalizeInventoryDemandPreviewForCompare,
  normalizeInventoryDemandSnapshotForCompare,
  normalizeProductInventoryRequirements,
  type InventoryDemandPreview as GenericPreview,
} from '@/inventory/demand';

export interface SnapshotSummary {
  required_families: number;
  total_required_units: number;
  required_lines: number;
  optional_lines: number;
  manual_lines: number;
  incomplete_lines: number;
}

function toGenericPreview(preview: ProposalInventoryDemandPreview): GenericPreview {
  return {
    status: preview.status,
    provider_type: 'eventrix',
    warnings: preview.warnings,
    totals: preview.totals,
    lines: (preview.lines ?? []).map((l) => ({
      key: l.key,
      provider_type: 'eventrix',
      category_ref: l.eventrix_category_id,
      category_name: l.eventrix_category_name,
      family_ref: l.eventrix_family_id,
      family_name: l.eventrix_family_name,
      item_kind: l.eventrix_item_kind,
      unit_basis: l.unit_basis,
      is_required: l.is_required,
      required_quantity: l.required_quantity,
      requirement_quantity: l.requirement_quantity,
      calculation_label: l.calculation_label,
      status: l.status,
      source_products: (l.source_products ?? []).map((s) => ({
        product_id: s.product_id,
        product_name: s.product_name,
        proposal_item_id: s.proposal_item_id ?? null,
        quantity: s.quantity,
        required_quantity: s.required_quantity,
        calculation_label: s.calculation_label,
      })),
    })),
    payload: {
      schema_version: 2,
      source: 'noid',
      mode: 'preview',
      provider_type: 'eventrix',
      organization_id: preview.payload.organization_id,
      proposal_id: preview.payload.proposal_id,
      opportunity_id: preview.payload.opportunity_id ?? null,
      customer_id: preview.payload.customer_id ?? null,
      event: {
        name: preview.payload.event.name ?? null,
        venue: preview.payload.event.venue ?? null,
        start_date: preview.payload.event.start_date ?? null,
        end_date: preview.payload.event.end_date ?? null,
        setup_start: preview.payload.event.setup_start ?? null,
        teardown_end: preview.payload.event.teardown_end ?? null,
      },
      commercial_context: preview.payload.commercial_context,
      requirements: (preview.payload.requirements ?? []).map((r) => ({
        provider_type: 'eventrix',
        category_ref: r.eventrix_category_id,
        category_name: r.eventrix_category_name,
        family_ref: r.eventrix_family_id,
        family_name: r.eventrix_family_name,
        item_kind: r.eventrix_item_kind,
        quantity: r.quantity,
        unit_basis: r.unit_basis,
        is_required: r.is_required,
        source: r.source,
      })),
    },
  };
}

/** @deprecated use serializer/summary genérico. */
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
      acc +
      (l.status === 'calculated' && typeof l.required_quantity === 'number'
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

/** @deprecated */
export function buildSourceProducts(
  preview: ProposalInventoryDemandPreview,
  proposalItems: ProposalInventoryDemandInputItem[],
) {
  const generic = toGenericPreview(preview);
  return buildInventoryDemandSourceProducts(generic, proposalItems);
}

/** @deprecated */
export function buildSourceRequirements(
  preview: ProposalInventoryDemandPreview,
  requirements: ProductInventoryRequirement[],
) {
  const generic = toGenericPreview(preview);
  const { normalized } = normalizeProductInventoryRequirements(requirements ?? [], {
    providerType: 'eventrix',
  });
  const genericReqs = buildInventoryDemandSourceRequirements(generic, normalized);
  // Adiciona aliases Eventrix para consumidores legados (persistência atual).
  return genericReqs.map((r) => ({
    requirement_id: r.requirement_id,
    product_id: r.product_id,
    label: r.label,
    eventrix_category_id: r.category_ref,
    eventrix_category_name: r.category_name,
    eventrix_family_id: r.family_ref,
    eventrix_family_name: r.family_name,
    eventrix_item_kind: r.item_kind,
    quantity: r.quantity,
    unit_basis: r.unit_basis,
    is_required: r.is_required,
  }));
}

/** @deprecated use `normalizeInventoryDemandPreviewForCompare`. */
export function normalizePreviewForCompare(preview: ProposalInventoryDemandPreview) {
  return normalizeInventoryDemandPreviewForCompare(toGenericPreview(preview));
}

/** @deprecated use `normalizeInventoryDemandSnapshotForCompare`. */
export function normalizeSnapshotForCompare(snapshot: ProposalInventoryDemandSnapshot) {
  return normalizeInventoryDemandSnapshotForCompare(snapshot);
}

/** @deprecated use `compareInventoryDemand`. */
export function comparePreviewToSnapshot(
  preview: ProposalInventoryDemandPreview,
  snapshot: ProposalInventoryDemandSnapshot | null | undefined,
): 'no_snapshot' | 'aligned' | 'changed' {
  if (!snapshot) return 'no_snapshot';
  return compareInventoryDemand(toGenericPreview(preview), snapshot);
}

/** @deprecated use `computeInventoryDemandHash`. */
export function computePreviewHash(preview: ProposalInventoryDemandPreview): string {
  return computeInventoryDemandHash(toGenericPreview(preview));
}
