import { supabase } from '@/integrations/supabase/client';
import { Lead } from '../crm/types';

export async function listLeads(params: {
  status?: string;
  source?: string;
  query?: string;
} = {}): Promise<{ data: Lead[]; total: number }> {
  let query = supabase
    .from('accounts')
    .select('*', { count: 'exact' });

  // Filter by status if provided
  if (params.status) {
    // You might need to add a status column to accounts table
    // For now, this is a placeholder
  }

  // Filter by source if provided
  if (params.source) {
    query = query.eq('origem_principal', params.source);
  }

  // Search by query if provided
  if (params.query) {
    query = query.or(`razao_social.ilike.%${params.query}%,nome_fantasia.ilike.%${params.query}%`);
  }

  const { data, error, count } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching leads:', error);
    throw error;
  }

  // Transform accounts to leads format
  const leads = (data || []).map(account => ({
    id: account.id,
    account_id: account.id,
    status: 'new' as const,
    origem: account.origem_principal || 'Desconhecida',
    fonte: account.origem_principal,
    intent_score: 50,
    fit_score: 50,
    created_at: account.created_at,
    updated_at: account.updated_at,
  }));

  return {
    data: leads,
    total: count || 0,
  };
}

export async function getLead(id: string): Promise<Lead | null> {
  const { data, error } = await supabase
    .from('accounts')
    .select(`
      *,
      contacts(*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching lead:', error);
    throw error;
  }

  if (!data) return null;

  return {
    id: data.id,
    account_id: data.id,
    status: 'new',
    origem: data.origem_principal || 'Desconhecida',
    fonte: data.origem_principal,
    intent_score: 50,
    fit_score: 50,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function createLead(dto: any): Promise<Lead> {
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      razao_social: dto.razao_social || 'Nova Conta',
      nome_fantasia: dto.nome_fantasia,
      origem_principal: dto.origem,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating lead:', error);
    throw error;
  }

  return {
    id: data.id,
    account_id: data.id,
    status: 'new',
    origem: data.origem_principal || 'Desconhecida',
    fonte: data.origem_principal,
    intent_score: 50,
    fit_score: 50,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}
