import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

export interface Contact {
  id: string;
  organization_id: string;
  account_id?: string;
  nome: string;
  cargo?: string;
  emails?: string[];
  telefones?: string[];
  created_at: string;
  updated_at: string;
}

const contactSchema = z.object({
  account_id: z.string().uuid().nullish(),
  nome: z.string().min(1, 'Nome é obrigatório').max(200),
  cargo: z.string().max(100).nullish(),
  emails: z.array(z.string().email()).nullish(),
  telefones: z.array(z.string()).nullish(),
});

export async function listContacts(params?: {
  account_id?: string;
  cargo?: string;
  q?: string;
  page?: number;
  page_size?: number;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');

  if (orgError || !orgId) {
    throw new Error('User must belong to an organization');
  }

  let query = supabase
    .from('contacts')
    .select(`
      *,
      account:accounts(id, razao_social, nome_fantasia)
    `, { count: 'exact' })
    .eq('organization_id', orgId)
    .order('nome');

  if (params?.account_id) {
    query = query.eq('account_id', params.account_id);
  }

  if (params?.cargo) {
    query = query.eq('cargo', params.cargo);
  }

  if (params?.q) {
    query = query.ilike('nome', `%${params.q}%`);
  }

  const page = params?.page || 1;
  const pageSize = params?.page_size || 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;
  return { data: data as any[], total: count || 0 };
}

export async function getContact(id: string) {
  const { data, error } = await supabase
    .from('contacts')
    .select(`
      *,
      account:accounts(*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;

  // Get opportunities count
  const { count: opportunitiesCount } = await supabase
    .from('opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('contact_id', id);

  // Get activities count
  const { count: activitiesCount } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .eq('contact_id', id);

  return {
    ...data,
    opportunities_count: opportunitiesCount || 0,
    activities_count: activitiesCount || 0,
  };
}

export async function createContact(dto: unknown): Promise<Contact> {
  const validated = contactSchema.parse(dto);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');

  if (orgError || !orgId) {
    throw new Error('User must belong to an organization');
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert([{
      nome: validated.nome,
      account_id: validated.account_id,
      cargo: validated.cargo,
      emails: validated.emails,
      telefones: validated.telefones,
      organization_id: orgId,
    }])
    .select()
    .single();

  if (error) throw error;
  return data as Contact;
}

export async function updateContact(id: string, dto: unknown): Promise<Contact> {
  const validated = contactSchema.partial().parse(dto);

  const { data, error } = await supabase
    .from('contacts')
    .update(validated)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Contact;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function searchContacts(query: string, accountId?: string): Promise<Contact[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');

  if (orgError || !orgId) {
    throw new Error('User must belong to an organization');
  }

  let dbQuery = supabase
    .from('contacts')
    .select('*')
    .eq('organization_id', orgId)
    .ilike('nome', `%${query}%`)
    .limit(10);

  if (accountId) {
    dbQuery = dbQuery.eq('account_id', accountId);
  }

  const { data, error } = await dbQuery;

  if (error) throw error;
  return data as Contact[];
}

export async function linkToAccount(contactId: string, accountId: string): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .update({ account_id: accountId })
    .eq('id', contactId)
    .select()
    .single();

  if (error) throw error;
  return data as Contact;
}
