// NOID-VERTICAL-1.0-VERT-01.2D-B
// @deprecated — este módulo permanece apenas como ponte de compatibilidade
// para consumidores existentes (componentes e hooks de proposta).
// A implementação real vive em `src/inventory/demand` (builder genérico).
// A resolução real do provider ativo será conectada na sprint VERT-01.2D-C.
import type { ProductInventoryRequirement } from '@/hooks/products/useProductInventoryRequirements';
import type { UnitBasis } from '@/schemas/productInventoryRequirement';
import {
  buildInventoryDemandPreview,
  normalizeProductInventoryRequirements,
  resolveInventoryDemandCommercialContext,
  type InventoryDemandInputItem,
  type InventoryDemandInputProposal,
  type InventoryDemandLine,
  type InventoryDemandPreview as GenericPreview,
} from '@/inventory/demand';

/** @deprecated use `InventoryDemandLineSource` de `@/inventory/demand`. */
export interface ProposalInventoryDemandLineSource {
  product_id: string;
  product_name: string;
  proposal_item_id?: string;
  quantity: number;
  required_quantity: number | null;
  calculation_label: string;
}

/** @deprecated use `InventoryDemandLine` de `@/inventory/demand`. */
export interface ProposalInventoryDemandLine {
  key: string;
  eventrix_category_id: string;
  eventrix_category_name: string;
  eventrix_family_id: string;
  eventrix_family_name: string;
  eventrix_item_kind: string | null;
  unit_basis: UnitBasis;
  is_required: boolean;
  required_quantity: number | null;
  requirement_quantity: number;
  calculation_label: string;
  status: 'calculated' | 'manual' | 'incomplete';
  source_products: ProposalInventoryDemandLineSource[];
}

/** @deprecated use `InventoryDemandPayload` genérico. */
export interface EventrixAvailabilityPreviewPayload {
  source: 'noid';
  mode: 'preview';
  organization_id: string;
  proposal_id: string | null;
  opportunity_id?: string | null;
  customer_id?: string | null;
  event: {
    name?: string | null;
    venue?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    setup_start?: string | null;
    teardown_end?: string | null;
  };
  commercial_context: {
    points: number | null;
    days: number | null;
    participants: number | null;
  };
  requirements: Array<{
    eventrix_category_id: string;
    eventrix_category_name: string;
    eventrix_family_id: string;
    eventrix_family_name: string;
    eventrix_item_kind: string | null;
    quantity: number | null;
    unit_basis: string;
    is_required: boolean;
    source: {
      product_ids: string[];
      product_names: string[];
    };
  }>;
}

/** @deprecated use `InventoryDemandPreview` genérico. */
export interface ProposalInventoryDemandPreview {
  status: 'ready' | 'empty' | 'incomplete';
  warnings: string[];
  totals: {
    requiredFamilies: number;
    totalRequiredUnits: number;
    optionalFamilies: number;
  };
  lines: ProposalInventoryDemandLine[];
  payload: EventrixAvailabilityPreviewPayload;
}

/** @deprecated */
export type ProposalInventoryDemandInputProposal = InventoryDemandInputProposal;
/** @deprecated */
export type ProposalInventoryDemandInputItem = InventoryDemandInputItem;

/** @deprecated */
export interface ProposalInventoryDemandInput {
  proposal: ProposalInventoryDemandInputProposal | null | undefined;
  proposalItems: ProposalInventoryDemandInputItem[];
  productRequirements: ProductInventoryRequirement[];
}

/** @deprecated use `resolveInventoryDemandCommercialContext`. */
export function resolveCommercialContext(
  proposal: ProposalInventoryDemandInputProposal | null | undefined,
  items: ProposalInventoryDemandInputItem[],
) {
  return resolveInventoryDemandCommercialContext(proposal, items);
}

