import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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
  cnae_principal?: {
    codigo: string;
    descricao: string;
  };
  cnaes_secundarios?: Array<{
    codigo: string;
    descricao: string;
  }>;
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

// Normalize porte to Brazilian standard values
const normalizePorte = (porteRF: string | undefined, opcaoMei: boolean, capitalSocial?: number): string => {
  if (opcaoMei) return 'MEI';
  
  const porte = (porteRF || '').toLowerCase().trim();
  
  // Microempresa
  if (porte === 'microempresa' || porte === 'me') return 'ME';
  
  // Empresa de Pequeno Porte
  if (porte.includes('pequeno porte') || porte === 'epp') return 'EPP';
  
  // For "Demais" (other sizes), use capital social as indicator
  if (porte === 'demais' || porte.includes('demais')) {
    if (capitalSocial && capitalSocial >= 50000000) return 'Grande Porte';
    if (capitalSocial && capitalSocial >= 4800000) return 'Médio Porte';
    return 'Médio Porte'; // Default for "Demais"
  }
  
  // Already normalized values
  if (porte === 'mei') return 'MEI';
  if (porte === 'médio porte' || porte === 'medio porte') return 'Médio Porte';
  if (porte === 'grande porte' || porte === 'grande') return 'Grande Porte';
  
  // Return original if not mapped
  return porteRF || '';
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'sim' || normalized === 'true' || normalized === 'yes';
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
    cnae_principal: data.mainActivity ? {
      codigo: data.mainActivity.id || '',
      descricao: data.mainActivity.text || '',
    } : undefined,
    cnaes_secundarios: data.sideActivities?.map((activity: any) => ({
      codigo: String(activity.id || ''),
      descricao: activity.text || '',
    })) || [],
    logradouro: data.address?.street || '',
    numero: data.address?.number || '',
    complemento: data.address?.details || '',
    bairro: data.address?.district || '',
    cidade: data.address?.city || '',
    uf: data.address?.state || '',
    cep: data.address?.zip?.replace(/\D/g, '') || '',
    telefones: data.phones?.map((phone: any) => phone.number).filter(Boolean) || [],
    email: data.emails?.[0]?.address || '',
    opcao_simples: data.company?.simples?.optant || false,
    opcao_mei: opcaoMei,
    matriz_filial: data.head ? 'Matriz' : 'Filial',
    qsa: data.members?.map((member: any) => ({
      nome: member.person?.name || member.name || '',
      qualificacao: member.role?.text || '',
      cpf_cnpj: member.person?.taxId || '',
      faixa_etaria: member.person?.age || '',
      data_entrada: member.since || '',
    })) || [],
  };
};

const mapBrasilAPIData = (data: BrasilAPIResponse, cleanCnpj: string): CNPJData => {
  const capitalSocial = typeof data.capital_social === 'number'
    ? data.capital_social
    : Number.parseFloat(String(data.capital_social || '')) || undefined;
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
    cnae_principal: data.cnae_fiscal ? {
      codigo: String(data.cnae_fiscal),
      descricao: data.cnae_fiscal_descricao || '',
    } : undefined,
    cnaes_secundarios: data.cnaes_secundarios?.map((activity: any) => ({
      codigo: String(activity.codigo || ''),
      descricao: activity.descricao || '',
    })) || [],
    logradouro: data.logradouro || '',
    numero: data.numero || '',
    complemento: data.complemento || '',
    bairro: data.bairro || '',
    cidade: data.municipio || '',
    uf: data.uf || '',
    cep: String(data.cep || '').replace(/\D/g, ''),
    telefones: [data.ddd_telefone_1, data.ddd_telefone_2]
      .filter(Boolean)
      .map((phone) => String(phone)),
    email: data.email || '',
    opcao_simples: toBoolean(data.opcao_pelo_simples),
    opcao_mei: opcaoMei,
    matriz_filial: data.descricao_identificador_matriz_filial || '',
    qsa: data.qsa?.map((member: any) => ({
      nome: member.nome_socio || '',
      qualificacao: member.qualificacao_socio || '',
      cpf_cnpj: member.cnpj_cpf_do_socio || '',
      faixa_etaria: member.faixa_etaria || '',
      data_entrada: member.data_entrada_sociedade || '',
    })) || [],
  };
};

