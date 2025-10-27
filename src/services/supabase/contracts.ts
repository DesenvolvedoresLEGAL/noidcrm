import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const contractSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  accountId: z.string().uuid('Invalid account ID'),
  opportunityId: z.string().uuid('Invalid opportunity ID').optional(),
  contactId: z.string().uuid('Invalid contact ID').optional(),
  value: z.number().min(0, 'Contract value must be positive').optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  paymentTerms: z.string().max(1000, 'Payment terms too long').optional(),
  termsAndConditions: z.string().max(5000, 'Terms too long').optional(),
  status: z.enum(['draft', 'pending', 'active', 'expiring', 'expired', 'cancelled', 'renewed']).optional(),
}).passthrough();

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
  clientName: string;
  clientEmail: string;
  clientDocument: string;
  status: 'draft' | 'pending' | 'active' | 'expiring' | 'expired' | 'cancelled' | 'renewed';
  type: 'monthly' | 'quarterly' | 'annual' | 'one-time';
  value: number;
  monthlyValue?: number;
  startDate: string;
  endDate: string;
  signedDate?: string;
  renewalDate?: string;
  autoRenewal: boolean;
  paymentMethod: 'credit_card' | 'bank_slip' | 'bank_transfer' | 'pix';
  paymentTerms?: string;
  termsAndConditions?: string;
  terms?: string;
  notes?: string;
  attachments?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  created_at: string;
}

function mapDBToContract(db: any): Contract {
  return {
    id: db.id,
    opportunityId: db.opportunity_id || '',
    accountId: db.account_id,
    contactId: db.contact_id,
    title: db.title,
    clientName: db.client_name || 'Cliente',
    clientEmail: db.client_email || '',
    clientDocument: db.client_document || '',
    status: db.status,
    type: db.contract_type || 'annual',
    value: Number(db.contract_value) || 0,
    monthlyValue: Number(db.monthly_value) || 0,
    startDate: db.start_date || '',
    endDate: db.end_date || '',
    signedDate: db.signed_date || undefined,
    renewalDate: db.renewal_date || undefined,
    autoRenewal: db.auto_renewal || false,
    paymentMethod: db.payment_method || 'bank_transfer',
    paymentTerms: db.payment_terms || undefined,
    termsAndConditions: db.terms_and_conditions || undefined,
    terms: db.terms || undefined,
    notes: db.notes || undefined,
    attachments: db.attachments || [],
    createdBy: db.owner_user_id || '',
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    created_at: db.created_at,
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

export async function createContract(dto: unknown): Promise<Contract> {
  // Validate input
  const validated = contractSchema.parse(dto);
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');

  // Get user's organization_id
  const { data: memberData } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!memberData?.organization_id) {
    throw new Error('User must belong to an organization to create contracts');
  }

  const { data, error } = await supabase
    .from('contracts')
    .insert({
      opportunity_id: validated.opportunityId,
      account_id: validated.accountId,
      contact_id: validated.contactId,
      title: validated.title,
      status: validated.status || 'draft',
      contract_value: validated.value,
      start_date: validated.startDate,
      end_date: validated.endDate,
      payment_terms: validated.paymentTerms,
      terms_and_conditions: validated.termsAndConditions,
      owner_user_id: user.id,
      organization_id: memberData.organization_id,
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
