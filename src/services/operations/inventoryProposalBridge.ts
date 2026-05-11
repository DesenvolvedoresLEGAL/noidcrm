import { supabase } from '@/integrations/supabase/client';
import {
  computeOperationalPeriod,
  type PreReservationItemType,
} from '@/lib/operations/inventoryPreReservations';
import {
  createPreReservation,
  type CreatePreReservationPayload,
} from './inventoryPreReservations';

interface GeneratePreReservationFromProposalInput {
  organization_id: string;
  proposal_id: string;
  user_id?: string | null;
  event_start_date: string;
  event_end_date: string;
  notes?: string | null;
}

interface ProductInventoryConfig {
  inventory_control_mode:
    | 'none'
    | 'direct_quantity_item'
    | 'direct_serialized_item'
    | 'category_family_demand';
  default_inventory_item_type: PreReservationItemType | null;
  default_serialized_item_id: string | null;
  default_quantity_item_id: string | null;
  default_inventory_category_id: string | null;
  default_inventory_family_id: string | null;
  inventory_quantity_multiplier: number;
  inventory_demand_rules?: Array<{
    category_id?: string | null;
    family_id?: string | null;
    category_slug?: string | null;
    family_slug?: string | null;
    quantity_multiplier?: number;
    required?: boolean;
    label?: string | null;
  }> | null;
}

