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
  _source?: string;
}

// ─── In-flight dedup ───────────────────────────────────────────
const inflight = new Map<string, Promise<CNPJData>>();

export async function lookupCNPJ(cnpj: string): Promise<CNPJData> {
  const clean = cnpj.replace(/\D/g, '');
  
  // Return existing in-flight request for same CNPJ
  const existing = inflight.get(clean);
  if (existing) {
    console.log('[cnpj-lookup] Dedup: reusing in-flight request for', clean);
    return existing;
  }

  const promise = _doLookup(clean);
  inflight.set(clean, promise);

  try {
    return await promise;
  } finally {
    inflight.delete(clean);
  }
}

async function _doLookup(cleanCnpj: string): Promise<CNPJData> {
  const { data, error } = await supabase.functions.invoke('lookup-cnpj', {
    body: { cnpj: cleanCnpj },
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

    const directMessage = extractMessage(data);
    if (directMessage) throw new Error(directMessage);

    const ctx = (error as any)?.context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const errorBody = await ctx.json();
        const contextMessage = extractMessage(errorBody);
        if (contextMessage) throw new Error(contextMessage);
      } catch (e) {
        if (e instanceof Error && e.message !== '[cnpj-lookup]') throw e;
      }
    }
    
    if (error instanceof FunctionsHttpError) {
      try {
        const errorBody = await error.context.json();
        throw new Error(extractMessage(errorBody) || 'Erro ao buscar dados do CNPJ');
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message !== 'Erro ao buscar dados do CNPJ') throw parseError;
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

  if (data.error) {
    throw new Error(data.error);
  }

  return data as CNPJData;
}
