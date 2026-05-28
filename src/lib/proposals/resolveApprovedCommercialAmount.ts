/**
 * Fonte única do valor comercial aprovado — versão composição comercial.
 *
 * Premissa: `proposals.approved_amount` (coluna) pode ter sido sobrescrita
 * por orchestrators que reaplicam dynamic pricing por cima do líquido aprovado.
 * `approval_snapshot` é imutável e geralmente reflete o aceite. Mas em casos
 * onde o snapshot foi gravado *antes* de o desconto manual entrar (ex.: OGGI),
 * o snapshot fica bruto e a coluna fica correta.
 *
 * Por isso, em vez de eleger fonte cega, validamos COMPOSIÇÃO COMERCIAL:
 *   - snap == (base − desconto manual) → snapshot já é líquido pós-desconto.
 *   - column == (snap − desconto manual) → snapshot era bruto; column é líquido.
 *   - column ≈ snap × {1.10, 1.20, 1.25, 1.30, 1.50} → column foi contaminado
 *     por reaplicação de dynamic pricing pós-aprovação; snapshot vence.
 *   - snap == base (sem desconto, sem ajuste) e column inflado → snap vence.
 *   - consenso (snap == column) → ok.
 *   - nenhuma composição explica → needs_manual_review, snap vence (mais seguro
 *     porque é imutável e histórico, mas marcamos para auditoria).
 *
 * Não recalcula proposta, não toca em snapshot, não altera ERP/Pix/PDF/Slack.
 */

export type ApprovedAmountSource =
  | 'approval_snapshot+column_consensus'
  | 'approval_snapshot.payment_expected_amount'
  | 'approval_snapshot.approved_amount'
  | 'approved_amount_column'
  | 'approved_payment_schedule'
  | 'pricing_ledger'
  | 'opportunity_value_legacy'
  | 'zero';

export type ApprovedAmountWarning =
  | 'approved_amount_column_mismatch'
  | 'approval_snapshot_may_be_gross_before_discount'
  | 'approved_amount_column_contaminated_after_approval'
  | 'needs_manual_review_amount_conflict';

export interface ResolveApprovedAmountInput {
  opportunity?: {
    accepted_proposal_id?: string | null;
    valor_previsto?: number | null;
  } | null;
  proposal?: {
    id?: string;
    approved_amount?: number | null;
    approved_payment_schedule?: any;
    approval_snapshot?: any;
    total_amount?: number | null;
    discount_amount?: number | null;
    pricing_manual_discount_amount?: number | null;
    pricing_manual_discount_percent?: number | null;
    value?: number | null;
  } | null;
}

export interface ResolveApprovedAmountResult {
  approved_commercial_amount: number;
  source: ApprovedAmountSource;
  warnings: ApprovedAmountWarning[];
  is_final_approved_value: boolean;
  review_required: boolean;
}

const TOL = 0.5; // tolerância de composição em BRL
const CONSENSUS_TOL = 0.02;
const KNOWN_CONTAMINATION_MULTIPLIERS = [1.1, 1.2, 1.25, 1.3, 1.5];

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? Number(n) : null;
}

function sumSchedule(schedule: any): number | null {
  if (!schedule) return null;
  const arr = Array.isArray(schedule)
    ? schedule
    : Array.isArray(schedule?.installments)
      ? schedule.installments
      : null;
  if (!arr || arr.length === 0) return null;
  let total = 0;
  let touched = false;
  for (const item of arr) {
    const amount = toNumber(item?.amount ?? item?.value ?? item?.net ?? item?.total);
    if (amount != null) {
      total += amount;
      touched = true;
    }
  }
  return touched ? total : null;
}

function snapshotNetAmount(snapshot: any): { value: number | null; field: 'payment_expected_amount' | 'approved_amount' | null } {
  if (!snapshot || typeof snapshot !== 'object') return { value: null, field: null };
  const pe = toNumber(snapshot.payment_expected_amount);
  if (pe != null && pe > 0) return { value: pe, field: 'payment_expected_amount' };
  const ap = toNumber(snapshot.approved_amount);
  if (ap != null && ap > 0) return { value: ap, field: 'approved_amount' };
  return { value: null, field: null };
}

function approxEqual(a: number, b: number, tol = TOL): boolean {
  return Math.abs(a - b) <= tol;
}

function matchesKnownContaminationMultiplier(ratio: number): boolean {
  return KNOWN_CONTAMINATION_MULTIPLIERS.some((m) => Math.abs(ratio - m) <= 0.005);
}

