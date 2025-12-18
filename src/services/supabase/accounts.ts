import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

export interface Account {
  id: string;
  organization_id: string;
  tipo_pessoa: 'PJ' | 'PF';
  cnpj?: string | null;
  cpf?: string | null;
  razao_social: string;
  nome_fantasia?: string | null;
  segmento?: string | null;
  cnae?: string | null;
  tamanho?: string | null;
  porte?: string | null;
  faturamento?: number | null;
  origem_principal?: string | null;
  parent_account_id?: string | null;
  rg?: string | null;
  data_nascimento?: string | null;
  created_at: string;
  updated_at: string;
}

// Helper para converter string/number para number ou null
const stringToNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const num = parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return isNaN(num) ? null : num;
};

const accountSchema = z.object({
  // Tipo de Pessoa
  tipo_pessoa: z.enum(['PJ', 'PF']).default('PJ'),
  
  // Dados Principais
  cnpj: z.string().max(18).optional().nullable(),
  cpf: z.string().max(14).optional().nullable(),
  razao_social: z.string().min(1, 'Nome é obrigatório').max(200),
  nome_fantasia: z.string().max(200).optional().nullable(),
  tipo_empresa: z.string().optional().nullable(),
  situacao_cadastral: z.string().optional().nullable(),
  owner_user_id: z.string().optional().nullable(),
  cs_user_id: z.string().optional().nullable(),
  parent_account_id: z.string().optional().nullable(),
  
  // Dados PF
  rg: z.string().optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
  
  // Dados Cadastrais (PJ)
  inscricao_estadual: z.string().optional().nullable(),
  inscricao_municipal: z.string().optional().nullable(),
  natureza_juridica: z.string().optional().nullable(),
  porte: z.string().optional().nullable(),
  capital_social: z.union([z.string(), z.number(), z.null()]).optional().transform(stringToNumber),
  data_fundacao: z.string().optional().nullable(),
  data_situacao_cadastral: z.string().optional().nullable(),
  opcao_simples: z.boolean().optional().nullable(),
  opcao_mei: z.boolean().optional().nullable(),
  cnae: z.string().max(20).optional().nullable(),
  cnaes_secundarios: z.array(z.string()).optional().nullable(),
  matriz_filial: z.string().optional().nullable(),
  
  // Endereço
  cep: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  uf: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  
  // Contatos
  telefones: z.any().optional().nullable(),
  emails: z.any().optional().nullable(),
  website: z.string().optional().nullable(),
  linkedin: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  facebook: z.string().optional().nullable(),
  email_nota_fiscal: z.string().optional().nullable(),
  
  // Comercial
  segmento: z.string().max(100).optional().nullable(),
  tamanho: z.string().optional().nullable(),
  origem_principal: z.string().max(100).optional().nullable(),
  pontuacao_nps: z.number().optional().nullable(),
  data_tornou_cliente: z.string().optional().nullable(),
  codigo_externo: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  logo_url: z.string().optional().nullable(),
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

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');

  if (orgError || !orgId) {
    throw new Error('User must belong to an organization');
  }

  let query = supabase
    .from('accounts')
    .select('*', { count: 'exact' })
    .eq('organization_id', orgId)
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

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');

  if (orgError || !orgId) {
    throw new Error('User must belong to an organization');
  }

  // Remove undefined and empty string values
  const cleanedData: Record<string, any> = {};
  for (const [key, value] of Object.entries(validated)) {
    if (value !== undefined && value !== '' && value !== null) {
      cleanedData[key] = value;
    }
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert([{
      ...cleanedData,
      razao_social: validated.razao_social, // Ensure required field is present
      organization_id: orgId,
    }])
    .select()
    .single();

  if (error) throw error;
  return data as Account;
}

export async function updateAccount(id: string, dto: unknown): Promise<Account> {
  console.log('🔵 updateAccount - dto recebido:', dto);
  
  // 1. Pré-processar dados: converter strings vazias em null ANTES da validação
  const preprocessed = typeof dto === 'object' && dto !== null
    ? Object.fromEntries(
        Object.entries(dto as Record<string, unknown>).map(([key, value]) => [
          key,
          value === '' ? null : value
        ])
      )
    : dto;
  
  console.log('🔵 updateAccount - preprocessed:', preprocessed);

  // 2. Validar com schema partial
  const validated = accountSchema.partial().parse(preprocessed);
  console.log('🔵 updateAccount - validated:', validated);

  // 3. Preparar dados para update (manter nulls para limpar campos no banco)
  const cleanedData: Record<string, any> = {};
  for (const [key, value] of Object.entries(validated)) {
    if (value !== undefined) {
      // IMPORTANTE: Manter null para permitir limpar campos no banco
      cleanedData[key] = value;
    }
  }
  
  console.log('🔵 updateAccount - cleanedData final:', cleanedData);

  // 4. Executar update
  const { data, error } = await supabase
    .from('accounts')
    .update(cleanedData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('❌ updateAccount - erro Supabase:', error);
    throw error;
  }
  
  console.log('✅ updateAccount - sucesso:', data);
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

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');

  if (orgError || !orgId) {
    throw new Error('User must belong to an organization');
  }

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('organization_id', orgId)
    .or(`razao_social.ilike.%${query}%,nome_fantasia.ilike.%${query}%`)
    .limit(10);

  if (error) throw error;
  return data as Account[];
}
