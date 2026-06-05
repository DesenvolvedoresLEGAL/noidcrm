// DYNAMIC PRICING AUTO-REFRESH — client wrappers
//
// Duas portas de entrada para a atualização da tabela dinâmica:
//
// 1) ensureProposalDynamicPricingCurrent(proposalId)
//    - Usada apenas em contextos AUTENTICADOS (editor interno, admin).
//    - Chama a RPC `ensure_proposal_dynamic_pricing_current(uuid)`,
//      que tem EXECUTE somente para authenticated/service_role.
//    - NUNCA deve ser usada no link público.
//
// 2) ensurePublicProposalDynamicPricingCurrent(publicToken)
//    - Usada exclusivamente no carregamento do link público
//      (`getProposalByToken`).
//    - Chama a RPC `ensure_public_proposal_dynamic_pricing_current(text)`,
//      que valida o token antes de delegar para a RPC interna.
//    - Visitantes anônimos não conseguem mais passar proposal_id diretamente.

import { supabase } from '@/integrations/supabase/client';

export interface EnsureDynamicPricingResult {
  proposal_id?: string;
  refreshed: boolean;
  current_amount?: number | null;
  current_tier_id?: string | null;
  current_tier_name?: string | null;
  current_tier_valid_until?: string | null;
  next_tier_amount?: number | null;
  next_tier_starts_at?: string | null;
  last_calculated_at?: string | null;
  source:
    | 'up_to_date'
    | 'reapplied'
    | 'frozen_or_closed'
    | 'no_active_rule'
    | 'not_found'
    | 'invalid_token'
    | 'no_result';
  warning: string | null;
  snapshot?: any;
}

/**
 * Authenticated/service_role only. Do NOT call from public link contexts.
 */
export async function ensureProposalDynamicPricingCurrent(
  proposalId: string,
): Promise<EnsureDynamicPricingResult | null> {
  if (!proposalId) return null;
  const { data, error } = await (supabase as any).rpc(
    'ensure_proposal_dynamic_pricing_current',
    { p_proposal_id: proposalId },
  );
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[ensureProposalDynamicPricingCurrent] error:', error.message);
    return null;
  }
  return data as EnsureDynamicPricingResult;
}

/**
 * Public link only. Token-gated wrapper — validates the token server-side
 * before delegating to the internal refresh RPC.
 */
export async function ensurePublicProposalDynamicPricingCurrent(
  publicToken: string,
): Promise<EnsureDynamicPricingResult | null> {
  if (!publicToken) return null;
  const { data, error } = await (supabase as any).rpc(
    'ensure_public_proposal_dynamic_pricing_current',
    { p_token: publicToken },
  );
  if (error) {
    // eslint-disable-next-line no-console
    console.warn(
      '[ensurePublicProposalDynamicPricingCurrent] error:',
      error.message,
    );
    return null;
  }
  return data as EnsureDynamicPricingResult;
}
