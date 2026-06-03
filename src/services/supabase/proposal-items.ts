import { supabase } from '@/integrations/supabase/client';

export interface ProposalItem {
  id?: string;
  proposal_id: string;
  organization_id?: string;
  product_id?: string;
  order_index: number;
  name: string;
  description?: string;
  quantity: number;
  unit_cost: number;
  markup_percent: number;
  unit_price: number;
  ipi_percent: number;
  discount_percent: number;
  total: number;
  image_url?: string;
  characteristics?: string[];
  measurement_unit_id?: string;
  billing_type?: 'one_time' | 'recurring' | 'point_day';
  counts_for_commission?: boolean;
  // Point-day fields
  quantity_points?: number;
  billing_days?: number;
  unit_price_point_day?: number;
  minimum_contract_months?: number;
  created_at?: string;
  updated_at?: string;
}

export async function listProposalItems(proposalId: string): Promise<ProposalItem[]> {
  const { data, error } = await supabase
    .from('proposal_items')
    .select('id, proposal_id, organization_id, product_id, order_index, name, description, quantity, unit_cost, markup_percent, unit_price, ipi_percent, discount_percent, total, image_url, characteristics, measurement_unit_id, billing_type, counts_for_commission, minimum_contract_months, quantity_points, billing_days, unit_price_point_day, created_at, updated_at, measurement_unit:measurement_units(id, name, abbreviation)')
    .eq('proposal_id', proposalId)
    .order('order_index', { ascending: true });

  if (error) throw error;
  return data as ProposalItem[];
}

export async function createProposalItem(item: Omit<ProposalItem, 'id' | 'created_at' | 'updated_at'>): Promise<ProposalItem> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');

  if (orgError || !orgId) {
    throw new Error('User must belong to an organization');
  }

  // Calculate totals
  const calculatedItem = calculateItemTotals(item);

  const itemToInsert = {
    proposal_id: item.proposal_id,
    organization_id: orgId,
    product_id: item.product_id,
    order_index: item.order_index,
    name: item.name,
    description: item.description,
    quantity: calculatedItem.quantity ?? item.quantity,
    unit_cost: item.unit_cost,
    markup_percent: item.markup_percent,
    unit_price: calculatedItem.unit_price || 0,
    ipi_percent: item.ipi_percent,
    discount_percent: item.discount_percent,
    total: calculatedItem.total || 0,
    image_url: item.image_url,
    characteristics: item.characteristics,
    measurement_unit_id: item.measurement_unit_id,
    billing_type: item.billing_type || 'one_time',
    counts_for_commission: item.counts_for_commission ?? true,
    quantity_points: item.billing_type === 'point_day' ? (calculatedItem.quantity_points ?? item.quantity_points ?? 1) : null,
    billing_days: item.billing_type === 'point_day' ? (calculatedItem.billing_days ?? item.billing_days ?? 1) : null,
    unit_price_point_day: item.billing_type === 'point_day' ? (calculatedItem.unit_price_point_day ?? item.unit_price_point_day ?? 0) : null,
  };

  const { data, error } = await supabase
    .from('proposal_items')
    .insert(itemToInsert)
    .select()
    .single();

  if (error) throw error;
  return data as ProposalItem;
}

export async function updateProposalItem(
  itemId: string, 
  updates: Partial<Omit<ProposalItem, 'id' | 'proposal_id' | 'organization_id'>>
): Promise<ProposalItem> {
  // Recalculate totals if any pricing field changed
  const calculatedUpdates = calculateItemTotals(updates as any);

  const { data, error } = await supabase
    .from('proposal_items')
    .update(calculatedUpdates)
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw error;
  return data as ProposalItem;
}

export async function deleteProposalItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('proposal_items')
    .delete()
    .eq('id', itemId);

  if (error) throw error;
}

export async function reorderProposalItems(proposalId: string, itemIds: string[]): Promise<void> {
  // Update order_index for each item
  const updates = itemIds.map((id, index) => ({
    id,
    order_index: index,
  }));

  for (const update of updates) {
    await supabase
      .from('proposal_items')
      .update({ order_index: update.order_index })
      .eq('id', update.id)
      .eq('proposal_id', proposalId);
  }
}

export function calculateItemTotals(item: Partial<ProposalItem>): Partial<ProposalItem> {
  const discountPercent = item.discount_percent || 0;

  // Point-day branch: total = points × days × price_per_point_day × (1 - discount%)
  if (item.billing_type === 'point_day') {
    const points = Math.max(1, Number(item.quantity_points || 1));
    const days = Math.max(1, Number(item.billing_days || 1));
    const ppd = Number(item.unit_price_point_day || item.unit_price || 0);
    const total = points * days * ppd * (1 - discountPercent / 100);
    return {
      ...item,
      quantity_points: points,
      billing_days: days,
      unit_price_point_day: Number(ppd.toFixed(2)),
      quantity: points * days,
      unit_price: Number(ppd.toFixed(2)),
      total: Number(total.toFixed(2)),
    };
  }

  const quantity = item.quantity || 1;
  // CRITICAL: Always preserve unit_price - never recalculate from markup
  const unitPrice = item.unit_price || 0;
  const subtotal = unitPrice * quantity;
  const total = subtotal * (1 - discountPercent / 100);

  return {
    ...item,
    unit_price: Number(unitPrice.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

export async function calculateProposalTotal(proposalId: string): Promise<{
  subtotal: number;
  total: number;
  commissionTotal: number;
  discountAmount: number;
}> {
  const items = await listProposalItems(proposalId);
  
  // Fetch payment terms discount_percent
  const { data: paymentTerms } = await supabase
    .from('proposal_payment_terms')
    .select('discount_percent, payment_type')
    .eq('proposal_id', proposalId)
    .eq('payment_type', 'one_time');

  const paymentDiscountPercent = (paymentTerms || []).reduce(
    (max, term) => Math.max(max, Number(term.discount_percent) || 0),
    0,
  );

  const subtotal = items.reduce((sum, item) => {
    const itemSubtotal = item.unit_price * item.quantity;
    return sum + itemSubtotal;
  }, 0);

  // Item-level totals (already include item-level discounts)
  const itemsTotal = items.reduce((sum, item) => sum + item.total, 0);
  
  // Separate one_time vs recurring for payment discount application
  // Payment term discount applies only to one_time items (recurring have their own billing)
  let oneTimeTotal = 0;
  let recurringTotal = 0;
  let oneTimeCommission = 0;
  let recurringCommission = 0;

  for (const item of items) {
    const countsForCommission = item.counts_for_commission ?? true;
    if (item.billing_type === 'recurring') {
      recurringTotal += item.total;
      if (countsForCommission) recurringCommission += item.total;
    } else {
      oneTimeTotal += item.total;
      if (countsForCommission) oneTimeCommission += item.total;
    }
  }

  // Apply payment discount to one_time items only
  const discountAmount = paymentDiscountPercent > 0
    ? oneTimeTotal * (paymentDiscountPercent / 100)
    : 0;

  const total = oneTimeTotal - discountAmount + recurringTotal;
  
  // Commission also gets the discount applied proportionally to one_time commissionable items
  const commissionDiscount = paymentDiscountPercent > 0
    ? oneTimeCommission * (paymentDiscountPercent / 100)
    : 0;
  const commissionTotal = oneTimeCommission - commissionDiscount + recurringCommission;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    total: Number(total.toFixed(2)),
    commissionTotal: Number(commissionTotal.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
  };
}
