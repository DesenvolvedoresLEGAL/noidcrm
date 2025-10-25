import { supabase } from '@/integrations/supabase/client';

interface DBContract {
  id: string;
  opportunity_id: string | null;
  account_id: string;
  contact_id: string | null;
  title: string;
  status: string;
  contract_value: number | null;
  start_date: string | null;
  end_date: string | null;
  payment_terms: string | null;
  terms_and_conditions: string | null;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  opportunityId: string;
  accountId: string;
  contactId: string | null;
  title: string;
  status: 'draft' | 'pending' | 'active' | 'expiring' | 'expired' | 'cancelled' | 'renewed';
  value: number;
  startDate: string;
  endDate: string;
  paymentTerms?: string;
  termsAndConditions?: string;
  createdAt: string;
  updatedAt: string;
}

function mapDBToContract(db: any): Contract {
  return {
    id: db.id,
    opportunityId: db.opportunity_id || '',
    accountId: db.account_id,
    contactId: db.contact_id,
    title: db.title,
    status: db.status,
    value: Number(db.contract_value) || 0,
    startDate: db.start_date || '',
    endDate: db.end_date || '',
    paymentTerms: db.payment_terms || undefined,
    termsAndConditions: db.terms_and_conditions || undefined,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export async function listContracts(): Promise<Contract[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(mapDBToContract);
}

export async function getContract(id: string): Promise<Contract | null> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapDBToContract(data) : null;
}

export async function createContract(
  contract: Partial<Contract>
): Promise<Contract> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');

  // Get user's organization_id
  const { data: memberData } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  const { data, error } = await supabase
    .from('contracts')
    .insert({
      opportunity_id: contract.opportunityId,
      account_id: contract.accountId!,
      contact_id: contract.contactId,
      title: contract.title!,
      status: contract.status || 'draft',
      contract_value: contract.value,
      start_date: contract.startDate,
      end_date: contract.endDate,
      payment_terms: contract.paymentTerms,
      terms_and_conditions: contract.termsAndConditions,
      owner_user_id: user.id,
      organization_id: memberData?.organization_id,
    })
    .select()
    .single();

  if (error) throw error;
  return mapDBToContract(data);
}

export async function updateContract(id: string, updates: Partial<Contract>): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .update({
      title: updates.title,
      status: updates.status,
      contract_value: updates.value,
      start_date: updates.startDate,
      end_date: updates.endDate,
      payment_terms: updates.paymentTerms,
      terms_and_conditions: updates.termsAndConditions,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapDBToContract(data);
}

export async function deleteContract(id: string): Promise<void> {
  const { error } = await supabase
    .from('contracts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getContractStats() {
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('status, contract_value, start_date, end_date');

  if (error) throw error;
  if (!contracts) return {};

  const total = contracts.length;
  const active = contracts.filter(c => c.status === 'active').length;
  const draft = contracts.filter(c => c.status === 'draft').length;
  const expired = contracts.filter(c => c.status === 'expired').length;
  
  const totalValue = contracts.reduce((sum, c) => sum + (Number(c.contract_value) || 0), 0);
  
  const now = new Date();
  const activeContracts = contracts.filter(c => 
    c.status === 'active' && 
    c.start_date && 
    new Date(c.start_date) <= now &&
    (!c.end_date || new Date(c.end_date) >= now)
  );
  const mrr = activeContracts.reduce((sum, c) => {
    const value = Number(c.contract_value) || 0;
    return sum + (value / 12);
  }, 0);

  const renewalDue = contracts.filter(c => {
    if (!c.end_date) return false;
    const endDate = new Date(c.end_date);
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 90;
  }).length;

  const renewalRate = total > 0 ? ((total - expired) / total) * 100 : 0;

  return {
    total,
    active,
    draft,
    expired,
    totalValue,
    mrr,
    renewalDue,
    renewalRate,
  };
}
