/**
 * Fonte única da verdade do valor comercial aprovado de uma oportunidade ganha.
 *
 * Regra (na ordem):
 *  1. proposals.approved_amount                              → fonte canônica
 *  2. soma de proposals.approved_payment_schedule            → reconstrução do líquido aprovado
 *  3. approval_snapshot (apenas se contém líquido aprovado)  → snapshot histórico
 *  4. pricing ledger vigente (proposal.total_amount/value)   → proposta ainda não aprovada
 *  5. opportunity.valor_previsto                             → fallback visual legado
 *  6. 0                                                       → nada disponível
 *
 * Não recalcula proposta aprovada, não sobrescreve approval_snapshot,
 * não toca em ERP/Pix/PDF/Slack.
 */

export type ApprovedAmountSource =
  | 'approved_amount'
  | 'approved_payment_schedule'
  | 'approval_snapshot'
  | 'pricing_ledger'
  | 'opportunity_value_legacy'
  | 'zero';

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
    /** alguns ledgers legados usam `value` */
    value?: number | null;
  } | null;
}

export interface ResolveApprovedAmountResult {
  approved_commercial_amount: number;
  source: ApprovedAmountSource;
  warnings: string[];
  is_final_approved_value: boolean;
}

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

function snapshotNetAmount(snapshot: any): number | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  // tenta vários campos comuns em snapshots históricos
  const candidates = [
    snapshot.approved_amount,
    snapshot.net_amount,
    snapshot.net_total,
    snapshot.total_net,
    snapshot.total_amount, // último, pode ser bruto
  ];
  for (const c of candidates) {
    const n = toNumber(c);
    if (n != null) return n;
  }
  return null;
}

export function resolveApprovedCommercialAmount(
  input: ResolveApprovedAmountInput,
): ResolveApprovedAmountResult {
  const warnings: string[] = [];
  const opportunity = input.opportunity ?? null;
  const proposal = input.proposal ?? null;
  const hasAcceptedLink = !!opportunity?.accepted_proposal_id;

  // 1. approved_amount
  const approved = toNumber(proposal?.approved_amount);
  if (approved != null && approved > 0) {
    return {
      approved_commercial_amount: approved,
      source: 'approved_amount',
      warnings,
      is_final_approved_value: true,
    };
  }

  // 2. soma de approved_payment_schedule
  const scheduleSum = sumSchedule(proposal?.approved_payment_schedule);
  if (scheduleSum != null && scheduleSum > 0) {
    warnings.push('approved_amount ausente, usando soma de approved_payment_schedule');
    return {
      approved_commercial_amount: scheduleSum,
      source: 'approved_payment_schedule',
      warnings,
      is_final_approved_value: true,
    };
  }

  // 3. approval_snapshot
  const snap = snapshotNetAmount(proposal?.approval_snapshot);
  if (snap != null && snap > 0) {
    warnings.push('Usando líquido derivado de approval_snapshot');
    return {
      approved_commercial_amount: snap,
      source: 'approval_snapshot',
      warnings,
      is_final_approved_value: true,
    };
  }

  // 4. pricing ledger (proposta ainda não aprovada)
  const ledger = toNumber(proposal?.total_amount) ?? toNumber(proposal?.value);
  if (ledger != null && ledger > 0) {
    if (hasAcceptedLink) {
      warnings.push(
        'Oportunidade tem accepted_proposal_id mas a proposta não tem approved_amount; usando valor vigente do ledger',
      );
    }
    return {
      approved_commercial_amount: ledger,
      source: 'pricing_ledger',
      warnings,
      is_final_approved_value: false,
    };
  }

  // 5. fallback visual legado
  const legacy = toNumber(opportunity?.valor_previsto);
  if (legacy != null && legacy > 0) {
    warnings.push('Sem proposta resolvível, exibindo valor_previsto da oportunidade (legado)');
    return {
      approved_commercial_amount: legacy,
      source: 'opportunity_value_legacy',
      warnings,
      is_final_approved_value: false,
    };
  }

  return {
    approved_commercial_amount: 0,
    source: 'zero',
    warnings: ['Nenhuma fonte de valor disponível'],
    is_final_approved_value: false,
  };
}

export function formatBRLAmount(value: number, currency = 'BRL'): string {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value || 0);
  } catch {
    return `R$ ${(value || 0).toFixed(2)}`;
  }
}
