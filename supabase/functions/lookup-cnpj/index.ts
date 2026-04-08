import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CNPJData {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  natureza_juridica?: string;
  porte?: string;
  capital_social?: number;
  situacao_cadastral?: string;
  data_situacao_cadastral?: string;
  data_fundacao?: string;
  cnae_principal?: { codigo: string; descricao: string };
  cnaes_secundarios?: Array<{ codigo: string; descricao: string }>;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  telefones?: string[];
  email?: string;
  opcao_simples?: boolean;
  opcao_mei?: boolean;
  matriz_filial?: string;
  qsa?: Array<{
    nome: string;
    qualificacao: string;
    cpf_cnpj?: string;
    faixa_etaria?: string;
    data_entrada?: string;
  }>;
}

type OpenCNPJAResponse = Record<string, any>;
type BrasilAPIResponse = Record<string, any>;

const CACHE_TTL_DAYS = 30;

// ─── helpers ───────────────────────────────────────────────────

const normalizePorte = (porteRF: string | undefined, opcaoMei: boolean, capitalSocial?: number): string => {
  if (opcaoMei) return 'MEI';
  const porte = (porteRF || '').toLowerCase().trim();
  if (porte === 'microempresa' || porte === 'me') return 'ME';
  if (porte.includes('pequeno porte') || porte === 'epp') return 'EPP';
  if (porte === 'demais' || porte.includes('demais')) {
    if (capitalSocial && capitalSocial >= 50000000) return 'Grande Porte';
    return 'Médio Porte';
  }
  if (porte === 'mei') return 'MEI';
  if (porte === 'médio porte' || porte === 'medio porte') return 'Médio Porte';
  if (porte === 'grande porte' || porte === 'grande') return 'Grande Porte';
  return porteRF || '';
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const n = value.trim().toLowerCase();
    return n === 'sim' || n === 'true' || n === 'yes';
  }
  return false;
};

const mapOpenCNPJAData = (data: OpenCNPJAResponse, cleanCnpj: string): CNPJData => {
  const rawPorte = data.company?.size?.text || '';
  const opcaoMei = data.company?.simei?.optant || false;
  const capitalSocial = data.company?.equity ? parseFloat(data.company.equity) : undefined;
  return {
    cnpj: data.taxId || cleanCnpj,
    razao_social: data.company?.name || data.alias || '',
    nome_fantasia: data.alias || data.company?.name || '',
    natureza_juridica: data.company?.nature?.text || '',
    porte: normalizePorte(rawPorte, opcaoMei, capitalSocial),
    capital_social: capitalSocial,
    situacao_cadastral: data.status?.text || '',
    data_situacao_cadastral: data.status?.date || '',
    data_fundacao: data.founded || '',
    cnae_principal: data.mainActivity ? { codigo: data.mainActivity.id || '', descricao: data.mainActivity.text || '' } : undefined,
    cnaes_secundarios: data.sideActivities?.map((a: any) => ({ codigo: String(a.id || ''), descricao: a.text || '' })) || [],
    logradouro: data.address?.street || '',
    numero: data.address?.number || '',
    complemento: data.address?.details || '',
    bairro: data.address?.district || '',
    cidade: data.address?.city || '',
    uf: data.address?.state || '',
    cep: data.address?.zip?.replace(/\D/g, '') || '',
    telefones: data.phones?.map((p: any) => p.number).filter(Boolean) || [],
    email: data.emails?.[0]?.address || '',
    opcao_simples: data.company?.simples?.optant || false,
    opcao_mei: opcaoMei,
    matriz_filial: data.head ? 'Matriz' : 'Filial',
    qsa: data.members?.map((m: any) => ({
      nome: m.person?.name || m.name || '',
      qualificacao: m.role?.text || '',
      cpf_cnpj: m.person?.taxId || '',
      faixa_etaria: m.person?.age || '',
      data_entrada: m.since || '',
    })) || [],
  };
};

const mapBrasilAPIData = (data: BrasilAPIResponse, cleanCnpj: string): CNPJData => {
  const capitalSocial = typeof data.capital_social === 'number' ? data.capital_social : Number.parseFloat(String(data.capital_social || '')) || undefined;
  const opcaoMei = toBoolean(data.opcao_pelo_mei);
  return {
    cnpj: data.cnpj || cleanCnpj,
    razao_social: data.razao_social || data.nome_fantasia || '',
    nome_fantasia: data.nome_fantasia || data.razao_social || '',
    natureza_juridica: data.natureza_juridica || '',
    porte: normalizePorte(data.porte || data.descricao_porte, opcaoMei, capitalSocial),
    capital_social: capitalSocial,
    situacao_cadastral: data.descricao_situacao_cadastral || data.situacao_cadastral || '',
    data_situacao_cadastral: data.data_situacao_cadastral || '',
    data_fundacao: data.data_inicio_atividade || '',
    cnae_principal: data.cnae_fiscal ? { codigo: String(data.cnae_fiscal), descricao: data.cnae_fiscal_descricao || '' } : undefined,
    cnaes_secundarios: data.cnaes_secundarios?.map((a: any) => ({ codigo: String(a.codigo || ''), descricao: a.descricao || '' })) || [],
    logradouro: data.logradouro || '',
    numero: data.numero || '',
    complemento: data.complemento || '',
    bairro: data.bairro || '',
    cidade: data.municipio || '',
    uf: data.uf || '',
    cep: String(data.cep || '').replace(/\D/g, ''),
    telefones: [data.ddd_telefone_1, data.ddd_telefone_2].filter(Boolean).map(String),
    email: data.email || '',
    opcao_simples: toBoolean(data.opcao_pelo_simples),
    opcao_mei: opcaoMei,
    matriz_filial: data.descricao_identificador_matriz_filial || '',
    qsa: data.qsa?.map((m: any) => ({
      nome: m.nome_socio || '',
      qualificacao: m.qualificacao_socio || '',
      cpf_cnpj: m.cnpj_cpf_do_socio || '',
      faixa_etaria: m.faixa_etaria || '',
      data_entrada: m.data_entrada_sociedade || '',
    })) || [],
  };
};

