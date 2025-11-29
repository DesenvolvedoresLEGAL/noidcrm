import { supabase } from '@/integrations/supabase/client';

export interface AccountPartner {
  id: string;
  account_id: string;
  organization_id: string;
  nome_socio: string;
  cpf_cnpj_socio?: string;
  qualificacao?: string;
  data_entrada?: string;
  faixa_etaria?: string;
  created_at: string;
  updated_at: string;
}

export async function listAccountPartners(accountId: string): Promise<AccountPartner[]> {
  const { data, error } = await supabase
    .from('account_partners')
    .select('*')
    .eq('account_id', accountId)
    .order('nome_socio');

  if (error) throw error;
  return (data as AccountPartner[]) || [];
}

export async function createAccountPartner(
  accountId: string,
  partner: Omit<AccountPartner, 'id' | 'account_id' | 'organization_id' | 'created_at' | 'updated_at'>
): Promise<AccountPartner> {
  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');
  
  if (orgError || !orgId) {
    throw new Error('User must belong to an organization');
  }

  const { data, error } = await supabase
    .from('account_partners')
    .insert([{
      account_id: accountId,
      organization_id: orgId,
      ...partner,
    }])
    .select()
    .single();

  if (error) throw error;
  return data as AccountPartner;
}

export async function deleteAccountPartner(partnerId: string): Promise<void> {
  const { error } = await supabase
    .from('account_partners')
    .delete()
    .eq('id', partnerId);

  if (error) throw error;
}