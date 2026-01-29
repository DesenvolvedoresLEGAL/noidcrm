import { supabase } from '@/integrations/supabase/client';

export interface CNPJData {
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

export async function lookupCNPJ(cnpj: string): Promise<CNPJData> {
  const { data, error } = await supabase.functions.invoke('lookup-cnpj', {
    body: { cnpj },
  });

  if (error) {
    console.error('[cnpj-lookup] Erro ao buscar CNPJ:', error);
    
    // Supabase functions.invoke retorna o body de erro em data quando status não é 2xx
    // Tentar extrair a mensagem do erro do body da resposta
    const errorMessage = data?.error || error.message || 'Erro ao buscar dados do CNPJ';
    throw new Error(errorMessage);
  }

  if (!data) {
    throw new Error('Nenhum dado retornado para o CNPJ informado');
  }

  // Se a resposta contém um campo 'error', significa que a edge function retornou erro
  if (data.error) {
    throw new Error(data.error);
  }

  return data as CNPJData;
}