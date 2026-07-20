import { supabase } from '@/integrations/supabase/client';

export interface PaymentTerm {
  id?: string;
  proposal_id: string;
  organization_id?: string;
  payment_type: 'one_time' | 'recurring';
  payment_method?: 'pix' | 'boleto' | 'cartao' | 'transferencia';
  
  // Avulso (one_time) fields
  entry_date?: string;
  entry_percent?: number;
  discount_percent?: number;
  installments?: number;
  first_installment_date?: string;
  installment_interval_days?: number;
  due_day?: number;
  
  // MRR (recurring) fields
  first_payment_date?: string;
  monthly_value?: number;
  contract_total?: number;
  recurring_due_day?: number;
  
  // Contract fields (new)
  contract_start_date?: string;
  contract_duration_months?: number;
  billing_day?: number;
  auto_renewal?: boolean;
  
  comments?: string;

  // PRICE UX 1.0.3 — payment condition
  payment_condition?:
    | 'upfront'
    | 'split_50_50'
    | 'split_30_70'
    | 'installments'
    | 'custom_schedule'
    | 'net_7'
    | 'net_15'
    | 'net_30'
    | 'net_35'
    | 'invoiced';
  second_payment_due_strategy?: 'post_event' | 'after_valid_until' | 'manual_date' | null;
  second_payment_due_date?: string | null;

  // PRICE UX 1.0.4 — Data de referência comercial
  dynamic_pricing_reference_type?: 'current_date' | 'payment_due_date' | 'custom_date' | 'approval_date';
  dynamic_pricing_reference_date?: string | null;
  freeze_price_on_approval?: boolean;
  requires_commercial_approval?: boolean;
  payment_due_days?: number | null;

  // Cronograma manual quando payment_condition='custom_schedule'
  manual_schedule?: ManualScheduleEntry[] | null;

  created_at?: string;
  updated_at?: string;
}

export interface ManualScheduleEntry {
  due_date: string; // YYYY-MM-DD
  percent?: number; // 0-100; tem precedência sobre amount se ambos vierem
  amount?: number;  // valor em moeda
  label?: string;
}

export interface Installment {
  number: number;
  dueDate: string;
  amount: number;
  /** 'upfront' = pagamento à vista (linha única); 'entry' = entrada de split; 'balance' = saldo de split; 'installment' = parcela tradicional */
  type: 'upfront' | 'entry' | 'balance' | 'installment';
  label?: string;
}

export async function getPaymentTerms(proposalId: string): Promise<PaymentTerm[]> {
  const { data, error } = await supabase
    .from('proposal_payment_terms')
    .select('*')
    .eq('proposal_id', proposalId);

  if (error) throw error;
  return data as unknown as PaymentTerm[];
}

export async function createPaymentTerm(term: Omit<PaymentTerm, 'id' | 'created_at' | 'updated_at'>): Promise<PaymentTerm> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');

  if (orgError || !orgId) {
    throw new Error('User must belong to an organization');
  }

  // Use upsert on (proposal_id, payment_type) — a DB trigger
  // (trg_proposal_auto_dynamic_pricing) may have already seeded a default
  // "one_time" row for Evento proposals, which would cause a 409 conflict
  // on plain INSERT. Upsert keeps the user's values authoritative.
  const { data, error } = await supabase
    .from('proposal_payment_terms')
    .upsert(
      {
        ...term,
        organization_id: orgId,
      } as any,
      { onConflict: 'proposal_id,payment_type' },
    )
    .select()
    .single();

  if (error) throw error;
  return data as unknown as PaymentTerm;
}

