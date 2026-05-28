/**
 * FROZEN APPROVAL AMOUNT — fonte única para propostas ACEITAS.
 *
 * Regra absoluta: depois que a proposta foi aceita, o valor exibido em
 * qualquer superfície (tela pública aprovada, oportunidade herdada,
 * sidebar, PDF aprovado, comissão, revenue) é IMUTÁVEL e vem do
 * snapshot/schedule congelado na aprovação. NUNCA pode vir de
 * `dynamic_pricing_current_amount`, `pricing_effective_amount` atual,
 * `pricing_erp_amount`, condição comercial vigente, `proposal.total_amount`,
 * `valor_previsto` ou ledger recalculado.
 *
 * Hierarquia (em ordem):
 *   1. soma de approved_payment_schedule (cronograma aprovado pelo cliente)
 *   2. approval_snapshot.payment_expected_amount
 *   3. approval_snapshot.approval_amount / effective_amount
 *   4. approval_snapshot.approved_amount
 *   5. proposals.approved_amount (coluna) — apenas se bater com 1/2/3
 *   6. system_events PROPOSTA ACEITA — fallback diagnóstico (não tratado aqui)
 *
 * Quando nada bate ou existe conflito não resolvível → review_required = true.
 */

export type FrozenAmountSource =
  | 'approved_payment_schedule'
  | 'approval_snapshot.payment_expected_amount'
  | 'approval_snapshot.approval_amount'
  | 'approval_snapshot.effective_amount'
  | 'approval_snapshot.approved_amount'
  | 'approved_amount_column'
  | 'none';

export type FrozenAmountWarning =
  | 'approved_amount_column_mismatch_frozen'
  | 'approved_payment_schedule_missing'
  | 'approval_snapshot_missing'
  | 'frozen_amount_conflict_review_required';

export interface ResolveFrozenAmountInput {
  id?: string | null;
  status?: string | null;
  approved_amount?: number | null;
  approved_payment_schedule?: any;
  approval_snapshot?: any;
  total_amount?: number | null;
  currency?: string | null;
}

export interface ResolveFrozenAmountResult {
  amount: number;
  source: FrozenAmountSource;
  is_frozen: boolean;
  warnings: FrozenAmountWarning[];
  review_required: boolean;
  schedule_total: number | null;
  snapshot_amount: number | null;
  column_amount: number | null;
}

const TOL = 0.5;

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? Number(n) : null;
}

function approx(a: number, b: number, tol = TOL): boolean {
  return Math.abs(a - b) <= tol;
}

function sumSchedule(schedule: any): number | null {
  if (!schedule) return null;
  const arr = Array.isArray(schedule)
    ? schedule
    : Array.isArray(schedule?.installments)
      ? schedule.installments
      : Array.isArray(schedule?.schedule)
        ? schedule.schedule
        : null;
  if (!arr || arr.length === 0) return null;
  let total = 0;
  let touched = false;
  for (const item of arr) {
    const amount = toNum(item?.amount ?? item?.value ?? item?.net ?? item?.total);
    if (amount != null) {
      total += amount;
      touched = true;
    }
  }
  return touched ? Number(total.toFixed(2)) : null;
}

/**
 * Indica se a proposta deve usar valor congelado.
 * Critério: tem schedule aprovado, snapshot OU coluna approved_amount,
 * ou status pertence ao conjunto {accepted, approved, won}.
 */
export function isFrozenProposal(p: ResolveFrozenAmountInput | null | undefined): boolean {
  if (!p) return false;
  const status = (p.status ?? '').toLowerCase();
  if (['accepted', 'approved', 'won'].includes(status)) return true;
  if (p.approval_snapshot) return true;
  if (p.approved_payment_schedule) return true;
  if (p.approved_amount != null) return true;
  return false;
}

/**
 * Helper canônico para resolver o valor congelado de uma proposta aceita.
 * NUNCA usa dynamic pricing / ledger atual / total_amount / valor_previsto.
 */
export function resolveFrozenApprovedAmount(
  proposal: ResolveFrozenAmountInput | null | undefined,
): ResolveFrozenAmountResult {
  const warnings: FrozenAmountWarning[] = [];
  const schedule_total = sumSchedule(proposal?.approved_payment_schedule);
  const snap = proposal?.approval_snapshot as any;
  const column_amount = toNum(proposal?.approved_amount);

  // Extrair candidatos do snapshot — múltiplos nomes históricos
  const snap_payment_expected = snap ? toNum(snap.payment_expected_amount) : null;
  const snap_approval_amount = snap ? toNum(snap.approval_amount) : null;
  const snap_effective_amount = snap ? toNum(snap.effective_amount) : null;
  const snap_approved_amount = snap ? toNum(snap.approved_amount) : null;

  // Primeiro candidato não-nulo do snapshot (líquido aprovado)
  let snapshot_amount: number | null = null;
  let snapshot_source: FrozenAmountSource = 'none';
  if (snap_payment_expected != null && snap_payment_expected > 0) {
    snapshot_amount = snap_payment_expected;
    snapshot_source = 'approval_snapshot.payment_expected_amount';
  } else if (snap_approval_amount != null && snap_approval_amount > 0) {
    snapshot_amount = snap_approval_amount;
    snapshot_source = 'approval_snapshot.approval_amount';
  } else if (snap_effective_amount != null && snap_effective_amount > 0) {
    snapshot_amount = snap_effective_amount;
    snapshot_source = 'approval_snapshot.effective_amount';
  } else if (snap_approved_amount != null && snap_approved_amount > 0) {
    snapshot_amount = snap_approved_amount;
    snapshot_source = 'approval_snapshot.approved_amount';
  }

  // ── Hierarquia ────────────────────────────────────────────────────
  // 1. Cronograma aprovado é a fonte mais forte (o cliente literalmente
  //    aprovou aquelas parcelas).
  if (schedule_total != null && schedule_total > 0) {
    // Sanidade: se a coluna approved_amount diverge do schedule, sinalizar.
    if (column_amount != null && !approx(column_amount, schedule_total)) {
      warnings.push('approved_amount_column_mismatch_frozen');
    }
    return {
      amount: schedule_total,
      source: 'approved_payment_schedule',
      is_frozen: true,
      warnings,
      review_required: false,
      schedule_total,
      snapshot_amount,
      column_amount,
    };
  }

  warnings.push('approved_payment_schedule_missing');

  // 2/3/4. Snapshot
  if (snapshot_amount != null) {
    if (column_amount != null && !approx(column_amount, snapshot_amount)) {
      warnings.push('approved_amount_column_mismatch_frozen');
    }
    return {
      amount: snapshot_amount,
      source: snapshot_source,
      is_frozen: true,
      warnings,
      review_required: false,
      schedule_total,
      snapshot_amount,
      column_amount,
    };
  }

  warnings.push('approval_snapshot_missing');

  // 5. Coluna isolada — última opção, marca review
  if (column_amount != null && column_amount > 0) {
    return {
      amount: column_amount,
      source: 'approved_amount_column',
      is_frozen: true,
      warnings,
      review_required: true,
      schedule_total,
      snapshot_amount,
      column_amount,
    };
  }

  warnings.push('frozen_amount_conflict_review_required');
  return {
    amount: 0,
    source: 'none',
    is_frozen: false,
    warnings,
    review_required: true,
    schedule_total,
    snapshot_amount,
    column_amount,
  };
}

export function formatFrozenBRL(value: number, currency = 'BRL'): string {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value || 0);
  } catch {
    return `R$ ${(value || 0).toFixed(2)}`;
  }
}
