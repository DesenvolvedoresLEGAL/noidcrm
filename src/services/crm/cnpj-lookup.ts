import { supabase } from '@/integrations/supabase/client';
import { 
  FunctionsHttpError, 
  FunctionsRelayError, 
  FunctionsFetchError 
} from '@supabase/supabase-js';

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
    
    // Tratamento específico para cada tipo de erro do Supabase Functions
    if (error instanceof FunctionsHttpError) {
      // Edge Function retornou erro HTTP (ex: 400, 404, 500)
      // O corpo da resposta está em error.context
      try {
        const errorBody = await error.context.json();
        throw new Error(errorBody.error || 'Erro ao buscar dados do CNPJ');
      } catch (parseError) {
        // Se não conseguir fazer parse do JSON, usar mensagem genérica
        if (parseError instanceof Error && parseError.message !== 'Erro ao buscar dados do CNPJ') {
          throw new Error('Erro ao buscar dados do CNPJ');
        }
        throw parseError;
      }
    } else if (error instanceof FunctionsRelayError) {
      throw new Error('Serviço temporariamente indisponível. Tente novamente.');
    } else if (error instanceof FunctionsFetchError) {
      throw new Error('Erro de conexão. Verifique sua internet.');
    }
    
    throw new Error(error.message || 'Erro ao buscar dados do CNPJ');
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