export async function generatePreReservationFromProposal(
  input: GeneratePreReservationFromProposalInput,
) {
  const { data: proposal, error: pErr } = await supabase
    .from('proposals')
    .select(
      'id, title, opportunity_id, client_name, organization_id, opportunities(id, account_id, contact_id)',
    )
    .eq('id', input.proposal_id)
    .single();
  if (pErr) throw pErr;

  const { data: items, error: iErr } = await supabase
    .from('proposal_items')
    .select('id, name, quantity, product_id, billing_type, quantity_points')
    .eq('proposal_id', input.proposal_id);
  if (iErr) throw iErr;

  const productIds = Array.from(
    new Set((items ?? []).map((it) => it.product_id).filter(Boolean) as string[]),
  );

  let productMap = new Map<string, ProductInventoryConfig>();
  if (productIds.length > 0) {
    const { data: products, error: prErr } = await supabase
      .from('products')
      .select(
        'id, inventory_control_mode, default_inventory_item_type, default_serialized_item_id, default_quantity_item_id, default_inventory_category_id, default_inventory_family_id, inventory_quantity_multiplier, inventory_demand_rules',
      )
      .in('id', productIds);
    if (prErr) throw prErr;
    productMap = new Map(
      ((products ?? []) as any[]).map((p) => [p.id, p as ProductInventoryConfig]),
    );
  }

  // Load BOM rows for any referenced product (used for point_day expansion).
  const bomMap = new Map<string, Array<{
    component_product_id: string | null;
    inventory_category_id: string | null;
    inventory_family_id: string | null;
    quantity_per_point: number;
    label: string | null;
  }>>();
  if (productIds.length > 0) {
    const { data: bomRows } = await (supabase as any)
      .from('product_bom_items')
      .select('product_id, component_product_id, inventory_category_id, inventory_family_id, quantity_per_point, label')
      .in('product_id', productIds);
    for (const row of (bomRows ?? []) as any[]) {
      const arr = bomMap.get(row.product_id) ?? [];
      arr.push(row);
      bomMap.set(row.product_id, arr);
    }
  }

  const period = computeOperationalPeriod(input.event_start_date, input.event_end_date);

  const reservationItems: CreatePreReservationPayload['items'] = [];
  for (const it of items ?? []) {
    const cfg = it.product_id ? productMap.get(it.product_id) : undefined;
    if (!cfg || cfg.inventory_control_mode === 'none') continue;
    // For point_day items, physical reservation is per POINT (not points × days).
    const physicalQty =
      (it as any).billing_type === 'point_day'
        ? Number((it as any).quantity_points ?? 1)
        : Number(it.quantity ?? 1);
    const baseQty = physicalQty * Number(cfg.inventory_quantity_multiplier ?? 1);

    // 0) point_day com BOM: expandir reserva pelos componentes da composição técnica.
    const bom = it.product_id ? bomMap.get(it.product_id) : undefined;
    if ((it as any).billing_type === 'point_day' && bom && bom.length > 0) {
      for (const comp of bom) {
        const qty = physicalQty * Number(comp.quantity_per_point ?? 1);
        if (!qty) continue;
        reservationItems.push({
          inventory_item_type: 'category_family_demand',
          category_id: comp.inventory_category_id ?? cfg.default_inventory_category_id ?? null,
          family_id: comp.inventory_family_id ?? cfg.default_inventory_family_id ?? null,
          requested_quantity: qty,
          demand_label: comp.label ?? `${it.name} — componente`,
          demand_source: 'product_bom',
          product_id: comp.component_product_id ?? it.product_id ?? null,
          proposal_item_id: it.id,
          notes: it.name,
        });
      }
      continue;
    }

    // 1) Regras de demanda compostas (kits lógicos) têm prioridade.
    const rules = Array.isArray(cfg.inventory_demand_rules)
      ? cfg.inventory_demand_rules
      : [];
    if (rules.length > 0) {
      for (const rule of rules) {
        const ruleQty = baseQty * Number(rule.quantity_multiplier ?? 1);
        if (!ruleQty) continue;
        reservationItems.push({
          inventory_item_type: 'category_family_demand',
          category_id: rule.category_id ?? cfg.default_inventory_category_id ?? null,
          family_id: rule.family_id ?? cfg.default_inventory_family_id ?? null,
          requested_quantity: ruleQty,
          demand_label: rule.label ?? `${it.name}`,
          demand_source: 'product_rule',
          product_id: it.product_id ?? null,
          proposal_item_id: it.id,
          notes: it.name,
        });
      }
      continue;
    }

    if (cfg.inventory_control_mode === 'direct_serialized_item' && cfg.default_serialized_item_id) {
      reservationItems.push({
        inventory_item_type: 'serialized',
        serialized_item_id: cfg.default_serialized_item_id,
        category_id: cfg.default_inventory_category_id,
        family_id: cfg.default_inventory_family_id,
        requested_quantity: 1,
        demand_source: 'proposal_item',
        product_id: it.product_id ?? null,
        proposal_item_id: it.id,
        notes: it.name,
      });
    } else if (
      cfg.inventory_control_mode === 'direct_quantity_item' &&
      cfg.default_quantity_item_id
    ) {
      reservationItems.push({
        inventory_item_type: 'quantity',
        quantity_item_id: cfg.default_quantity_item_id,
        category_id: cfg.default_inventory_category_id,
        family_id: cfg.default_inventory_family_id,
        requested_quantity: baseQty,
        demand_source: 'proposal_item',
        product_id: it.product_id ?? null,
        proposal_item_id: it.id,
        notes: it.name,
      });
    } else if (cfg.inventory_control_mode === 'category_family_demand') {
      reservationItems.push({
        inventory_item_type: 'category_family_demand',
        category_id: cfg.default_inventory_category_id,
        family_id: cfg.default_inventory_family_id,
        requested_quantity: baseQty,
        demand_label: it.name,
        demand_source: 'proposal_item',
        product_id: it.product_id ?? null,
        proposal_item_id: it.id,
        notes: it.name,
      });
    }
  }

  const opportunity = (proposal as any).opportunities;

  return createPreReservation({
    organization_id: input.organization_id,
    user_id: input.user_id,
    title:
      (proposal as any).title ||
      `Pré reserva proposta ${(proposal as any).client_name ?? ''}`.trim(),
    source: 'proposal',
    proposal_id: input.proposal_id,
    opportunity_id: (proposal as any).opportunity_id ?? null,
    account_id: opportunity?.account_id ?? null,
    contact_id: opportunity?.contact_id ?? null,
    operational_start_date: period.operational_start_date,
    operational_end_date: period.operational_end_date,
    event_start_date: input.event_start_date,
    event_end_date: input.event_end_date,
    notes: input.notes ?? null,
    items: reservationItems,
  });
}
