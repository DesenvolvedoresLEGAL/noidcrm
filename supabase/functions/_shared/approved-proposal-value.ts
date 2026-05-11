/**
 * Resolve the COMMERCIAL APPROVED VALUE of a proposal.
 *
 * Priority (the first non-null/positive wins):
 *   1. payment_expected_amount (set by orchestration when dynamic pricing applies)
 *   2. dynamic_pricing_current_amount, when dynamic_pricing_enabled = true and
 *      dynamic_pricing_status indicates an active commercial value
 *   3. dynamic_pricing_snapshot.current_amount (same conditions)
 *   4. total_amount (legacy net total of items + payment-term discount)
 *   5. value (very legacy fallback)
 *
 * This is the authoritative value used for Slack, in-app notifications,
 * ERP sync, and any "valor aprovado" surfaced to humans or external systems.
 */

export interface ProposalValueLike {
  total_amount?: number | string | null;
  value?: number | string | null;
  dynamic_pricing_enabled?: boolean | null;
  dynamic_pricing_status?: string | null;
  dynamic_pricing_current_amount?: number | string | null;
  dynamic_pricing_snapshot?: any;
  payment_expected_amount?: number | string | null;
}

export type ApprovedAmountSource =
  | "payment_expected_amount"
  | "dynamic_pricing_current_amount"
  | "dynamic_pricing_snapshot"
  | "total_amount"
  | "value"
  | "none";

export interface ApprovedAmountResult {
  amount: number;
  source: ApprovedAmountSource;
  base_amount: number;
  dynamic_amount: number | null;
  dynamic_enabled: boolean;
  dynamic_status: string | null;
  current_tier_id: string | null;
  current_tier_label: string | null;
  snapshot: any | null;
}

const ACTIVE_DYNAMIC_STATUSES = new Set([
  "active",
  "current",
  "vigente",
  "approved",
  "aprovado",
]);

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

function isActiveStatus(status?: string | null): boolean {
  if (!status) return true; // when null, assume the snapshot/current_amount is the live one
  return ACTIVE_DYNAMIC_STATUSES.has(String(status).toLowerCase());
}

export function resolveApprovedProposalAmount(
  proposal: ProposalValueLike,
): ApprovedAmountResult {
  const totalAmount = toNumber(proposal.total_amount) ?? 0;
  const legacyValue = toNumber(proposal.value) ?? 0;
  const baseAmount = totalAmount || legacyValue || 0;

  const snapshot = proposal.dynamic_pricing_snapshot ?? null;
  const dynEnabled = !!proposal.dynamic_pricing_enabled;
  const dynStatus = proposal.dynamic_pricing_status ?? null;
  const dynCurrent = toNumber(proposal.dynamic_pricing_current_amount);
  const snapshotCurrent =
    toNumber(snapshot?.current_amount) ?? null;
  const dynamicAmount =
    dynCurrent && dynCurrent > 0
      ? dynCurrent
      : snapshotCurrent && snapshotCurrent > 0
        ? snapshotCurrent
        : null;

  const expected = toNumber(proposal.payment_expected_amount);

  let amount = 0;
  let source: ApprovedAmountSource = "none";

  if (expected && expected > 0) {
    amount = expected;
    source = "payment_expected_amount";
  } else if (dynEnabled && isActiveStatus(dynStatus) && dynCurrent && dynCurrent > 0) {
    amount = dynCurrent;
    source = "dynamic_pricing_current_amount";
  } else if (
    dynEnabled &&
    isActiveStatus(dynStatus) &&
    snapshotCurrent &&
    snapshotCurrent > 0
  ) {
    amount = snapshotCurrent;
    source = "dynamic_pricing_snapshot";
  } else if (totalAmount > 0) {
    amount = totalAmount;
    source = "total_amount";
  } else if (legacyValue > 0) {
    amount = legacyValue;
    source = "value";
  }

  return {
    amount,
    source,
    base_amount: baseAmount,
    dynamic_amount: dynamicAmount,
    dynamic_enabled: dynEnabled,
    dynamic_status: dynStatus,
    current_tier_id: snapshot?.current_tier_id ?? null,
    current_tier_label: snapshot?.current_label ?? null,
    snapshot: snapshot ?? null,
  };
}

export const APPROVED_VALUE_SELECT_COLUMNS =
  "total_amount, value, dynamic_pricing_enabled, dynamic_pricing_status, dynamic_pricing_current_amount, dynamic_pricing_snapshot, payment_expected_amount";
