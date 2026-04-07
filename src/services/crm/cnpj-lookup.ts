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

  const extractMessage = (payload: unknown): string | null => {
    if (!payload) return null;
    if (typeof payload === 'string' && payload.trim()) return payload;
    if (typeof payload === 'object') {
      const message = (payload as any)?.error || (payload as any)?.message;
      if (typeof message === 'string' && message.trim()) return message;
    }
    return null;
  };

  if (error) {
    console.error('[cnpj-lookup] Erro ao buscar CNPJ:', error);

    // Em alguns cenários o SDK retorna `data` mesmo com `error` (não-2xx)
    // então priorizamos a mensagem de erro vinda do body.
    const directMessage = extractMessage(data);
    if (directMessage) {
      throw new Error(directMessage);
    }

    // Fallback robusto: em builds algumas vezes `instanceof` pode falhar.
    // Se existir `error.context.json()`, é dali que vem a mensagem real.
    const ctx = (error as any)?.context;
    if (ctx && typeof ctx.json === 'function') {
      let contextMessage: string | null = null;
      try {
        const errorBody = await ctx.json();
        contextMessage = extractMessage(errorBody);
      } catch {
        // ignore e continua para os tratamentos abaixo
      }

      if (contextMessage) {
        throw new Error(contextMessage);
      }
    }
    
    // Tratamento específico para cada tipo de erro do Supabase Functions
    if (error instanceof FunctionsHttpError) {
      // Edge Function retornou erro HTTP (ex: 400, 404, 500)
      // O corpo da resposta está em error.context
      try {
        const errorBody = await error.context.json();
        throw new Error(extractMessage(errorBody) || 'Erro ao buscar dados do CNPJ');
      } catch (parseError) {
        throw new Error(extractMessage(error) || 'Erro ao buscar dados do CNPJ');
      }
    } else if (error instanceof FunctionsRelayError) {
      throw new Error('Serviço temporariamente indisponível. Tente novamente.');
    } else if (error instanceof FunctionsFetchError) {
      throw new Error('Erro de conexão. Verifique sua internet.');
    }
    
    throw new Error(extractMessage(error) || error.message || 'Erro ao buscar dados do CNPJ');
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