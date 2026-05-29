/**
 * OTE ⇄ Vendas Realizadas — reconciliação oficial de elegibilidade por venda.
 *
 * Regra única:
 *  - eligible_amount / non_eligible_amount são calculados ITEM A ITEM no backend
 *    (`supabase/functions/calculate-ote/index.ts`), respeitando:
 *      a) status final da venda (perdida/cancelada/reaberta → 0 elegível);
 *      b) flag `counts_for_commission` do produto/serviço;
 *      c) flag `counts_for_commission` do item da proposta.
 *
 *  - A UI SEMPRE confia no que o backend persistiu. Não inferimos elegibilidade
 *    aqui — fazer isso esconde casos em que o cálculo precisa ser rodado de novo.
 *
 *  - Se ambos os campos estiverem zerados e a venda tiver valor comercial > 0,
 *    tratamos como "fora da meta" (eligible = 0) e o usuário deve clicar em
 *    "Calcular" para reprocessar o período.
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
  // Sem split persistido: NÃO inferir elegibilidade. Considera 0 elegível para
  // sinalizar a necessidade de recálculo via botão "Calcular".
  return { eligible: 0, nonEligible: sale };
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
