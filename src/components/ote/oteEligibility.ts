/**
 * OTE ⇄ Vendas Realizadas — reconciliação oficial de elegibilidade por venda.
 *
 * Regra única (espelha `isExcludedFromGoal` do hook useVendasRealizadas):
 *  - Venda "ganha" cuja `fulfillment_status` é 'removed' ou 'cancelled',
 *    OU cujo `commercial_status` virou 'lost' (reaberta perdida)
 *    → NÃO conta para meta. Vai para "fora da meta".
 *  - Caso contrário, o valor comercial inteiro é elegível.
 *
 * Fallback de leitura: preferimos o que foi gravado em
 * `eligible_amount`/`non_eligible_amount`. Quando esses campos vierem zerados
 * (registros legados antes da migration de transparência), reconstruímos a
 * elegibilidade a partir de `counts_toward_goal`/`sale_value` para evitar o
 * badge "Sim · R$ 0,00".
 */
import type { OTESalesRecord } from '@/hooks/useOTESalesRecords';

export interface EligibilitySplit {
  eligible: number;
  nonEligible: number;
}

export function resolveEligibleAmounts(r: OTESalesRecord): EligibilitySplit {
  const sale = Number(r.sale_value) || 0;
  const eligStored = Number(r.eligible_amount ?? 0);
  const nonStored = Number(r.non_eligible_amount ?? 0);
  if (eligStored > 0.01 || nonStored > 0.01) {
    return { eligible: eligStored, nonEligible: nonStored };
  }
  return r.counts_toward_goal
    ? { eligible: sale, nonEligible: 0 }
    : { eligible: 0, nonEligible: sale };
}

export function aggregateEligible(records: OTESalesRecord[]): {
  ssotTotal: number;
  eligibleTotal: number;
  nonEligibleTotal: number;
} {
  return records.reduce(
    (acc, r) => {
      const split = resolveEligibleAmounts(r);
      acc.ssotTotal += Number(r.sale_value || 0);
      acc.eligibleTotal += split.eligible;
      acc.nonEligibleTotal += split.nonEligible;
      return acc;
    },
    { ssotTotal: 0, eligibleTotal: 0, nonEligibleTotal: 0 },
  );
}
