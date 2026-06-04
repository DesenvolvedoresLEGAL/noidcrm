// DYNAMIC PRICING AUTO-REFRESH — client wrapper
// Calls the SECURITY DEFINER RPC `ensure_proposal_dynamic_pricing_current`.
// Idempotent: returns refreshed=false when the persisted snapshot already
// matches the tier vigente in server now(). Safe for anon (public link).

import { supabase } from '@/integrations/supabase/client';

export interface EnsureDynamicPricingResult {
  proposal_id: string;
  refreshed: boolean;
  current_amount: number | null;
  current_tier_id: string | null;
  current_tier_name: string | null;
  current_tier_valid_until: string | null;
  next_tier_amount: number | null;
  next_tier_starts_at: string | null;
  last_calculated_at: string | null;
  source:
    | 'up_to_date'
    | 'reapplied'
    | 'frozen_or_closed'
    | 'no_active_rule'
    | 'not_found';
  warning: string | null;
  snapshot?: any;
}

export async function ensureProposalDynamicPricingCurrent(
  proposalId: string,
): Promise<EnsureDynamicPricingResult | null> {
  if (!proposalId) return null;
  const { data, error } = await (supabase as any).rpc(
    'ensure_proposal_dynamic_pricing_current',
    { p_proposal_id: proposalId },
  );
  if (error) {
    // Non-blocking: surface a warning instead of throwing — UI must still render.
    // eslint-disable-next-line no-console
    console.warn('[ensureProposalDynamicPricingCurrent] error:', error.message);
    return null;
  }
  return data as EnsureDynamicPricingResult;
}