const fetchJson = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await response.json() : await response.text();

  return { response, body };
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();

    if (!cnpj) {
      throw new Error('CNPJ é obrigatório');
    }

    // Limpar CNPJ (remover pontuação)
    const cleanCnpj = cnpj.replace(/\D/g, '');

    if (cleanCnpj.length !== 14) {
      throw new Error('CNPJ inválido. Deve conter 14 dígitos.');
    }

    console.log(`[lookup-cnpj] Buscando CNPJ: ${cleanCnpj}`);

    let cnpjData: CNPJData | null = null;
    let selectedProvider = 'open.cnpja';

    const openCNPJUrl = `https://open.cnpja.com/office/${cleanCnpj}`;
    const openCNPJResult = await fetchJson(openCNPJUrl);

    if (openCNPJResult.response.ok) {
      console.log('[lookup-cnpj] Dados recebidos da API OpenCNPJ');
      cnpjData = mapOpenCNPJAData(openCNPJResult.body as OpenCNPJAResponse, cleanCnpj);
    } else if (openCNPJResult.response.status === 404) {
      throw new Error('CNPJ não encontrado na base de dados da Receita Federal');
    } else if (openCNPJResult.response.status === 429 || openCNPJResult.response.status >= 500) {
      console.warn(`[lookup-cnpj] OpenCNPJ indisponível (${openCNPJResult.response.status}). Tentando fallback BrasilAPI.`);

      const brasilAPIUrl = `https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`;
      const brasilAPIResult = await fetchJson(brasilAPIUrl);

      if (brasilAPIResult.response.ok) {
        selectedProvider = 'brasilapi';
        console.log('[lookup-cnpj] Dados recebidos da API BrasilAPI');
        cnpjData = mapBrasilAPIData(brasilAPIResult.body as BrasilAPIResponse, cleanCnpj);
      } else if (brasilAPIResult.response.status === 404) {
        throw new Error('CNPJ não encontrado na base de dados da Receita Federal');
      } else if (brasilAPIResult.response.status === 429) {
        throw new Error('Os serviços de consulta de CNPJ estão temporariamente sobrecarregados. Tente novamente em alguns instantes.');
      } else {
        const fallbackMessage = typeof brasilAPIResult.body === 'object'
          ? (brasilAPIResult.body?.message || brasilAPIResult.body?.error)
          : brasilAPIResult.body;
        throw new Error(fallbackMessage || 'Erro ao consultar CNPJ em múltiplos provedores');
      }
    } else {
      const primaryMessage = typeof openCNPJResult.body === 'object'
        ? (openCNPJResult.body?.message || openCNPJResult.body?.error)
        : openCNPJResult.body;
      throw new Error(primaryMessage || `Erro ao consultar CNPJ: ${openCNPJResult.response.statusText}`);
    }

    if (!cnpjData) {
      throw new Error('Nenhum dado retornado para o CNPJ informado');
    }

    console.log(`[lookup-cnpj] Dados processados para CNPJ: ${cleanCnpj}`);
    console.log(`[lookup-cnpj] Provedor selecionado: ${selectedProvider}`);
    console.log(`[lookup-cnpj] Porte normalizado: ${cnpjData.porte}`);
    console.log(`[lookup-cnpj] QSA encontrado: ${cnpjData.qsa?.length || 0} sócios`);
    if (cnpjData.qsa && cnpjData.qsa.length > 0) {
      cnpjData.qsa.forEach((socio, i) => {
        console.log(`[lookup-cnpj]   Sócio ${i + 1}: ${socio.nome} - ${socio.qualificacao}`);
      });
    }

    return new Response(JSON.stringify(cnpjData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[lookup-cnpj] Erro:', error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro ao buscar CNPJ',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
