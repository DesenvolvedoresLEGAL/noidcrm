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
  payment_condition?: 'upfront' | 'split_50_50' | 'split_30_70' | 'installments' | 'custom_schedule';
  second_payment_due_strategy?: 'post_event' | 'after_valid_until' | 'manual_date' | null;
  second_payment_due_date?: string | null;

  created_at?: string;
  updated_at?: string;
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
  return data as PaymentTerm[];
}

export async function createPaymentTerm(term: Omit<PaymentTerm, 'id' | 'created_at' | 'updated_at'>): Promise<PaymentTerm> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');

  if (orgError || !orgId) {
    throw new Error('User must belong to an organization');
  }

  const { data, error } = await supabase
    .from('proposal_payment_terms')
    .insert({
      ...term,
      organization_id: orgId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as PaymentTerm;
}

export async function updatePaymentTerm(
  termId: string,
  updates: Partial<Omit<PaymentTerm, 'id' | 'proposal_id' | 'organization_id'>>
): Promise<PaymentTerm> {
  const { data, error } = await supabase
    .from('proposal_payment_terms')
    .update(updates)
    .eq('id', termId)
    .select()
    .single();

  if (error) throw error;
  return data as PaymentTerm;
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

export function calculateInstallments(term: PaymentTerm, totalAmount: number): Installment[] {
  if (term.payment_type !== 'one_time') {
    return [];
  }

  const installments: Installment[] = [];
  const entryPercent = term.entry_percent || 0;
  const numInstallments = term.installments || 1;
  const discountPercent = term.discount_percent || 0;
  const intervalDays = term.installment_interval_days || 30;

  // Apply discount to total
  const discountedTotal = totalAmount * (1 - discountPercent / 100);

  // Calculate entry amount
  if (entryPercent > 0 && term.entry_date) {
    const entryAmount = discountedTotal * (entryPercent / 100);
    installments.push({
      number: 0,
      dueDate: term.entry_date,
      amount: Number(entryAmount.toFixed(2)),
      type: 'entry',
    });
  }

  // Calculate remaining amount for installments
  const remainingAmount = discountedTotal * (1 - entryPercent / 100);
  const installmentAmount = remainingAmount / numInstallments;

  // Generate installments - use local date parsing to avoid timezone shift
  const firstDateStr = term.first_installment_date || formatLocalDate(new Date());
  const firstDate = parseLocalDate(firstDateStr);
  
  for (let i = 0; i < numInstallments; i++) {
    let dueDate: Date;
    
    if (i === 0) {
      // First installment uses first_installment_date exactly as configured
      dueDate = new Date(firstDate);
    } else {
      // Calculate target date by adding months (not raw days) for more predictable behavior
      // Then adjust to the preferred due_day
      const targetMonth = firstDate.getMonth() + i;
      const targetYear = firstDate.getFullYear() + Math.floor(targetMonth / 12);
      const normalizedMonth = targetMonth % 12;
      
      // Determine the day to use
      let targetDay: number;
      if (term.due_day && term.due_day >= 1 && term.due_day <= 31) {
        targetDay = term.due_day;
      } else {
        // If no due_day preference, use interval-based calculation
        const intervalDate = new Date(firstDate);
        intervalDate.setDate(firstDate.getDate() + (intervalDays * i));
        targetDay = intervalDate.getDate();
      }
      
      // Clamp to last day of target month
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
