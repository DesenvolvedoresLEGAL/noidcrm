import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

export interface Account {
  id: string;
  organization_id: string;
  cnpj?: string;
  razao_social: string;
  nome_fantasia?: string;
  segmento?: string;
  cnae?: string;
  tamanho?: string;
  faturamento?: number;
  origem_principal?: string;
  created_at: string;
  updated_at: string;
}

const accountSchema = z.object({
  cnpj: z.string().max(18).optional(),
  razao_social: z.string().min(1, 'Razão Social é obrigatória').max(200),
  nome_fantasia: z.string().max(200).optional(),
  segmento: z.string().max(100).optional(),
  cnae: z.string().max(20).optional(),
  tamanho: z.enum(['Pequeno', 'Médio', 'Grande', 'Enterprise']).optional(),
  faturamento: z.number().min(0).optional(),
  origem_principal: z.string().max(100).optional(),
});

export async function listAccounts(params?: { 
  segmento?: string;
  tamanho?: string;
  q?: string;
  page?: number;
  page_size?: number;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: memberData } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!memberData?.organization_id) {
    throw new Error('User must belong to an organization');
  }

  let query = supabase
    .from('accounts')
    .select('*', { count: 'exact' })
    .eq('organization_id', memberData.organization_id)
    .order('razao_social');

  if (params?.segmento) {
    query = query.eq('segmento', params.segmento);
  }

  if (params?.tamanho) {
    query = query.eq('tamanho', params.tamanho);
  }

  if (params?.q) {
    query = query.or(`razao_social.ilike.%${params.q}%,nome_fantasia.ilike.%${params.q}%,cnpj.ilike.%${params.q}%`);
  }

  const page = params?.page || 1;
  const pageSize = params?.page_size || 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;
  return { data: data as Account[], total: count || 0 };
}

export async function getAccount(id: string) {
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (accountError) throw accountError;

  // Get counts
  const { count: opportunitiesCount } = await supabase
    .from('opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', id);

  const { count: contactsCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', id);

  const { count: contractsCount } = await supabase
    .from('contracts')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', id);

  return {
    ...account,
    opportunities_count: opportunitiesCount || 0,
    contacts_count: contactsCount || 0,
    contracts_count: contractsCount || 0,
  };
}

export async function createAccount(dto: unknown): Promise<Account> {
  const validated = accountSchema.parse(dto);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: memberData } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!memberData?.organization_id) {
    throw new Error('User must belong to an organization');
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert([{
      razao_social: validated.razao_social,
      cnpj: validated.cnpj,
      nome_fantasia: validated.nome_fantasia,
      segmento: validated.segmento,
      cnae: validated.cnae,
      tamanho: validated.tamanho,
      faturamento: validated.faturamento,
      origem_principal: validated.origem_principal,
      organization_id: memberData.organization_id,
    }])
    .select()
    .single();

  if (error) throw error;
  return data as Account;
}

export async function updateAccount(id: string, dto: unknown): Promise<Account> {
  const validated = accountSchema.partial().parse(dto);

  const { data, error } = await supabase
    .from('accounts')
    .update(validated)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Account;
}

export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function searchAccounts(query: string): Promise<Account[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: memberData } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!memberData?.organization_id) {
    throw new Error('User must belong to an organization');
  }

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('organization_id', memberData.organization_id)
    .or(`razao_social.ilike.%${query}%,nome_fantasia.ilike.%${query}%`)
    .limit(10);

  if (error) throw error;
  return data as Account[];
}
