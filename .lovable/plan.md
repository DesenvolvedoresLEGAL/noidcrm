
## Correção: Erro ao buscar CNPJ

### Problema Identificado

O Supabase SDK trata respostas com status não-2xx de uma forma específica:
- Quando a Edge Function retorna status 400, o SDK cria um objeto `FunctionsHttpError`
- A mensagem do erro (`error.message`) é genérica: "Edge Function returned a non-2xx status code"
- O **corpo real da resposta** (com a mensagem específica como "CNPJ não encontrado") está em `error.context.json()`

Atualmente, o código tenta ler `data?.error` ou `error.message`, mas quando há erro HTTP:
- `data` pode estar `undefined`
- `error.message` é a mensagem genérica do SDK

### Solução

Modificar o arquivo `src/services/crm/cnpj-lookup.ts` para:

1. Importar os tipos de erro do Supabase: `FunctionsHttpError`, `FunctionsRelayError`, `FunctionsFetchError`
2. Verificar o tipo do erro usando `instanceof`
3. Para `FunctionsHttpError`, extrair o corpo usando `error.context.json()`
4. Retornar a mensagem específica (ex: "CNPJ não encontrado na base de dados da Receita Federal")

### Código Atualizado

```typescript
import { supabase } from '@/integrations/supabase/client';
import { 
  FunctionsHttpError, 
  FunctionsRelayError, 
  FunctionsFetchError 
} from '@supabase/supabase-js';

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
        throw new Error('Erro ao buscar dados do CNPJ');
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

  if (data.error) {
    throw new Error(data.error);
  }

  return data as CNPJData;
}
```

### Arquivo a Alterar

- `src/services/crm/cnpj-lookup.ts`

### Resultado Esperado

- Quando CNPJ não for encontrado: toast mostrará "CNPJ não encontrado na base de dados da Receita Federal"
- Quando houver erro de conexão: toast mostrará "Erro de conexão. Verifique sua internet."
- Quando o serviço estiver indisponível: toast mostrará "Serviço temporariamente indisponível."
