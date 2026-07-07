import type { ProductInventoryRequirement } from '@/hooks/products/useProductInventoryRequirements';
import type { UnitBasis } from '@/schemas/productInventoryRequirement';

export interface ProposalInventoryDemandLineSource {
  product_id: string;
  product_name: string;
  proposal_item_id?: string;
  quantity: number;
  required_quantity: number | null;
  calculation_label: string;
}

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

export interface ProposalInventoryDemandInputProposal {
  id?: string | null;
  organization_id?: string | null;
  opportunity_id?: string | null;
  customer_id?: string | null;
  account_id?: string | null;
  title?: string | null;
  event_name?: string | null;
  event_venue?: string | null;
  event_start_date?: string | null;
  event_end_date?: string | null;
  points?: number | null;
  point_count?: number | null;
  quantity_points?: number | null;
  access_points?: number | null;
  commercial_points?: number | null;
  days?: number | null;
  daily_count?: number | null;
  duration_days?: number | null;
  event_days?: number | null;
  commercial_days?: number | null;
  participant_count?: number | null;
  attendees_count?: number | null;
  expected_attendees?: number | null;
  visitors_count?: number | null;
}

export interface ProposalInventoryDemandInputItem {
  id?: string;
  product_id?: string | null;
  name?: string | null;
  quantity?: number | null;
  product_quantity?: number | null;
  item_quantity?: number | null;
  quantity_points?: number | null;
  billing_days?: number | null;
  billing_type?: string | null;
}

export interface ProposalInventoryDemandInput {
  proposal: ProposalInventoryDemandInputProposal | null | undefined;
  proposalItems: ProposalInventoryDemandInputItem[];
  productRequirements: ProductInventoryRequirement[];
}

function firstPositive(...vals: Array<number | null | undefined>): number | null {
  for (const v of vals) {
    if (v != null && Number.isFinite(Number(v)) && Number(v) > 0) return Number(v);
  }
  return null;
}

function daysBetween(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : null;
}

export function resolveCommercialContext(
  proposal: ProposalInventoryDemandInputProposal | null | undefined,
  items: ProposalInventoryDemandInputItem[],
): {
  points: number | null;
  days: number | null;
  participants: number | null;
  pointsAssumed: boolean;
  daysAssumed: boolean;
} {
  const p = proposal ?? {};
  const explicitPoints = firstPositive(
    p.points,
    p.point_count,
    p.quantity_points,
    p.access_points,
    p.commercial_points,
  );
  const inferredPoints = items.reduce<number | null>((acc, it) => {
    if (it.billing_type === 'point_day' && it.quantity_points && it.quantity_points > 0) {
      return Math.max(acc ?? 0, Number(it.quantity_points));
    }
    return acc;
  }, null);
  const points = explicitPoints ?? inferredPoints;

  const explicitDays = firstPositive(
    p.days,
    p.daily_count,
    p.duration_days,
    p.event_days,
    p.commercial_days,
  );
  const inferredDays = items.reduce<number | null>((acc, it) => {
    if (it.billing_type === 'point_day' && it.billing_days && it.billing_days > 0) {
      return Math.max(acc ?? 0, Number(it.billing_days));
    }
    return acc;
  }, null);
  const days = explicitDays ?? inferredDays ?? daysBetween(p.event_start_date, p.event_end_date);

  const participants = firstPositive(
    p.participant_count,
    p.attendees_count,
    p.expected_attendees,
    p.visitors_count,
  );

  return {
    points,
    days,
    participants,
    pointsAssumed: points == null,
    daysAssumed: days == null,
  };
}

const BASIS_LABEL: Record<UnitBasis, string> = {
  per_point: 'pontos',
  per_event: 'evento',
  per_day: 'diárias',
  per_participant: 'participantes',
  per_unit: 'unidades',
  manual: 'manual',
};

function productQuantity(item: ProposalInventoryDemandInputItem): number {
  return (
    firstPositive(item.quantity, item.product_quantity, item.item_quantity) ?? 1
  );
}

