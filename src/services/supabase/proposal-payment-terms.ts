import { supabase } from '@/integrations/supabase/client';

export interface PaymentTerm {
  id?: string;
  proposal_id: string;
  organization_id?: string;
  payment_type: 'one_time' | 'recurring';
  
  // P&S (one_time) fields
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
  
  comments?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Installment {
  number: number;
  dueDate: string;
  amount: number;
  type: 'entry' | 'installment';
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

  // Generate installments
  const firstDate = new Date(term.first_installment_date || new Date());
  
  for (let i = 0; i < numInstallments; i++) {
    const dueDate = new Date(firstDate);
    dueDate.setDate(dueDate.getDate() + (i * intervalDays));
    
    // Set due day if specified
    if (term.due_day) {
      dueDate.setDate(term.due_day);
    }

    installments.push({
      number: i + 1,
      dueDate: dueDate.toISOString().split('T')[0],
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
