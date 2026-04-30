Entendi o problema e já encontrei a causa real: o erro 502 que aparece na UI está mascarando um erro 403 da Apollo. Nos logs da tabela de jobs, o endpoint `mixed_people/search` está respondendo:

```text
Apollo HTTP 403 (mixed_people/search): api/v1/mixed_people/search is not accessible with this api_key
```

Ou seja: o KAIRÓS ainda tenta primeiro `mixed_people/search`; como a chave atual não tem acesso a esse endpoint, a função retorna 502 antes de tentar `contacts/search`. Isso bloqueia a operação.

Plano de correção urgente:

1. Corrigir a estratégia de endpoints Apollo
   - Parar de tratar `403 API_INACCESSIBLE` em `mixed_people/search` como falha final.
   - Se `mixed_people/search` retornar 403/401/API_INACCESSIBLE, pular automaticamente para os endpoints disponíveis.
   - Usar `contacts/search` como fallback prioritário para buscar contatos quando People Search não estiver acessível.
   - Adicionar fallback adicional para endpoint de empresas/organizações, se necessário, usando domínio e nome da empresa para enriquecer dados corporativos.

2. Remover o 502 falso na experiência do usuário
   - A função não deve retornar 502 quando apenas um endpoint da Apollo estiver indisponível, se ainda houver outro endpoint possível.
   - O retorno só deve ser erro se todos os endpoints tentados falharem.
   - A resposta deve informar claramente `endpoint_used`, `fallbacks_used`, `contacts_found` e erro real da Apollo quando não houver resultado.

3. Melhorar tempo de resposta sem depender do plano rejeitado anteriormente
   - Manter uma primeira correção síncrona e segura para uso imediato da operação.
   - Reduzir chamadas sequenciais desnecessárias.
   - Inserir contatos em lote em vez de um por um.
   - Só rodar dedupe/primary depois do lote.
   - Limitar cada chamada Apollo com timeout curto para não travar a tela.

4. Ajustar frontend para erro operacional útil
   - Em `src/services/enrichment/apolloService.ts`, traduzir erros da função para mensagens claras.
   - Em `ProspectContactsTab`, trocar o toast genérico por algo como: “Endpoint Apollo X indisponível; tentei Y; nenhum contato retornado” ou “Contatos encontrados via contacts/search”.
   - Invalidar contatos e jobs após a chamada para refletir resultado imediatamente.

5. Validar com logs reais
   - Testar o fluxo contra a função `run-apollo-enrichment` usando um prospect real como `Tirolez`.
   - Conferir a tabela `enrichment_jobs` para confirmar que o novo job não fica como failed por causa de `mixed_people/search`.
   - Se `contacts/search` também falhar, expor exatamente o erro retornado pela Apollo para não mascarar como 502.

Arquivos impactados:

- `supabase/functions/run-apollo-enrichment/index.ts`
- `src/services/enrichment/apolloService.ts`
- `src/components/playbook/ProspectContactsTab.tsx`
- Possivelmente `src/hooks/useEnrichedContacts.ts` apenas para invalidação/estado se necessário.

Critério de sucesso:

- Clicar em “Confirmar enriquecimento” não retorna mais 502 por causa de `mixed_people/search` inacessível.
- Se a chave tiver acesso a `contacts/search`, os contatos são buscados e salvos.
- Se nenhum endpoint acessível retornar contato, a UI mostra uma mensagem clara com o endpoint tentado e o motivo real.
- O fluxo fica mais rápido por batch insert e timeout curto.