export function buildProposalInventoryDemandPreview(
  input: ProposalInventoryDemandInput,
): ProposalInventoryDemandPreview {
  const { proposal, proposalItems, productRequirements } = input;
  const warnings: string[] = [];
  const ctx = resolveCommercialContext(proposal, proposalItems);

  const orgId = proposal?.organization_id ?? '';
  const emptyPayload: EventrixAvailabilityPreviewPayload = {
    source: 'noid',
    mode: 'preview',
    organization_id: orgId,
    proposal_id: proposal?.id ?? null,
    opportunity_id: proposal?.opportunity_id ?? null,
    customer_id: proposal?.customer_id ?? proposal?.account_id ?? null,
    event: {
      name: proposal?.event_name ?? proposal?.title ?? null,
      venue: proposal?.event_venue ?? null,
      start_date: proposal?.event_start_date ?? null,
      end_date: proposal?.event_end_date ?? null,
    },
    commercial_context: {
      points: ctx.points,
      days: ctx.days,
      participants: ctx.participants,
    },
    requirements: [],
  };

  if (!proposalItems || proposalItems.length === 0) {
    return {
      status: 'empty',
      warnings,
      totals: { requiredFamilies: 0, totalRequiredUnits: 0, optionalFamilies: 0 },
      lines: [],
      payload: emptyPayload,
    };
  }

  const reqsByProduct = new Map<string, ProductInventoryRequirement[]>();
  for (const r of productRequirements) {
    if (!r.is_active) continue;
    const arr = reqsByProduct.get(r.product_id) ?? [];
    arr.push(r);
    reqsByProduct.set(r.product_id, arr);
  }

  const groups = new Map<string, ProposalInventoryDemandLine>();
  let hasAnyRequirement = false;
  let hasParticipantMissing = false;
  let hasIncomplete = false;

  const effectivePoints = ctx.points ?? 1;
  const effectiveDays = ctx.days ?? 1;

  for (const item of proposalItems) {
    if (!item.product_id) continue;
    const reqs = reqsByProduct.get(item.product_id);
    if (!reqs || reqs.length === 0) continue;
    hasAnyRequirement = true;

    const pQty = productQuantity(item);
    const productName = item.name ?? 'Produto';

    for (const req of reqs) {
      const key = [
        req.eventrix_category_id,
        req.eventrix_family_id,
        req.unit_basis,
        req.is_required ? '1' : '0',
      ].join('|');

      let required: number | null = null;
      let calcLabel = '';
      let status: 'calculated' | 'manual' | 'incomplete' = 'calculated';
      const q = Number(req.quantity);

      switch (req.unit_basis) {
        case 'per_point':
          required = q * effectivePoints;
          calcLabel = `${q} × ${effectivePoints} pontos`;
          break;
        case 'per_event':
          required = q;
          calcLabel = `${q} fixo por evento`;
          break;
        case 'per_day':
          required = q * effectiveDays;
          calcLabel = `${q} × ${effectiveDays} diárias`;
          break;
        case 'per_participant':
          if (ctx.participants != null) {
            required = q * ctx.participants;
            calcLabel = `${q} × ${ctx.participants} participantes`;
          } else {
            required = null;
            calcLabel = 'Aguardando participantes';
            status = 'incomplete';
            hasParticipantMissing = true;
            hasIncomplete = true;
          }
          break;
        case 'per_unit':
          required = q * pQty;
          calcLabel = `${q} × ${pQty} unidades`;
          break;
        case 'manual':
          required = null;
          calcLabel = 'Manual';
          status = 'manual';
          break;
      }

      const source: ProposalInventoryDemandLineSource = {
        product_id: item.product_id,
        product_name: productName,
        proposal_item_id: item.id,
        quantity: pQty,
        required_quantity: required,
        calculation_label: calcLabel,
      };

      const existing = groups.get(key);
      if (existing) {
        if (existing.required_quantity != null && required != null) {
          existing.required_quantity += required;
        } else if (required != null && existing.required_quantity == null && existing.status !== 'manual') {
          existing.required_quantity = required;
        }
        existing.source_products.push(source);
        if (status === 'incomplete') existing.status = 'incomplete';
      } else {
        groups.set(key, {
          key,
          eventrix_category_id: req.eventrix_category_id,
          eventrix_category_name: req.eventrix_category_name,
          eventrix_family_id: req.eventrix_family_id,
          eventrix_family_name: req.eventrix_family_name,
          eventrix_item_kind: req.eventrix_item_kind,
          unit_basis: req.unit_basis,
          is_required: req.is_required,
          required_quantity: required,
          requirement_quantity: q,
          calculation_label: calcLabel,
          status,
          source_products: [source],
        });
      }
    }
  }

  const lines = Array.from(groups.values()).sort((a, b) => {
    if (a.is_required !== b.is_required) return a.is_required ? -1 : 1;
    return a.eventrix_family_name.localeCompare(b.eventrix_family_name);
  });

  if (!hasAnyRequirement) {
    return {
      status: 'empty',
      warnings,
      totals: { requiredFamilies: 0, totalRequiredUnits: 0, optionalFamilies: 0 },
      lines: [],
      payload: emptyPayload,
    };
  }

  if (ctx.pointsAssumed && lines.some((l) => l.unit_basis === 'per_point')) {
    warnings.push('Quantidade de pontos não informada. Usando 1 como referência.');
  }
  if (ctx.daysAssumed && lines.some((l) => l.unit_basis === 'per_day')) {
    warnings.push('Quantidade de diárias não informada. Usando 1 como referência.');
  }
  if (hasParticipantMissing) {
    warnings.push('Existem demandas por participante, mas a quantidade de participantes não foi informada.');
  }

  const requiredFamilies = lines.filter((l) => l.is_required).length;
  const optionalFamilies = lines.filter((l) => !l.is_required).length;
  const totalRequiredUnits = lines.reduce(
    (acc, l) => acc + (l.required_quantity ?? 0),
    0,
  );

  const payload: EventrixAvailabilityPreviewPayload = {
    ...emptyPayload,
    requirements: lines.map((l) => ({
      eventrix_category_id: l.eventrix_category_id,
      eventrix_category_name: l.eventrix_category_name,
      eventrix_family_id: l.eventrix_family_id,
      eventrix_family_name: l.eventrix_family_name,
      eventrix_item_kind: l.eventrix_item_kind,
      quantity: l.required_quantity,
      unit_basis: l.unit_basis,
      is_required: l.is_required,
      source: {
        product_ids: Array.from(new Set(l.source_products.map((s) => s.product_id))),
        product_names: Array.from(new Set(l.source_products.map((s) => s.product_name))),
      },
    })),
  };

  return {
    status: hasIncomplete ? 'incomplete' : 'ready',
    warnings,
    totals: { requiredFamilies, totalRequiredUnits, optionalFamilies },
    lines,
    payload,
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

export { BASIS_LABEL };
