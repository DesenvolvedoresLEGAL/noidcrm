// NOID-VERTICAL-1.0-VERT-01.2D-B
// Builder genérico de Proposal Inventory Demand.
// Puro e determinístico — não consulta Supabase, hooks, cache ou provider externo.
// Preserva regras de cálculo do builder legado (`src/lib/proposals/inventoryDemandPreview.ts`)
// e adiciona status `unsupported` quando o provider ativo não declara capability
// `proposal_demand`.
import type { InventoryProviderType } from '@/inventory/providers/types';
import type { UnitBasis } from '@/schemas/productInventoryRequirement';
import type {
  InventoryDemandCommercialContext,
  InventoryDemandEventContext,
  InventoryDemandLine,
  InventoryDemandLineSource,
  InventoryDemandPayload,
  InventoryDemandPreview,
  InventoryDemandRequirementPayload,
  NormalizedProductInventoryRequirement,
} from './types';

export interface InventoryDemandInputProposal {
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

export interface InventoryDemandInputItem {
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

export interface BuildInventoryDemandInput {
  proposal: InventoryDemandInputProposal | null | undefined;
  proposalItems: InventoryDemandInputItem[];
  requirements: NormalizedProductInventoryRequirement[];
  providerType: InventoryProviderType;
  supportsProposalDemand: boolean;
}

export interface ResolvedInventoryDemandContext
  extends InventoryDemandCommercialContext {
  pointsAssumed: boolean;
  daysAssumed: boolean;
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

/**
 * Resolve o contexto comercial (points / days / participants) preservando
 * exatamente a prioridade do builder legado.
 */
export function resolveInventoryDemandCommercialContext(
  proposal: InventoryDemandInputProposal | null | undefined,
  items: InventoryDemandInputItem[],
): ResolvedInventoryDemandContext {
  const p = proposal ?? {};
  const explicitPoints = firstPositive(
    p.points,
    p.point_count,
    p.quantity_points,
    p.access_points,
    p.commercial_points,
  );
  const inferredPoints = (items ?? []).reduce<number | null>((acc, it) => {
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
  const inferredDays = (items ?? []).reduce<number | null>((acc, it) => {
    if (it.billing_type === 'point_day' && it.billing_days && it.billing_days > 0) {
      return Math.max(acc ?? 0, Number(it.billing_days));
    }
    return acc;
  }, null);
  const days =
    explicitDays ?? inferredDays ?? daysBetween(p.event_start_date, p.event_end_date);

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

function productQuantity(item: InventoryDemandInputItem): number {
  return firstPositive(item.quantity, item.product_quantity, item.item_quantity) ?? 1;
}

function buildEventContext(
  proposal: InventoryDemandInputProposal | null | undefined,
): InventoryDemandEventContext {
  return {
    name: proposal?.event_name ?? proposal?.title ?? null,
    venue: proposal?.event_venue ?? null,
    start_date: proposal?.event_start_date ?? null,
    end_date: proposal?.event_end_date ?? null,
    setup_start: null,
    teardown_end: null,
  };
}

function buildEmptyPayload(
  input: BuildInventoryDemandInput,
  ctx: ResolvedInventoryDemandContext,
  mode: 'preview' | 'snapshot' = 'preview',
): InventoryDemandPayload {
  const p = input.proposal ?? {};
  return {
    schema_version: 2,
    source: 'noid',
    mode,
    provider_type: input.providerType,
    organization_id: p.organization_id ?? '',
    proposal_id: p.id ?? null,
    opportunity_id: p.opportunity_id ?? null,
    customer_id: p.customer_id ?? p.account_id ?? null,
    event: buildEventContext(input.proposal),
    commercial_context: {
      points: ctx.points,
      days: ctx.days,
      participants: ctx.participants,
    },
    requirements: [],
  };
}

/**
 * Builder genérico. Determinístico e puro.
 */
export function buildInventoryDemandPreview(
  input: BuildInventoryDemandInput,
): InventoryDemandPreview {
  const warnings: string[] = [];
  const ctx = resolveInventoryDemandCommercialContext(
    input.proposal,
    input.proposalItems ?? [],
  );

  // Provider não suporta demanda de propostas — retornar unsupported.
  if (!input.supportsProposalDemand) {
    return {
      status: 'unsupported',
      provider_type: input.providerType,
      warnings: [
        'Provider de inventário ativo não suporta cálculo de demanda de propostas.',
      ],
      totals: { requiredFamilies: 0, totalRequiredUnits: 0, optionalFamilies: 0 },
      lines: [],
      payload: buildEmptyPayload(input, ctx),
    };
  }

  const items = input.proposalItems ?? [];
  if (items.length === 0) {
    return {
      status: 'empty',
      provider_type: input.providerType,
      warnings,
      totals: { requiredFamilies: 0, totalRequiredUnits: 0, optionalFamilies: 0 },
      lines: [],
      payload: buildEmptyPayload(input, ctx),
    };
  }

  // Indexa requisitos por product_id, filtrando providers estranhos e inativos.
  const reqsByProduct = new Map<string, NormalizedProductInventoryRequirement[]>();
  for (const r of input.requirements ?? []) {
    if (!r || !r.is_active) continue;
    if (r.provider_type !== input.providerType) continue;
    const arr = reqsByProduct.get(r.product_id) ?? [];
    arr.push(r);
    reqsByProduct.set(r.product_id, arr);
  }

  const groups = new Map<string, InventoryDemandLine>();
  let hasAnyRequirement = false;
  let hasParticipantMissing = false;
  let hasIncomplete = false;

  const effectivePoints = ctx.points ?? 1;
  const effectiveDays = ctx.days ?? 1;

  for (const item of items) {
    if (!item.product_id) continue;
    const reqs = reqsByProduct.get(item.product_id);
    if (!reqs || reqs.length === 0) continue;
    hasAnyRequirement = true;

    const pQty = productQuantity(item);
    const productName = item.name ?? 'Produto';

    for (const req of reqs) {
      const key = [
        req.provider_type,
        req.category_ref,
        req.family_ref,
        req.unit_basis,
        req.is_required ? '1' : '0',
      ].join('|');

      let required: number | null = null;
      let calcLabel = '';
      let status: InventoryDemandLine['status'] = 'calculated';
      const q = Number(req.quantity);

      switch (req.unit_basis as UnitBasis) {
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

      const source: InventoryDemandLineSource = {
        product_id: item.product_id,
        product_name: productName,
        proposal_item_id: item.id ?? null,
        quantity: pQty,
        required_quantity: required,
        calculation_label: calcLabel,
      };

      const existing = groups.get(key);
      if (existing) {
        if (existing.required_quantity != null && required != null) {
          existing.required_quantity += required;
        } else if (
          required != null &&
          existing.required_quantity == null &&
          existing.status !== 'manual'
        ) {
          existing.required_quantity = required;
        }
        existing.source_products.push(source);
        if (status === 'incomplete') existing.status = 'incomplete';
      } else {
        groups.set(key, {
          key,
          provider_type: req.provider_type,
          category_ref: req.category_ref,
          category_name: req.category_name,
          family_ref: req.family_ref,
          family_name: req.family_name,
          item_kind: req.item_kind,
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

  // Ordenação: required primeiro, depois family_name (estável).
  const lines = Array.from(groups.values()).sort((a, b) => {
    if (a.is_required !== b.is_required) return a.is_required ? -1 : 1;
    const cmp = a.family_name.localeCompare(b.family_name);
    if (cmp !== 0) return cmp;
    return a.key.localeCompare(b.key);
  });

  if (!hasAnyRequirement) {
    return {
      status: 'empty',
      provider_type: input.providerType,
      warnings,
      totals: { requiredFamilies: 0, totalRequiredUnits: 0, optionalFamilies: 0 },
      lines: [],
      payload: buildEmptyPayload(input, ctx),
    };
  }

  if (ctx.pointsAssumed && lines.some((l) => l.unit_basis === 'per_point')) {
    warnings.push('Quantidade de pontos não informada. Usando 1 como referência.');
  }
  if (ctx.daysAssumed && lines.some((l) => l.unit_basis === 'per_day')) {
    warnings.push('Quantidade de diárias não informada. Usando 1 como referência.');
  }
  if (hasParticipantMissing) {
    warnings.push(
      'Existem demandas por participante, mas a quantidade de participantes não foi informada.',
    );
  }

  const requiredFamilies = lines.filter((l) => l.is_required).length;
  const optionalFamilies = lines.filter((l) => !l.is_required).length;
  const totalRequiredUnits = lines.reduce(
    (acc, l) => acc + (l.required_quantity ?? 0),
    0,
  );

  const requirementsPayload: InventoryDemandRequirementPayload[] = lines.map((l) => ({
    provider_type: l.provider_type,
    category_ref: l.category_ref,
    category_name: l.category_name,
    family_ref: l.family_ref,
    family_name: l.family_name,
    item_kind: l.item_kind,
    quantity: l.required_quantity,
    unit_basis: l.unit_basis,
    is_required: l.is_required,
    source: {
      product_ids: Array.from(new Set(l.source_products.map((s) => s.product_id))),
      product_names: Array.from(new Set(l.source_products.map((s) => s.product_name))),
    },
  }));

  const payload: InventoryDemandPayload = {
    ...buildEmptyPayload(input, ctx),
    requirements: requirementsPayload,
  };

  return {
    status: hasIncomplete ? 'incomplete' : 'ready',
    provider_type: input.providerType,
    warnings,
    totals: { requiredFamilies, totalRequiredUnits, optionalFamilies },
    lines,
    payload,
  };
}