export async function updatePaymentTerm(
  termId: string,
  updates: Partial<Omit<PaymentTerm, 'id' | 'proposal_id' | 'organization_id'>>
): Promise<PaymentTerm> {
  const { data, error } = await supabase
    .from('proposal_payment_terms')
    .update(updates as any)
    .eq('id', termId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as PaymentTerm;
}

export async function deletePaymentTerm(termId: string): Promise<void> {
  const { error } = await supabase
    .from('proposal_payment_terms')
    .delete()
    .eq('id', termId);

  if (error) throw error;
}

// Helper to parse date string as local date (avoiding UTC interpretation)
function parseLocalDate(dateString: string): Date {
  // Format: YYYY-MM-DD - parse as local date
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Helper to format date as YYYY-MM-DD preserving local date
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateInstallments(
  term: PaymentTerm,
  totalAmount: number,
  options?: {
    proposalExpiresAt?: string | null;
    approvedAmount?: number | null;
    /**
     * PRICE UX 1.0.3 — quando a tabela dinâmica está ativa, o vencimento do
     * "à vista" é a data-limite da faixa vigente (current_ends_at), não a
     * data manual "Início" do termo.
     */
    dynamicPricingCurrentEndsAt?: string | null;
    /**
     * PRICE UX 1.0.6 — sinal explícito de "cronograma congelado por aceite".
     * Deve ser passado `true` APENAS quando a proposta já foi aceita e o
     * cronograma foi persistido em `approved_payment_schedule`.
     * Não confundir com `approvedAmount`, que serve apenas para não
     * reaplicar `discount_percent` sobre uma base já líquida (ledger).
     */
    frozenSchedule?: boolean;
  },
): Installment[] {
  if (term.payment_type !== 'one_time') {
    return [];
  }

  const discountPercent = term.discount_percent || 0;
  const baseTotal = options?.approvedAmount != null ? options.approvedAmount : totalAmount;
  const discountedTotal = options?.approvedAmount != null
    ? baseTotal // approved amount is already final/frozen
    : baseTotal * (1 - discountPercent / 100);

  // Auto-derive condition from legacy fields se ainda não foi configurada explicitamente
  let condition = term.payment_condition || 'upfront';
  const numInstallments = term.installments || 1;
  const entryPercent = term.entry_percent || 0;
  if (!term.payment_condition) {
    if (entryPercent === 50 && numInstallments === 1) condition = 'split_50_50';
    else if (entryPercent === 30 && numInstallments === 1) condition = 'split_30_70';
    else if (numInstallments > 1) condition = 'installments';
  }

  // ----- À vista -----
  const isUpfront =
    condition === 'upfront' ||
    (numInstallments <= 1 && entryPercent === 0 && condition !== 'split_50_50' && condition !== 'split_30_70');

  if (isUpfront) {
    // PRICE UX 1.0.3 — quando há tabela dinâmica ativa e a proposta ainda
    // não foi aprovada (sem approvedAmount frozen), o vencimento do à vista
    // segue a data-limite da faixa vigente. Se a proposta já foi aprovada,
    // mantemos o que foi congelado em first_installment_date.
    // PRICE UX 1.0.5 — quando o usuário escolhe "Data personalizada" como
    // âncora de precificação, esta data passa a ser também o vencimento do
    // à vista (refletindo no Cronograma e na proposta pública).
    const dynEnd = options?.dynamicPricingCurrentEndsAt;
    const isFrozen = options?.approvedAmount != null;
    const refType = (term as any).dynamic_pricing_reference_type;
    const refDate = (term as any).dynamic_pricing_reference_date;
    const customAnchor =
      !isFrozen && refType === 'custom_date' && refDate
        ? String(refDate).slice(0, 10)
        : null;
    const dueDate = customAnchor
      ? customAnchor
      : !isFrozen && dynEnd
      ? dynEnd.slice(0, 10)
      : term.first_installment_date || term.entry_date || formatLocalDate(new Date());
    return [
      {
        number: 1,
        dueDate,
        amount: Number(discountedTotal.toFixed(2)),
        type: 'upfront',
        label: 'Pagamento à vista',
      },
    ];
  }

  // ----- 50% + 50% / 30% + 70% -----
  if (condition === 'split_50_50' || condition === 'split_30_70') {
    const firstPct = condition === 'split_50_50' ? 50 : 30;
    const secondPct = 100 - firstPct;
    const entryDate = term.entry_date || term.first_installment_date || formatLocalDate(new Date());

    let balanceDate = term.second_payment_due_date || null;
    if (!balanceDate) {
      const strategy = term.second_payment_due_strategy || 'after_valid_until';
      if (strategy === 'after_valid_until' && options?.proposalExpiresAt) {
        balanceDate = options.proposalExpiresAt.slice(0, 10);
      } else if (strategy === 'post_event' && options?.proposalExpiresAt) {
        balanceDate = options.proposalExpiresAt.slice(0, 10);
      } else {
        const d = parseLocalDate(entryDate);
        d.setDate(d.getDate() + 30);
        balanceDate = formatLocalDate(d);
      }
    }

    return [
      {
        number: 1,
        dueDate: entryDate,
        amount: Number(((discountedTotal * firstPct) / 100).toFixed(2)),
        type: 'entry',
        label: `Entrada (${firstPct}%)`,
      },
      {
        number: 2,
        dueDate: balanceDate,
        amount: Number(((discountedTotal * secondPct) / 100).toFixed(2)),
        type: 'balance',
        label: `Saldo (${secondPct}%)`,
      },
    ];
  }

  // ----- Cronograma Manual -----
  if (condition === 'custom_schedule' && Array.isArray(term.manual_schedule) && term.manual_schedule.length > 0) {
    const entries = [...term.manual_schedule].sort((a, b) =>
      (a.due_date || '').localeCompare(b.due_date || ''),
    );
    return entries.map((entry, idx) => {
      const amount =
        typeof entry.percent === 'number'
          ? (discountedTotal * entry.percent) / 100
          : Number(entry.amount || 0);
      return {
        number: idx + 1,
        dueDate: entry.due_date,
        amount: Number(amount.toFixed(2)),
        type: 'installment',
        label: entry.label || `Parcela ${idx + 1}${typeof entry.percent === 'number' ? ` (${entry.percent}%)` : ''}`,
      } as Installment;
    });
  }

  // ----- Parcelado tradicional (legado) -----
  const installments: Installment[] = [];
  const intervalDays = term.installment_interval_days || 30;

  if (entryPercent > 0 && term.entry_date) {
    const entryAmount = discountedTotal * (entryPercent / 100);
    installments.push({
      number: 0,
      dueDate: term.entry_date,
      amount: Number(entryAmount.toFixed(2)),
      type: 'entry',
    });
  }

  const remainingAmount = discountedTotal * (1 - entryPercent / 100);
  const installmentAmount = remainingAmount / numInstallments;
  const firstDateStr = term.first_installment_date || formatLocalDate(new Date());
  const firstDate = parseLocalDate(firstDateStr);

  for (let i = 0; i < numInstallments; i++) {
    let dueDate: Date;
    if (i === 0) {
      dueDate = new Date(firstDate);
    } else {
      const targetMonth = firstDate.getMonth() + i;
      const targetYear = firstDate.getFullYear() + Math.floor(targetMonth / 12);
      const normalizedMonth = targetMonth % 12;
      let targetDay: number;
      if (term.due_day && term.due_day >= 1 && term.due_day <= 31) {
        targetDay = term.due_day;
      } else {
        const intervalDate = new Date(firstDate);
        intervalDate.setDate(firstDate.getDate() + (intervalDays * i));
        targetDay = intervalDate.getDate();
      }
      const lastDayOfMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
      const clampedDay = Math.min(targetDay, lastDayOfMonth);
      dueDate = new Date(targetYear, normalizedMonth, clampedDay);
    }
    installments.push({
      number: i + 1,
      dueDate: formatLocalDate(dueDate),
      amount: Number(installmentAmount.toFixed(2)),
      type: 'installment',
    });
  }

  return installments;
}

export function calculateMRRTotal(term: PaymentTerm, months: number = 12): number {
  if (term.payment_type !== 'recurring') {
    return 0;
  }

  const monthlyValue = term.monthly_value || 0;
  return Number((monthlyValue * months).toFixed(2));
}

export interface MRRInstallment {
  number: number;
  dueDate: string;
  amount: number;
}

export function calculateMRRInstallments(
  monthlyValue: number,
  durationMonths: number = 12,
  billingDay: number = 10,
  startDate?: string
): MRRInstallment[] {
  if (monthlyValue <= 0) {
    return [];
  }

  const installments: MRRInstallment[] = [];
  const start = startDate ? parseLocalDate(startDate) : new Date();

  for (let i = 0; i < durationMonths; i++) {
    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + i);
    dueDate.setDate(billingDay);

    // Adjust for months with fewer days
    if (dueDate.getDate() !== billingDay) {
      dueDate.setDate(0); // Last day of previous month
    }

    installments.push({
      number: i + 1,
      dueDate: formatLocalDate(dueDate),
      amount: Number(monthlyValue.toFixed(2)),
    });
  }

  return installments;
}
