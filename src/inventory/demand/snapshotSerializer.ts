// NOID-VERTICAL-1.0-VERT-01.2D-B
// Serializer lógico de snapshot v2. NÃO grava em banco.
// Aliases `eventrix_*` são adicionados exclusivamente aqui e apenas quando
// `provider_type === 'eventrix'`, mantendo o domínio genérico limpo.
import type { InventoryProviderType } from '@/inventory/providers/types';
import type {
  InventoryDemandLine,
  InventoryDemandPreview,
  InventoryDemandStatus,
} from './types';
import type {
  InventoryDemandSourceProduct,
  InventoryDemandSourceRequirement,
} from './sources';

export const INVENTORY_DEMAND_SCHEMA_VERSION = 2 as const;
export const INVENTORY_DEMAND_ALGORITHM_VERSION = 'inventory-demand-v2' as const;

export interface InventoryDemandSnapshotV2Line {
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
  status: InventoryDemandLine['status'];
  source_products: InventoryDemandLine['source_products'];
  // Aliases Eventrix — presentes apenas quando provider_type === 'eventrix'.
  eventrix_category_id?: string;
  eventrix_category_name?: string;
  eventrix_family_id?: string;
  eventrix_family_name?: string;
  eventrix_item_kind?: string | null;
}

export interface InventoryDemandSnapshotV2Summary {
  required_families: number;
  total_required_units: number;
  required_lines: number;
  optional_lines: number;
  manual_lines: number;
  incomplete_lines: number;
}

export interface InventoryDemandSnapshotV2 {
  schema_version: typeof INVENTORY_DEMAND_SCHEMA_VERSION;
  algorithm_version: typeof INVENTORY_DEMAND_ALGORITHM_VERSION;
  provider_type: InventoryProviderType;
  status: InventoryDemandStatus;
  summary: InventoryDemandSnapshotV2Summary;
  payload: InventoryDemandPreview['payload'];
  lines: InventoryDemandSnapshotV2Line[];
  warnings: string[];
  commercial_context: InventoryDemandPreview['payload']['commercial_context'];
  source_products: InventoryDemandSourceProduct[];
  source_requirements: Array<
    InventoryDemandSourceRequirement & {
      eventrix_category_id?: string;
      eventrix_category_name?: string;
      eventrix_family_id?: string;
      eventrix_family_name?: string;
      eventrix_item_kind?: string | null;
    }
  >;
  hash: string;
}

function buildSummary(
  preview: InventoryDemandPreview,
): InventoryDemandSnapshotV2Summary {
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

function withEventrixLineAliases(line: InventoryDemandLine): InventoryDemandSnapshotV2Line {
  const base: InventoryDemandSnapshotV2Line = {
    key: line.key,
    provider_type: line.provider_type,
    category_ref: line.category_ref,
    category_name: line.category_name,
    family_ref: line.family_ref,
    family_name: line.family_name,
    item_kind: line.item_kind,
    unit_basis: line.unit_basis,
    is_required: line.is_required,
    required_quantity: line.required_quantity,
    requirement_quantity: line.requirement_quantity,
    calculation_label: line.calculation_label,
    status: line.status,
    source_products: line.source_products,
  };
  if (line.provider_type === 'eventrix') {
    base.eventrix_category_id = line.category_ref;
    base.eventrix_category_name = line.category_name;
    base.eventrix_family_id = line.family_ref;
    base.eventrix_family_name = line.family_name;
    base.eventrix_item_kind = line.item_kind;
  }
  return base;
}

function withEventrixRequirementAliases(
  r: InventoryDemandSourceRequirement,
): InventoryDemandSnapshotV2['source_requirements'][number] {
  if (r.provider_type !== 'eventrix') return { ...r };
  return {
    ...r,
    eventrix_category_id: r.category_ref,
    eventrix_category_name: r.category_name,
    eventrix_family_id: r.family_ref,
    eventrix_family_name: r.family_name,
    eventrix_item_kind: r.item_kind,
  };
}

export interface SerializeInventoryDemandInput {
  preview: InventoryDemandPreview;
  sourceProducts: InventoryDemandSourceProduct[];
  sourceRequirements: InventoryDemandSourceRequirement[];
  hash: string;
}

export function serializeInventoryDemandSnapshotV2(
  input: SerializeInventoryDemandInput,
): InventoryDemandSnapshotV2 {
  const { preview } = input;
  // clone shallow do payload para não mutar o preview original
  const payload = { ...preview.payload, mode: 'snapshot' as const };
  return {
    schema_version: INVENTORY_DEMAND_SCHEMA_VERSION,
    algorithm_version: INVENTORY_DEMAND_ALGORITHM_VERSION,
    provider_type: preview.provider_type,
    status: preview.status,
    summary: buildSummary(preview),
    payload,
    lines: (preview.lines ?? []).map(withEventrixLineAliases),
    warnings: [...(preview.warnings ?? [])],
    commercial_context: preview.payload.commercial_context,
    source_products: input.sourceProducts.map((s) => ({ ...s })),
    source_requirements: input.sourceRequirements.map(withEventrixRequirementAliases),
    hash: input.hash,
  };
}
