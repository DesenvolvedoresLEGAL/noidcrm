import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { extractEmail, extractPhone, formatPersonName } from '@/lib/contactFormat';

// JSONB structured types for emails and phones
export interface ContactEmail {
  value: string;
  type: 'work' | 'personal' | 'other';
  is_primary: boolean;
}

export interface ContactPhone {
  value: string;
  type: 'mobile' | 'whatsapp' | 'landline' | 'other';
  is_primary: boolean;
}

export interface Contact {
  id: string;
  account_id?: string;
  nome: string;
  primeiro_nome: string;
  ultimo_nome?: string;
  cargo?: string;
  departamento?: string;
  linkedin?: string;
  observacoes?: string;
  emails: ContactEmail[];
  telefones: ContactPhone[];
  created_at?: string;
  updated_at?: string;
  organization_id: string;
  account?: {
    id: string;
    razao_social: string;
    nome_fantasia?: string;
  };
}

// Helper to get primary email from contact - handles both {value, type, is_primary} and {tipo, numero} formats
export function getPrimaryEmail(contact: Contact): string | undefined {
  const primary = contact.emails?.find(e => e.is_primary);
  if (primary) return extractEmail(primary) || undefined;
  return extractEmail(contact.emails) || undefined;
}

// Helper to get primary phone from contact - handles both formats
export function getPrimaryPhone(contact: Contact): string | undefined {
  const primary = contact.telefones?.find(p => p.is_primary);
  if (primary) return extractPhone(primary) || undefined;
  return extractPhone(contact.telefones) || undefined;
}

export const contactSchema = z.object({
  account_id: z.string().uuid().optional().nullable(),
  primeiro_nome: z.string().min(1, 'Primeiro nome é obrigatório'),
  ultimo_nome: z.string().optional().nullable(),
  cargo: z.string().optional().nullable(),
  departamento: z.string().optional().nullable(),
  linkedin: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  emails: z.array(z.object({
    value: z.string().email(),
    type: z.enum(['work', 'personal', 'other']),
    is_primary: z.boolean(),
  })).optional().default([]),
  telefones: z.array(z.object({
    value: z.string(),
    type: z.enum(['mobile', 'whatsapp', 'landline', 'other']),
    is_primary: z.boolean(),
  })).optional().default([]),
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
    .is('deleted_at', null) // Soft delete filter
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

  const primeiro = formatPersonName(validated.primeiro_nome);
  const ultimo = formatPersonName(validated.ultimo_nome || '');

  const { data, error } = await supabase
    .from('contacts')
    .insert([{
      nome: primeiro + (ultimo ? ' ' + ultimo : ''),
      primeiro_nome: primeiro,
      ultimo_nome: ultimo,
      account_id: validated.account_id,
      cargo: validated.cargo,
      departamento: validated.departamento || null,
      linkedin: validated.linkedin || null,
      observacoes: validated.observacoes || null,
      emails: validated.emails || [],
      telefones: validated.telefones || [],
      organization_id: orgId,
    }])
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Contact;
}

export async function updateContact(id: string, dto: unknown): Promise<Contact> {
  const validated = contactSchema.partial().parse(dto);

  const patch: Record<string, unknown> = { ...validated };
  if (typeof validated.primeiro_nome === 'string') {
    patch.primeiro_nome = formatPersonName(validated.primeiro_nome);
  }
  if (typeof validated.ultimo_nome === 'string') {
    patch.ultimo_nome = formatPersonName(validated.ultimo_nome);
  }
  if (patch.primeiro_nome !== undefined || patch.ultimo_nome !== undefined) {
    const primeiro = (patch.primeiro_nome as string | undefined) ?? '';
    const ultimo = (patch.ultimo_nome as string | undefined) ?? '';
    patch.nome = (primeiro + (ultimo ? ' ' + ultimo : '')).trim();
  }

  const { data, error } = await supabase
    .from('contacts')
    .update(patch as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Contact;
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
    .select('id, account_id, nome, primeiro_nome, ultimo_nome, cargo, departamento, linkedin, observacoes, emails, telefones, organization_id, created_at, updated_at')
    .eq('organization_id', orgId)
    .ilike('nome', `%${query}%`)
    .limit(10);

  if (accountId) {
    dbQuery = dbQuery.eq('account_id', accountId);
  }

  const { data, error } = await dbQuery;

  if (error) throw error;
  return data as unknown as Contact[];
}

export async function linkToAccount(contactId: string, accountId: string): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .update({ account_id: accountId })
    .eq('id', contactId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Contact;
}
