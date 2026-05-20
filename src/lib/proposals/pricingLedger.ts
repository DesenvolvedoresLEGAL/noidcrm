// PRICE CORE 2.0 — Phase 2.0B
// Read-only helper that returns a normalized pricing summary from the
// proposal's pricing_breakdown_snapshot (ledger).
//
// NEVER recalculates. The ledger is computed server-side via
// `recalculate_proposal_pricing_ledger(proposal_id)`. This helper only
// reads what is already persisted.
//
// When the snapshot is missing (legacy proposal not yet recalculated),
// returns `null` so callers can fall back to their previous logic.

export type ManualDiscountSource = 'payment_terms' | 'proposals.discount_amount' | 'none';

export interface ProposalPricingSummary {
  hasLedger: true;
  subtotalItems: number;
  recurringSubtotal: number;
  inventoryAdjustmentAmount: number;
  manualDiscount: {
    percent: number;
    amount: number;
    source: ManualDiscountSource;
  };
  baseAmount: number;
  dynamicAdjustment: {
    enabled: boolean;
    percent: number;
    amount: number;
    tierLabel: string | null;
    tierEndsAt: string | null;
  };
  effectiveAmount: number;
  paymentScheduleTotal: number;
  paymentSchedule: Array<{
    index: number;
    label: string;
    due_date: string;
    amount: number;
  }>;
  erpAmount: number;
  approvalAmount: number;
  hasDivergence: boolean;
  frozen: boolean;
  calculatedAt: string | null;
  warnings: string[];
  raw: any;
}

function num(v: any, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Reads pricing_breakdown_snapshot from a proposal and returns a normalized
 * summary. Returns null when no usable snapshot exists.
 */
export function getProposalPricingSummary(
  proposal: any | null | undefined,
): ProposalPricingSummary | null {
  if (!proposal) return null;
  const snap = proposal.pricing_breakdown_snapshot;
  if (!snap || typeof snap !== 'object') return null;
  // Empty {} or no version
  if (!snap.version || snap.effective_amount == null) return null;

  const md = snap.manual_discount ?? {};
  const dyn = snap.dynamic_adjustment ?? {};

  return {
    hasLedger: true,
    subtotalItems: num(snap.subtotal_items),
    recurringSubtotal: num(snap.recurring_subtotal),
    inventoryAdjustmentAmount: num(snap.inventory_adjustment_amount),
    manualDiscount: {
      percent: num(md.percent),
      amount: num(md.amount),
      source: (md.source ?? 'none') as ManualDiscountSource,
    },
    baseAmount: num(snap.base_amount),
    dynamicAdjustment: {
      enabled: !!dyn.enabled,
      percent: num(dyn.percent),
      amount: num(dyn.amount),
      tierLabel: dyn.tier_label ?? null,
      tierEndsAt: dyn.tier_ends_at ?? null,
    },
    effectiveAmount: num(snap.effective_amount),
    paymentScheduleTotal: num(snap.payment_schedule_total),
    paymentSchedule: Array.isArray(snap.payment_schedule) ? snap.payment_schedule : [],
    erpAmount: num(snap.erp_amount),
    approvalAmount: num(snap.approval_amount),
    hasDivergence: !!snap.has_divergence,
    frozen: !!snap.frozen,
    calculatedAt: snap.calculated_at ?? null,
    warnings: Array.isArray(snap.warnings) ? snap.warnings : [],
    raw: snap,
  };
}

export function formatLedgerBRL(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
}

const _warnedProposals = new Set<string>();

/**
 * In DEV, logs a one-time warning when an active (non-cancelled) proposal
 * does not have a usable pricing_breakdown_snapshot. Helps detect legacy
 * proposals still reading from total_amount instead of the ledger.
 */
export function warnIfLedgerMissing(proposal: any, where: string): void {
  if (!proposal || typeof proposal !== 'object') return;
  if (!(import.meta as any).env?.DEV) return;
  const status = proposal.status;
  if (status === 'cancelled' || status === 'declined') return;
  if (getProposalPricingSummary(proposal)) return;
  const key = `${proposal.id}:${where}`;
  if (_warnedProposals.has(key)) return;
  _warnedProposals.add(key);
  // eslint-disable-next-line no-console
  console.warn(
    `[PRICE CORE 2.0B] Proposta ${proposal.id} (${status}) sem pricing_breakdown_snapshot em ${where}. Recalcule o ledger.`,
  );
}