const fetchWithTimeout = async (url: string, timeoutMs = 10000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    const contentType = response.headers.get('content-type') || '';
    const rawBody = await response.text();
    let body: unknown = rawBody;
    if (contentType.includes('application/json') && rawBody) {
      try { body = JSON.parse(rawBody); } catch { /* keep raw */ }
    }
    return { response, body };
  } finally {
    clearTimeout(timer);
  }
};

// ─── Supabase admin client (service_role) ──────────────────────

const getAdminClient = () => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key);
};

// ─── Cache operations ──────────────────────────────────────────

async function getCachedCNPJ(cnpj: string): Promise<{ data: CNPJData; stale: boolean } | null> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('cnpj_cache')
      .select('payload, expires_at')
      .eq('cnpj', cnpj)
      .maybeSingle();
    if (error || !data) return null;
    const stale = new Date(data.expires_at) < new Date();
    return { data: data.payload as CNPJData, stale };
  } catch (e) {
    console.warn('[lookup-cnpj] Cache read failed:', e);
    return null;
  }
}

async function setCachedCNPJ(cnpj: string, payload: CNPJData, provider: string) {
  try {
    const admin = getAdminClient();
    const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await admin.from('cnpj_cache').upsert({
      cnpj,
      payload,
      provider,
      fetched_at: new Date().toISOString(),
      expires_at: expiresAt,
      last_error: null,
      last_error_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'cnpj' });
  } catch (e) {
    console.warn('[lookup-cnpj] Cache write failed:', e);
  }
}

async function setCacheError(cnpj: string, errorMsg: string) {
  try {
    const admin = getAdminClient();
    // Only update if row exists
    await admin.from('cnpj_cache').update({
      last_error: errorMsg,
      last_error_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('cnpj', cnpj);
  } catch { /* best effort */ }
}

// ─── Provider fetching ─────────────────────────────────────────

async function fetchFromProviders(cleanCnpj: string): Promise<{ data: CNPJData; provider: string } | { error: string; retryable: boolean }> {
  // Provider 1: OpenCNPJA
  try {
    const result = await fetchWithTimeout(`https://open.cnpja.com/office/${cleanCnpj}`, 12000);
    if (result.response.ok) {
      return { data: mapOpenCNPJAData(result.body as OpenCNPJAResponse, cleanCnpj), provider: 'open.cnpja' };
    }
    if (result.response.status === 404) {
      return { error: 'CNPJ não encontrado na base de dados da Receita Federal', retryable: false };
    }
    console.warn(`[lookup-cnpj] OpenCNPJ ${result.response.status}, trying fallback`);
  } catch (e) {
    console.warn('[lookup-cnpj] OpenCNPJ timeout/error:', e);
  }

  // Provider 2: BrasilAPI
  try {
    const result = await fetchWithTimeout(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, 12000);
    if (result.response.ok) {
      return { data: mapBrasilAPIData(result.body as BrasilAPIResponse, cleanCnpj), provider: 'brasilapi' };
    }
    if (result.response.status === 404) {
      return { error: 'CNPJ não encontrado na base de dados da Receita Federal', retryable: false };
    }
    console.warn(`[lookup-cnpj] BrasilAPI ${result.response.status}`);
  } catch (e) {
    console.warn('[lookup-cnpj] BrasilAPI timeout/error:', e);
  }

  return { error: 'Serviços de consulta temporariamente indisponíveis. Tente novamente em alguns instantes.', retryable: true };
}

// ─── Main handler ──────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();
    if (!cnpj) throw new Error('CNPJ é obrigatório');

    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) throw new Error('CNPJ inválido. Deve conter 14 dígitos.');

    console.log(`[lookup-cnpj] Buscando CNPJ: ${cleanCnpj}`);

    // 1. Check cache first
    const cached = await getCachedCNPJ(cleanCnpj);
    if (cached && !cached.stale) {
      console.log(`[lookup-cnpj] cache_hit=true stale=false cnpj=${cleanCnpj}`);
      return new Response(JSON.stringify({ ...cached.data, _source: 'cache' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 2. Fetch from providers
    const result = await fetchFromProviders(cleanCnpj);

    if ('data' in result) {
      // Success — save to cache and return
      console.log(`[lookup-cnpj] provider=${result.provider} cnpj=${cleanCnpj}`);
      await setCachedCNPJ(cleanCnpj, result.data, result.provider);
      return new Response(JSON.stringify({ ...result.data, _source: result.provider }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 3. Provider failed — use stale cache if available
    if (cached && cached.stale) {
      console.log(`[lookup-cnpj] stale_fallback=true cnpj=${cleanCnpj} reason="${result.error}"`);
      await setCacheError(cleanCnpj, result.error);
      return new Response(JSON.stringify({ ...cached.data, _source: 'cache_stale' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 4. No cache, no provider — real failure
    throw new Error(result.error);

  } catch (error) {
    console.error('[lookup-cnpj] Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro ao buscar CNPJ' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
});