function toLegacyLine(l: InventoryDemandLine): ProposalInventoryDemandLine {
  return {
    key: l.key,
    eventrix_category_id: l.category_ref,
    eventrix_category_name: l.category_name,
    eventrix_family_id: l.family_ref,
    eventrix_family_name: l.family_name,
    eventrix_item_kind: l.item_kind,
    unit_basis: l.unit_basis as UnitBasis,
    is_required: l.is_required,
    required_quantity: l.required_quantity,
    requirement_quantity: l.requirement_quantity,
    calculation_label: l.calculation_label,
    status: l.status,
    source_products: l.source_products.map((s) => ({
      product_id: s.product_id,
      product_name: s.product_name,
      proposal_item_id: s.proposal_item_id ?? undefined,
      quantity: s.quantity,
      required_quantity: s.required_quantity,
      calculation_label: s.calculation_label,
    })),
  };
}

function toLegacyPayload(p: GenericPreview['payload']): EventrixAvailabilityPreviewPayload {
  return {
    source: 'noid',
    mode: 'preview',
    organization_id: p.organization_id,
    proposal_id: p.proposal_id,
    opportunity_id: p.opportunity_id ?? null,
    customer_id: p.customer_id ?? null,
    event: {
      name: p.event?.name ?? null,
      venue: p.event?.venue ?? null,
      start_date: p.event?.start_date ?? null,
      end_date: p.event?.end_date ?? null,
      setup_start: p.event?.setup_start ?? null,
      teardown_end: p.event?.teardown_end ?? null,
    },
    commercial_context: {
      points: p.commercial_context.points,
      days: p.commercial_context.days,
      participants: p.commercial_context.participants,
    },
    requirements: (p.requirements ?? []).map((r) => ({
      eventrix_category_id: r.category_ref,
      eventrix_category_name: r.category_name,
      eventrix_family_id: r.family_ref,
      eventrix_family_name: r.family_name,
      eventrix_item_kind: r.item_kind,
      quantity: r.quantity,
      unit_basis: r.unit_basis,
      is_required: r.is_required,
      source: r.source,
    })),
  };
}

/**
 * @deprecated Wrapper legado — delega para o builder genérico
 * (`buildInventoryDemandPreview`) assumindo provider Eventrix.
 * A resolução real do provider ativo será conectada na D-C.
 */
export function buildProposalInventoryDemandPreview(
  input: ProposalInventoryDemandInput,
): ProposalInventoryDemandPreview {
  const { normalized } = normalizeProductInventoryRequirements(
    input.productRequirements ?? [],
    { providerType: 'eventrix' },
  );
  const generic = buildInventoryDemandPreview({
    proposal: input.proposal,
    proposalItems: input.proposalItems ?? [],
    requirements: normalized,
    providerType: 'eventrix',
    supportsProposalDemand: true,
  });
  // Wrapper legado mapeia unsupported -> empty apenas para não quebrar UI antiga.
  const status: 'ready' | 'empty' | 'incomplete' =
    generic.status === 'unsupported' ? 'empty' : generic.status;
  return {
    status,
    warnings: generic.warnings,
    totals: generic.totals,
    lines: generic.lines.map(toLegacyLine),
    payload: toLegacyPayload(generic.payload),
  };
}

export const UNIT_BASIS_UI_LABEL: Record<UnitBasis, string> = {
  per_point: 'Por ponto',
  per_event: 'Por evento',
  per_day: 'Por diária',
  per_participant: 'Por participante',
  per_unit: 'Por unidade',
  manual: 'Manual',
};

export const ITEM_KIND_UI_LABEL: Record<string, string> = {
  serialized: 'Serializado',
  quantity: 'Por quantidade',
};

const BASIS_LABEL: Record<UnitBasis, string> = {
  per_point: 'pontos',
  per_event: 'evento',
  per_day: 'diárias',
  per_participant: 'participantes',
  per_unit: 'unidades',
  manual: 'manual',
};

export { BASIS_LABEL };