export function resolveApprovedCommercialAmount(
  input: ResolveApprovedAmountInput,
): ResolveApprovedAmountResult {
  const warnings: ApprovedAmountWarning[] = [];
  const opportunity = input.opportunity ?? null;
  const proposal = input.proposal ?? null;
  const hasAcceptedLink = !!opportunity?.accepted_proposal_id;

  // FROZEN-FIRST: se a proposta tiver schedule aprovado OU snapshot de
  // aprovação, esse valor é IMUTÁVEL e prevalece sobre approved_amount
  // (coluna pode ter sido contaminada por reaplicação de dynamic pricing).
  // Hierarquia: schedule sum → snapshot.payment_expected → snapshot.approval/effective.
  // Ver `resolveFrozenApprovedAmount` para a regra completa.
  const scheduleSum = sumSchedule(proposal?.approved_payment_schedule);
  if (scheduleSum != null && scheduleSum > 0) {
    const col = toNumber(proposal?.approved_amount);
    if (col != null && Math.abs(col - scheduleSum) > 0.5) {
      warnings.push('approved_amount_column_contaminated_after_approval');
      warnings.push('approved_amount_column_mismatch');
    }
    return finalize(scheduleSum, 'approved_payment_schedule', warnings, true, false);
  }

  // Snapshot — tenta múltiplos nomes (payment_expected_amount, approval_amount,
  // effective_amount, approved_amount). Se algum existe e é > 0, congela aqui.
  const snapRaw = proposal?.approval_snapshot as any;
  if (snapRaw && typeof snapRaw === 'object') {
    const snapCandidate =
      toNumber(snapRaw.payment_expected_amount) ??
      toNumber(snapRaw.approval_amount) ??
      toNumber(snapRaw.effective_amount) ??
      toNumber(snapRaw.approved_amount);
    if (snapCandidate != null && snapCandidate > 0) {
      const col = toNumber(proposal?.approved_amount);
      if (col != null && Math.abs(col - snapCandidate) > 0.5) {
        warnings.push('approved_amount_column_contaminated_after_approval');
        warnings.push('approved_amount_column_mismatch');
      }
      const snapSource: ApprovedAmountSource =
        snapRaw.payment_expected_amount != null
          ? 'approval_snapshot.payment_expected_amount'
          : 'approval_snapshot.approved_amount';
      return finalize(snapCandidate, snapSource, warnings, true, false);
    }
  }

  const base = toNumber(proposal?.total_amount);
  const column = toNumber(proposal?.approved_amount);
  const snapInfo = snapshotNetAmount(proposal?.approval_snapshot);
  const snap = snapInfo.value;
  const snapField = snapInfo.field;
  const discount =
    toNumber(proposal?.pricing_manual_discount_amount) ??
    toNumber(proposal?.discount_amount) ??
    0;
  // (scheduleSum já calculado acima; mantido para compatibilidade abaixo)

  const snapshotSource: ApprovedAmountSource =
    snapField === 'approved_amount'
      ? 'approval_snapshot.approved_amount'
      : 'approval_snapshot.payment_expected_amount';


  // ── Casos triviais ────────────────────────────────────────────────
  // Sem snapshot nem column: cair para schedule/ledger/legado
  if (snap == null && column == null) {
    if (scheduleSum != null && scheduleSum > 0) {
      return finalize(scheduleSum, 'approved_payment_schedule', warnings, true, false);
    }
    const ledger = toNumber(proposal?.value);
    if (ledger != null && ledger > 0) {
      if (hasAcceptedLink) warnings.push('approved_amount_column_mismatch');
      return finalize(ledger, 'pricing_ledger', warnings, false, false);
    }
    const legacy = toNumber(opportunity?.valor_previsto);
    if (legacy != null && legacy > 0) {
      return finalize(legacy, 'opportunity_value_legacy', warnings, false, false);
    }
    return finalize(0, 'zero', ['needs_manual_review_amount_conflict'], false, true);
  }

  if (snap == null && column != null) {
    return finalize(column, 'approved_amount_column', warnings, true, false);
  }
  if (column == null && snap != null) {
    return finalize(snap, snapshotSource, warnings, true, false);
  }

  // Daqui em diante: snap e column != null
  const snapVal = snap as number;
  const colVal = column as number;

  // Regra A — consenso
  if (approxEqual(snapVal, colVal, CONSENSUS_TOL)) {
    return finalize(snapVal, 'approval_snapshot+column_consensus', warnings, true, false);
  }

  // Regra B — snap == base − desconto manual → snap é líquido pós-desconto
  if (base != null && discount > 0 && approxEqual(snapVal, base - discount)) {
    warnings.push('approved_amount_column_mismatch');
    if (matchesKnownContaminationMultiplier(colVal / snapVal)) {
      warnings.push('approved_amount_column_contaminated_after_approval');
    }
    return finalize(snapVal, snapshotSource, warnings, true, false);
  }

  // Regra C — column == snap − desconto manual → snapshot era bruto (caso OGGI)
  if (discount > 0 && approxEqual(colVal, snapVal - discount)) {
    warnings.push('approval_snapshot_may_be_gross_before_discount');
    return finalize(colVal, 'approved_amount_column', warnings, true, false);
  }

  // Regra D — column ≈ snap × multiplicador conhecido → column contaminado
  const ratio = snapVal > 0 ? colVal / snapVal : 0;
  if (matchesKnownContaminationMultiplier(ratio)) {
    warnings.push('approved_amount_column_contaminated_after_approval');
    warnings.push('approved_amount_column_mismatch');
    return finalize(snapVal, snapshotSource, warnings, true, false);
  }

  // Regra E — snap == base (sem desconto/ajuste) e column inflado → snap vence
  if (base != null && approxEqual(snapVal, base, CONSENSUS_TOL) && colVal > snapVal) {
    warnings.push('approved_amount_column_mismatch');
    return finalize(snapVal, snapshotSource, warnings, true, false);
  }

  // Fallback — needs review, prefer snap (imutável)
  warnings.push('needs_manual_review_amount_conflict');
  warnings.push('approved_amount_column_mismatch');
  return finalize(snapVal, snapshotSource, warnings, true, true);
}

function finalize(
  amount: number,
  source: ApprovedAmountSource,
  warnings: ApprovedAmountWarning[],
  isFinal: boolean,
  reviewRequired: boolean,
): ResolveApprovedAmountResult {
  return {
    approved_commercial_amount: amount,
    source,
    warnings,
    is_final_approved_value: isFinal,
    review_required: reviewRequired,
  };
}

export function formatBRLAmount(value: number, currency = 'BRL'): string {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value || 0);
  } catch {
    return `R$ ${(value || 0).toFixed(2)}`;
  }
}
