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
}

export async function generatePreReservationFromProposal(
  input: GeneratePreReservationFromProposalInput,
) {
  const { data: proposal, error: pErr } = await supabase
    .from('proposals')
    .select(
      'id, title, opportunity_id, client_name, organization_id, opportunities(id, account_id, primary_contact_id)',
    )
    .eq('id', input.proposal_id)
    .single();
  if (pErr) throw pErr;

  const { data: items, error: iErr } = await supabase
    .from('proposal_items')
    .select('id, name, quantity, product_id')
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
        'id, inventory_control_mode, default_inventory_item_type, default_serialized_item_id, default_quantity_item_id, default_inventory_category_id, default_inventory_family_id, inventory_quantity_multiplier',
      )
      .in('id', productIds);
    if (prErr) throw prErr;
    productMap = new Map(
      ((products ?? []) as any[]).map((p) => [p.id, p as ProductInventoryConfig]),
    );
  }

  const period = computeOperationalPeriod(input.event_start_date, input.event_end_date);

  const reservationItems: CreatePreReservationPayload['items'] = [];
  for (const it of items ?? []) {
    const cfg = it.product_id ? productMap.get(it.product_id) : undefined;
    if (!cfg || cfg.inventory_control_mode === 'none') continue;
    const qty = Number(it.quantity ?? 1) * Number(cfg.inventory_quantity_multiplier ?? 1);

    if (cfg.inventory_control_mode === 'direct_serialized_item' && cfg.default_serialized_item_id) {
      reservationItems.push({
        inventory_item_type: 'serialized',
        serialized_item_id: cfg.default_serialized_item_id,
        category_id: cfg.default_inventory_category_id,
        family_id: cfg.default_inventory_family_id,
        requested_quantity: 1,
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
        requested_quantity: qty,
        notes: it.name,
      });
    } else if (cfg.inventory_control_mode === 'category_family_demand') {
      reservationItems.push({
        inventory_item_type: 'sku',
        category_id: cfg.default_inventory_category_id,
        family_id: cfg.default_inventory_family_id,
        requested_quantity: qty,
        notes: `${it.name} (demanda não alocada)`,
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
    contact_id: opportunity?.primary_contact_id ?? null,
    operational_start_date: period.operational_start_date,
    operational_end_date: period.operational_end_date,
    event_start_date: input.event_start_date,
    event_end_date: input.event_end_date,
    notes: input.notes ?? null,
    items: reservationItems,
  });
}
