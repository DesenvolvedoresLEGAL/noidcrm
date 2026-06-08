/**
 * frozenSchedule — leitura centralizada do cronograma congelado em
 * `proposals.approved_payment_schedule`.
 *
 * O RPC `freeze_proposal_approval` grava o snapshot no formato
 * `{ schedule: [{ due_date, amount, label, index }] }`. Versões legadas
 * usaram `{ payment_schedule: [...] }` ou um array puro. Este helper
 * normaliza qualquer um desses formatos para `Installment[]` para que
 * UIs possam renderizar exatamente o que foi aprovado, sem recalcular.
 *
 * Princípio: após aprovação, NADA é recalculado. O cliente vê
 * exatamente os valores e datas congelados.
 */

import type { Installment } from '@/services/supabase/proposal-payment-terms';

interface FrozenEntry {
  due_date?: string;
  amount?: number | string;
  label?: string;
  index?: number;
}

export function isProposalFrozen(proposal: any | null | undefined): boolean {
  if (!proposal) return false;
  const status = proposal.status;
  return (
    (status === 'accepted' || status === 'approved') &&
    !!proposal.approved_payment_schedule
  );
}

function readFrozenEntries(proposal: any | null | undefined): FrozenEntry[] | null {
  const sched: any = proposal?.approved_payment_schedule;
  if (!sched) return null;
  if (Array.isArray(sched?.schedule)) return sched.schedule as FrozenEntry[];
  if (Array.isArray(sched?.payment_schedule)) return sched.payment_schedule as FrozenEntry[];
  if (Array.isArray(sched)) return sched as FrozenEntry[];
  return null;
}

/**
 * Retorna o cronograma congelado no formato `Installment[]` consumido
 * por `ProposalPublicView`, `ProposalPaymentTerms` e `ProposalPreview`.
 * Retorna `null` quando não há schedule congelado (proposta não aprovada
 * ou snapshot vazio) — chamadores devem cair para `calculateInstallments`
 * normalmente nesse caso.
 */
export function readFrozenSchedule(
  proposal: any | null | undefined,
): Installment[] | null {
  if (!isProposalFrozen(proposal)) return null;
  const entries = readFrozenEntries(proposal);
  if (!entries || entries.length === 0) return null;

  return entries
    .map((entry, idx): Installment | null => {
      const dueRaw = entry?.due_date;
      const due = typeof dueRaw === 'string' && dueRaw.length >= 10
        ? dueRaw.slice(0, 10)
        : null;
      if (!due) return null;
      const amount = Number(entry?.amount ?? 0);
      const number = entry?.index ?? idx + 1;
      const total = entries.length;
      const type: Installment['type'] = total === 1 ? 'upfront' : 'installment';
      return {
        number,
        dueDate: due,
        amount,
        type,
        label: entry?.label ?? (total === 1 ? 'Pagamento à vista' : `Parcela ${number}/${total}`),
      };
    })
    .filter((x): x is Installment => x !== null);
}

/**
 * Devolve a primeira `due_date` (YYYY-MM-DD) do schedule congelado,
 * suportando os 3 shapes históricos. Útil para `resolvePaymentDueDate`.
 */
export function readFrozenFirstDueDate(proposal: any | null | undefined): string | null {
  if (!isProposalFrozen(proposal)) return null;
  const entries = readFrozenEntries(proposal);
  const first = entries?.[0];
  const raw = first?.due_date;
  if (typeof raw !== 'string' || raw.length < 10) return null;
  return raw.slice(0, 10);
}
