import { supabase } from '@/integrations/supabase/client';
import type {
  AdjustmentType,
  DynamicPricingRuleInput,
  DynamicPricingSnapshot,
  DynamicPricingTierInput,
} from '@/lib/proposals/dynamicPricing';

export interface DynamicPricingRule {
  id: string;
  organization_id: string;
  proposal_id: string;
  enabled: boolean;
  base_amount: number;
  currency: string;
  status: string;
  current_tier_id: string | null;
  current_amount: number | null;
  next_tier_id: string | null;
  next_amount: number | null;
  last_calculated_at: string | null;
  notes: string | null;
  pricing_mode: 'manual' | 'event_antecedence';
  event_start_date: string | null;
  auto_generated: boolean;
  show_expired_tiers: boolean;
  post_event_policy: 'surcharge' | 'requires_requote' | 'block_payment';
  created_at: string;
  updated_at: string;
}

export interface DynamicPricingTier {
  id: string;
  organization_id: string;
  proposal_id: string;
  pricing_rule_id: string;
  tier_order: number;
  label: string;
  starts_at: string | null;
  ends_at: string | null;
  adjustment_type: AdjustmentType;
  adjustment_value: number;
  final_amount: number;
  is_current: boolean;
  is_expired: boolean;
}

export interface DynamicPricingEvent {
  id: string;
  proposal_id: string;
  pricing_rule_id: string | null;
  pricing_tier_id: string | null;
  event_type: string;
  previous_amount: number | null;
  new_amount: number | null;
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const c = supabase as any;

async function currentOrgId(): Promise<string> {
  const { data, error } = await supabase.rpc('get_user_organization_id' as any);
  if (error) throw error;
  if (!data) throw new Error('Organização não encontrada');
  return data as unknown as string;
}

export async function getDynamicPricing(proposalId: string): Promise<{
  rule: DynamicPricingRule | null;
  tiers: DynamicPricingTier[];
}> {
  const { data: rule, error: e1 } = await c
    .from('proposal_dynamic_pricing_rules')
    .select('*')
    .eq('proposal_id', proposalId)
    .maybeSingle();
  if (e1) throw e1;
  if (!rule) return { rule: null, tiers: [] };

  const { data: tiers, error: e2 } = await c
    .from('proposal_dynamic_pricing_tiers')
    .select('*')
    .eq('pricing_rule_id', rule.id)
    .order('tier_order', { ascending: true });
  if (e2) throw e2;

  return { rule: rule as DynamicPricingRule, tiers: (tiers ?? []) as DynamicPricingTier[] };
}

export async function saveDynamicPricingRule(
  proposalId: string,
  payload: DynamicPricingRuleInput,
): Promise<{ rule: DynamicPricingRule; tiers: DynamicPricingTier[] }> {
  const org = await currentOrgId();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id ?? null;

  // Upsert rule
  const { data: existing } = await c
    .from('proposal_dynamic_pricing_rules')
    .select('id')
    .eq('proposal_id', proposalId)
    .maybeSingle();

  let ruleId: string;
  if (existing?.id) {
    const { data, error } = await c
      .from('proposal_dynamic_pricing_rules')
      .update({
        enabled: payload.enabled,
        base_amount: payload.base_amount,
        currency: payload.currency,
        notes: payload.notes ?? null,
        updated_by: userId,
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    ruleId = data.id;
  } else {
    const { data, error } = await c
      .from('proposal_dynamic_pricing_rules')
      .insert({
        organization_id: org,
        proposal_id: proposalId,
        enabled: payload.enabled,
        base_amount: payload.base_amount,
        currency: payload.currency,
        notes: payload.notes ?? null,
        created_by: userId,
        updated_by: userId,
      })
      .select('*')
      .single();
    if (error) throw error;
    ruleId = data.id;

    await c.from('proposal_dynamic_pricing_events').insert({
      organization_id: org,
      proposal_id: proposalId,
      pricing_rule_id: ruleId,
      event_type: 'created',
      message: 'Tabela dinâmica criada',
    });
  }

  // Replace tiers (delete + reinsert)
  await c.from('proposal_dynamic_pricing_tiers').delete().eq('pricing_rule_id', ruleId);

  if (payload.tiers.length > 0) {
    const rows = payload.tiers.map((t, idx) => ({
      organization_id: org,
      proposal_id: proposalId,
      pricing_rule_id: ruleId,
      tier_order: t.tier_order ?? idx,
      label: t.label,
      starts_at: t.starts_at || null,
      ends_at: t.ends_at || null,
      adjustment_type: t.adjustment_type,
      adjustment_value: t.adjustment_value,
    }));
    const { error: insErr } = await c.from('proposal_dynamic_pricing_tiers').insert(rows);
    if (insErr) throw insErr;
  }

  // Recalculate
  await calculateDynamicPrice(proposalId);

  return getDynamicPricing(proposalId).then(({ rule, tiers }) => ({
    rule: rule as DynamicPricingRule,
    tiers,
  }));
}

export async function calculateDynamicPrice(
  proposalId: string,
  referenceAt?: string,
): Promise<DynamicPricingSnapshot> {
  const { data, error } = await c.rpc('calculate_proposal_dynamic_price', {
    p_proposal_id: proposalId,
    // Quando undefined, o backend resolve via condição financeira (PRICE UX 1.0.4)
    p_reference_at: referenceAt ?? null,
  });
  if (error) throw error;
  return data as DynamicPricingSnapshot;
}

export async function applyDynamicPrice(
  proposalId: string,
  referenceAt?: string,
): Promise<DynamicPricingSnapshot> {
  const { data, error } = await c.rpc('apply_dynamic_price_to_proposal', {
    p_proposal_id: proposalId,
    p_reference_at: referenceAt ?? null,
  });
  if (error) throw error;
  return data as DynamicPricingSnapshot;
}

/** PRICE UX 1.0.4 — devolve a data de referência comercial resolvida do backend */
export async function resolveDynamicPricingReference(
  proposalId: string,
): Promise<{ reference_type: string; reference_at: string } | null> {
  const { data, error } = await c.rpc('resolve_dynamic_pricing_reference_date', {
    p_proposal_id: proposalId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row
    ? { reference_type: row.reference_type, reference_at: row.reference_at }
    : null;
}

export async function listDynamicPricingEvents(
  proposalId: string,
  limit = 20,
): Promise<DynamicPricingEvent[]> {
  const { data, error } = await c
    .from('proposal_dynamic_pricing_events')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DynamicPricingEvent[];
}

export async function disableDynamicPricing(proposalId: string) {
  const { data: rule } = await c
    .from('proposal_dynamic_pricing_rules')
    .select('id, organization_id')
    .eq('proposal_id', proposalId)
    .maybeSingle();
  if (!rule?.id) return;

  await c
    .from('proposal_dynamic_pricing_rules')
    .update({ enabled: false, status: 'disabled' })
    .eq('id', rule.id);

  await c.from('proposal_dynamic_pricing_events').insert({
    organization_id: rule.organization_id,
    proposal_id: proposalId,
    pricing_rule_id: rule.id,
    event_type: 'disabled',
    message: 'Tabela dinâmica desativada',
  });

  await c
    .from('proposals')
    .update({ dynamic_pricing_enabled: false, dynamic_pricing_status: 'disabled' })
    .eq('id', proposalId);
}

export type { DynamicPricingTierInput };

// ===== PRICE 1.0.1 =====

export interface PricingFactorRule {
  id: string;
  organization_id: string;
  name: string;
  label: string;
  min_days_before_event: number | null;
  max_days_before_event: number | null;
  adjustment_type: 'percent' | 'fixed';
  adjustment_value: number;
  sort_order: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export async function generateEventAntecedencePricing(
  proposalId: string,
  forceRegenerate = false,
): Promise<any> {
  const { data, error } = await c.rpc('generate_event_antecedence_pricing_for_proposal', {
    p_proposal_id: proposalId,
    p_force_regenerate: forceRegenerate,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.message ?? data.error);
  return data;
}

export async function listFactorRules(): Promise<PricingFactorRule[]> {
  const { data, error } = await c
    .from('proposal_dynamic_pricing_factor_rules')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PricingFactorRule[];
}

export async function upsertFactorRule(
  payload: Partial<PricingFactorRule> & { id?: string },
): Promise<PricingFactorRule> {
  const org = await currentOrgId();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id ?? null;

  if (payload.id) {
    const { data, error } = await c
      .from('proposal_dynamic_pricing_factor_rules')
      .update({
        name: payload.name,
        label: payload.label,
        min_days_before_event: payload.min_days_before_event ?? null,
        max_days_before_event: payload.max_days_before_event ?? null,
        adjustment_type: payload.adjustment_type ?? 'percent',
        adjustment_value: payload.adjustment_value ?? 0,
        sort_order: payload.sort_order ?? 0,
        status: payload.status ?? 'active',
        updated_by: userId,
      })
      .eq('id', payload.id)
      .select('*')
      .single();
    if (error) throw error;
    return data as PricingFactorRule;
  }
  const { data, error } = await c
    .from('proposal_dynamic_pricing_factor_rules')
    .insert({
      organization_id: org,
      name: payload.name,
      label: payload.label,
      min_days_before_event: payload.min_days_before_event ?? null,
      max_days_before_event: payload.max_days_before_event ?? null,
      adjustment_type: payload.adjustment_type ?? 'percent',
      adjustment_value: payload.adjustment_value ?? 0,
      sort_order: payload.sort_order ?? 0,
      status: payload.status ?? 'active',
      created_by: userId,
      updated_by: userId,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as PricingFactorRule;
}

export async function setFactorRuleStatus(
  id: string,
  status: 'active' | 'inactive',
): Promise<void> {
  const { error } = await c
    .from('proposal_dynamic_pricing_factor_rules')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}
