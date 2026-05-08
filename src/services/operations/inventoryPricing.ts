import { supabase } from '@/integrations/supabase/client';
import {
  type InventoryPricingFactorPayload,
  type InventoryPricingFactorResult,
  type InventoryPricingRuleInput,
} from '@/lib/operations/inventoryPricing';

export interface InventoryPricingRule {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  family_id: string | null;
  min_occupancy_rate: number;
  max_occupancy_rate: number | null;
  price_adjustment_type: 'percent' | 'fixed';
  price_adjustment_value: number;
  max_discount_percent: number | null;
  requires_approval: boolean;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export async function listPricingRules(): Promise<InventoryPricingRule[]> {
  const { data, error } = await (supabase as any)
    .from('inventory_pricing_rules')
    .select('*')
    .order('min_occupancy_rate', { ascending: true });
  if (error) throw error;
  return (data ?? []) as InventoryPricingRule[];
}

async function currentOrgId(): Promise<string> {
  const { data, error } = await supabase.rpc('get_user_organization_id' as any);
  if (error) throw error;
  if (!data) throw new Error('Organização não encontrada');
  return data as unknown as string;
}

export async function createPricingRule(
  input: InventoryPricingRuleInput,
): Promise<InventoryPricingRule> {
  const org = await currentOrgId();
  const { data: userRes } = await supabase.auth.getUser();
  const { data, error } = await (supabase as any)
    .from('inventory_pricing_rules')
    .insert({
      ...input,
      organization_id: org,
      created_by: userRes.user?.id ?? null,
      updated_by: userRes.user?.id ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as InventoryPricingRule;
}

export async function updatePricingRule(
  id: string,
  patch: Partial<InventoryPricingRuleInput>,
): Promise<InventoryPricingRule> {
  const { data: userRes } = await supabase.auth.getUser();
  const { data, error } = await (supabase as any)
    .from('inventory_pricing_rules')
    .update({ ...patch, updated_by: userRes.user?.id ?? null })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as InventoryPricingRule;
}

export async function deactivatePricingRule(id: string) {
  return updatePricingRule(id, { status: 'inactive' } as any);
}

export async function activatePricingRule(id: string) {
  return updatePricingRule(id, { status: 'active' } as any);
}

export async function calculatePricingFactor(
  payload: InventoryPricingFactorPayload,
): Promise<InventoryPricingFactorResult> {
  const { data, error } = await (supabase.rpc as any)(
    'calculate_inventory_pricing_factor',
    {
      p_start_date: payload.start_date,
      p_end_date: payload.end_date,
      p_category_id: payload.category_id ?? null,
      p_family_id: payload.family_id ?? null,
      p_requested_quantity: payload.requested_quantity,
      p_base_amount: payload.base_amount,
    },
  );
  if (error) throw error;
  return data as InventoryPricingFactorResult;
}

export async function getPricingPressure(windowDays = 30) {
  const { data, error } = await (supabase.rpc as any)(
    'get_inventory_pricing_pressure',
    { p_window_days: windowDays },
  );
  if (error) throw error;
  return data as {
    avg_occupancy_next_7_days: number;
    avg_occupancy_window_days: number;
    window_days: number;
    categories_with_factor: number;
    protected_revenue: number;
    proposals_with_critical_discount: number;
    computed_at: string;
  };
}
