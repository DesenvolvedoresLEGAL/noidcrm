/**
 * resolvePaymentDueDateFromCommercialCondition
 * --------------------------------------------
 * P0 — Garante que o vencimento do "Pagamento à vista" siga a validade
 * da condição comercial vigente quando a tabela dinâmica estiver ativa,
 * em vez de cair para a data de criação da proposta/payment_terms.
 *
 * Fontes (em ordem de prioridade):
 *  1. dynamicPricingContext.snapshot.current_ends_at       → current_dynamic_tier_end
 *  2. proposal.dynamic_pricing_snapshot.current_ends_at    → dynamic_pricing_snapshot_current_tier_end
 *  3. proposal.pricing_breakdown_snapshot.dynamic_adjustment.tier_ends_at
 *                                                          → pricing_ledger_current_tier_end
 *  4. paymentTerm.first_installment_date / entry_date      → manual_payment_due_date
 *  5. proposal.expires_at                                  → proposal_expires_at
 *  6. hoje                                                 → fallback_today (com warning)
 *
 * Para propostas APROVADAS com approved_payment_schedule, o vencimento
 * congelado prevalece e nunca é recalculado.
 *
 * Nunca usa created_at da proposta, da oportunidade ou do payment_terms.
 */

export type PaymentDueDateSource =
  | 'current_dynamic_tier_end'
  | 'dynamic_pricing_snapshot_current_tier_end'
  | 'pricing_ledger_current_tier_end'
  | 'proposal_expires_at'
  | 'manual_payment_due_date'
  | 'frozen_approved_payment_schedule'
  | 'fallback_today';

export interface ResolvedPaymentDueDate {
  /** Data no formato YYYY-MM-DD */
  due_date: string;
  source: PaymentDueDateSource;
  warning?: string;
}

export interface DynamicPricingContext {
  /** Snapshot vivo retornado por calculate_proposal_dynamic_price (RPC) */
  snapshot?: { enabled?: boolean | null; current_ends_at?: string | null } | null;
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  const s = String(value);
  // Aceita 'YYYY-MM-DD...' e 'YYYY-MM-DDTHH:mm:ssZ'
  if (s.length >= 10) return s.slice(0, 10);
  return null;
}

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function resolvePaymentDueDateFromCommercialCondition(
  proposal: any | null | undefined,
  paymentTerm: any | null | undefined,
  dynamicPricingContext?: DynamicPricingContext | null,
): ResolvedPaymentDueDate {
  // 0. Frozen on approval — nunca recalcular após aceite.
  // Suporta os 3 shapes históricos do snapshot:
  //   { schedule: [...] }          ← shape atual do RPC freeze_proposal_approval
  //   { payment_schedule: [...] }  ← legado
  //   [...]                        ← legado mais antigo
  if (proposal?.status === 'accepted' || proposal?.status === 'approved') {
    const sched: any = proposal?.approved_payment_schedule;
    const list = Array.isArray(sched?.schedule)
      ? sched.schedule
      : Array.isArray(sched?.payment_schedule)
        ? sched.payment_schedule
        : Array.isArray(sched)
          ? sched
          : null;
    const frozenDate = toIsoDate(list?.[0]?.due_date);
    if (frozenDate) {
      return { due_date: frozenDate, source: 'frozen_approved_payment_schedule' };
    }
  }

  const dpEnabled =
    !!proposal?.dynamic_pricing_enabled ||
    !!dynamicPricingContext?.snapshot?.enabled;

  // 1. Snapshot vivo
  if (dpEnabled) {
    const live = toIsoDate(dynamicPricingContext?.snapshot?.current_ends_at);
    if (live) return { due_date: live, source: 'current_dynamic_tier_end' };

    // 2. Snapshot persistido na proposta
    const persisted = toIsoDate(proposal?.dynamic_pricing_snapshot?.current_ends_at);
    if (persisted) {
      return {
        due_date: persisted,
        source: 'dynamic_pricing_snapshot_current_tier_end',
      };
    }

    // 3. Ledger
    const ledger = toIsoDate(
      proposal?.pricing_breakdown_snapshot?.dynamic_adjustment?.tier_ends_at,
    );
    if (ledger) {
      return { due_date: ledger, source: 'pricing_ledger_current_tier_end' };
    }
  }

  // 4. Data manual do payment_term (só quando tabela dinâmica NÃO está ativa,
  //    ou quando ativa mas sem nenhuma fonte de tier vigente disponível).
  const manual = toIsoDate(
    paymentTerm?.first_installment_date ?? paymentTerm?.entry_date,
  );
  if (manual) {
    return { due_date: manual, source: 'manual_payment_due_date' };
  }

  // 5. Validade da proposta
  const expires = toIsoDate(proposal?.expires_at);
  if (expires) {
    return { due_date: expires, source: 'proposal_expires_at' };
  }

  // 6. Fallback hoje
  return {
    due_date: todayLocal(),
    source: 'fallback_today',
    warning:
      'Nenhuma fonte de vencimento (tier vigente / ledger / validade) disponível; usando data atual.',
  };
}

/**
 * Helper de conveniência: devolve a data ISO (YYYY-MM-DD) que deve ser
 * passada como `dynamicPricingCurrentEndsAt` ao `calculateInstallments`,
 * quando a tabela dinâmica estiver ativa. Retorna null fora desse cenário
 * para preservar o comportamento legado.
 */
export function dynamicPricingEndForInstallments(
  proposal: any | null | undefined,
  paymentTerm: any | null | undefined,
  dynamicPricingContext?: DynamicPricingContext | null,
): string | null {
  const dpEnabled =
    !!proposal?.dynamic_pricing_enabled ||
    !!dynamicPricingContext?.snapshot?.enabled;
  if (!dpEnabled) return null;
  // Não sobrescrever cronograma congelado pós-aceite
  if (proposal?.status === 'accepted' || proposal?.status === 'approved') {
    if (proposal?.approved_payment_schedule) return null;
  }
  const resolved = resolvePaymentDueDateFromCommercialCondition(
    proposal,
    paymentTerm,
    dynamicPricingContext,
  );
  if (
    resolved.source === 'current_dynamic_tier_end' ||
    resolved.source === 'dynamic_pricing_snapshot_current_tier_end' ||
    resolved.source === 'pricing_ledger_current_tier_end' ||
    resolved.source === 'proposal_expires_at'
  ) {
    return resolved.due_date;
  }
  return null;
}
