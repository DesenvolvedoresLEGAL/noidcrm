import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    // Consultar API OpenCNPJ
    const apiUrl = `https://open.cnpja.com/office/${cleanCnpj}`;
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('CNPJ não encontrado na base de dados da Receita Federal');
      }
      throw new Error(`Erro ao consultar CNPJ: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[lookup-cnpj] Dados recebidos da API OpenCNPJ');

    // Extract raw values
    const rawPorte = data.company?.size?.text || '';
    const opcaoMei = data.company?.simei?.optant || false;
    const capitalSocial = data.company?.equity ? parseFloat(data.company.equity) : undefined;

    // Mapear dados da API para formato esperado
    const cnpjData: CNPJData = {
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
        codigo: activity.id || '',
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

    console.log(`[lookup-cnpj] Dados processados com sucesso para CNPJ: ${cleanCnpj}, porte normalizado: ${cnpjData.porte}`);

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
