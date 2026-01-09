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
  billing_type?: 'one_time' | 'recurring';
  counts_for_commission?: boolean;
  minimum_contract_months?: number;
  created_at?: string;
  updated_at?: string;
}

export async function listProposalItems(proposalId: string): Promise<ProposalItem[]> {
  const { data, error } = await supabase
    .from('proposal_items')
    .select('*')
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
    quantity: item.quantity,
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
  const quantity = item.quantity || 1;
  const discountPercent = item.discount_percent || 0;

  // CRITICAL: Always preserve unit_price - never recalculate from markup
  // unit_price comes directly from the product price and should be the source of truth
  const unitPrice = item.unit_price || 0;

  // Calculate total: (unit_price * quantity) * (1 - discount%)
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
}> {
  const items = await listProposalItems(proposalId);
  
  const subtotal = items.reduce((sum, item) => {
    const itemSubtotal = item.unit_price * item.quantity;
    return sum + itemSubtotal;
  }, 0);

  const total = items.reduce((sum, item) => sum + item.total, 0);
  
  // Calculate commission total - only items where counts_for_commission is true (default)
  const commissionTotal = items.reduce((sum, item) => {
    const countsForCommission = item.counts_for_commission ?? true;
    return sum + (countsForCommission ? item.total : 0);
  }, 0);

  return {
    subtotal: Number(subtotal.toFixed(2)),
    total: Number(total.toFixed(2)),
    commissionTotal: Number(commissionTotal.toFixed(2)),
  };
}
