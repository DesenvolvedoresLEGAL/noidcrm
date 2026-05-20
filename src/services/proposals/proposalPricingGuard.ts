// PRICE CORE 2.0C — Operational guard.
// Single entry point that every critical action (approve, generate
// charge/Pix, send to ERP, sync ERP) MUST call before proceeding.
//
// Internally it calls the `ensure_proposal_pricing_ready` RPC which
// recalculates the ledger and returns a blocked response when the
// proposal has any pricing divergence (zero effective, schedule mismatch,
// or `pricing_has_divergence = true`).

import { supabase } from '@/integrations/supabase/client';

export interface ProposalPricingReadiness {
  ok: boolean;
  blocked: boolean;
  reason?: string;
  message?: string;
  frozen?: boolean;
  effective_amount?: number;
  erp_amount?: number;
  approval_amount?: number;
  payment_schedule_total?: number;
  payment_schedule?: any[];
  has_divergence?: boolean;
  snapshot?: any;
  divergence_details?: any;
}

export class ProposalPricingDivergenceError extends Error {
  readonly reason: string;
  readonly readiness: ProposalPricingReadiness;
  constructor(readiness: ProposalPricingReadiness) {
    super(
      readiness.message ||
        'Não foi possível continuar. Existem valores divergentes nesta proposta. Recalcule a proposta antes de aprovar, cobrar ou enviar ao ERP.',
    );
    this.name = 'ProposalPricingDivergenceError';
    this.reason = readiness.reason || 'ledger_divergence';
    this.readiness = readiness;
  }
}

/**
 * Recalculates the ledger via RPC, validates pricing consistency and
 * returns the canonical readiness payload. Throws
 * `ProposalPricingDivergenceError` when the proposal cannot proceed.
 */
export async function ensureProposalPricingReady(
  proposalId: string,
): Promise<ProposalPricingReadiness> {
  const { data, error } = await (supabase as any).rpc(
    'ensure_proposal_pricing_ready',
    { p_proposal_id: proposalId },
  );
  if (error) {
    throw new Error(
      error.message ||
        'Falha ao validar valores da proposta. Tente novamente em instantes.',
    );
  }
  const readiness = (data ?? { ok: false, blocked: true }) as ProposalPricingReadiness;
  if (!readiness.ok) {
    throw new ProposalPricingDivergenceError(readiness);
  }
  return readiness;
}

/**
 * Manual recalculation triggered from UI (e.g. divergence-alert "Recalcular"
 * button). Returns the readiness payload without throwing; callers decide
 * how to surface divergence.
 */
export async function recalculateProposalLedger(
  proposalId: string,
): Promise<ProposalPricingReadiness> {
  const { data, error } = await (supabase as any).rpc(
    'ensure_proposal_pricing_ready',
    { p_proposal_id: proposalId },
  );
  if (error) {
    throw new Error(error.message || 'Falha ao recalcular valores da proposta.');
  }
  return (data ?? { ok: false, blocked: true }) as ProposalPricingReadiness;
}
