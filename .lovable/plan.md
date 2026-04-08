
## Plano de correção definitiva da consulta de CNPJ

### Diagnóstico forense
O problema não é só de interface. A causa raiz está no fluxo inteiro:

1. **A função `lookup-cnpj` depende só de 2 provedores públicos** (`open.cnpja` e `BrasilAPI`).
2. **Quando ambos devolvem 429 / Too Many Requests, a função falha de vez** e devolve 400 para o frontend.
3. **Não existe cache persistente interno**, então o mesmo CNPJ é consultado repetidamente e volta a bater no rate limit.
4. **Não existe deduplicação de requisição em andamento**, então múltiplos cliques/telas podem repetir a mesma busca.
5. **O tratamento está espalhado em 2 telas** (`AccountEditor` e `AccountModalTabs`), o que dificulta padronizar retry, feedback e bloqueio de chamadas repetidas.

Pelos logs, isso já aconteceu várias vezes com o mesmo CNPJ em sequência, então o erro real é de **resiliência insuficiente do serviço**, não apenas de mensagem de erro.

### Correção proposta
#### 1. Criar cache persistente de consulta de CNPJ
Adicionar uma tabela de cache no backend, por exemplo:
- `cnpj`
- `payload jsonb`
- `provider`
- `fetched_at`
- `expires_at`
- `last_error`
- `last_error_at`

Com isso:
- se o CNPJ já foi consultado recentemente, o sistema retorna do cache;
- se o provedor externo estiver indisponível, o sistema pode usar o **último cache válido** em vez de falhar.

#### 2. Reescrever a edge function `lookup-cnpj` para fluxo resiliente
A função passará a seguir esta ordem:
1. validar CNPJ;
2. procurar no cache;
3. se cache válido existir, retornar imediatamente;
4. se não existir, consultar provedor primário;
5. se falhar com 429/5xx, tentar fallback;
6. se fallback também falhar, retornar **cache anterior** (stale fallback) quando existir;
7. só falhar de verdade quando não houver nenhum dado utilizável.

Também vou incluir:
- timeout por provedor;
- logs melhores (`cache_hit`, `provider`, `fallback_used`, `stale_returned`);
- persistência do resultado bem-sucedido no cache.

#### 3. Bloquear chamadas duplicadas do mesmo CNPJ no frontend
Centralizar a busca em um fluxo único para:
- impedir nova consulta enquanto a anterior estiver rodando;
- aplicar cooldown curto para o mesmo CNPJ;
- evitar spam de clique no botão.

#### 4. Unificar o consumo nas telas de conta
Hoje `AccountEditor` e `AccountModalTabs` têm lógica parecida. Vou padronizar para ambos usarem o mesmo fluxo de consulta e o mesmo mapeamento de erros/sucesso.

#### 5. Melhorar a experiência quando o serviço externo estiver instável
Se o sistema estiver devolvendo dado em cache:
- mostrar sucesso normalmente;
- opcionalmente informar que os dados vieram de consulta anterior, sem bloquear o preenchimento.

Se não houver cache e ambos os provedores falharem:
- mostrar mensagem clara de indisponibilidade temporária, sem mensagem genérica/confusa.

### Arquivos a editar
- `supabase/functions/lookup-cnpj/index.ts`
- `src/services/crm/cnpj-lookup.ts`
- `src/pages/AccountEditor.tsx`
- `src/components/accounts/AccountModalTabs.tsx`
- `supabase/migrations/<nova_migration>.sql`

### Detalhes técnicos
- A edge function vai passar a usar cliente administrativo interno para ler/gravar cache.
- O cache deve ser indexado por `cnpj` com unicidade.
- TTL sugerido: 7 a 30 dias.
- Em erro 429/5xx, o comportamento será **stale-if-error**.
- Não vou depender de refresh manual nem de nova tentativa do usuário para preencher dados já conhecidos.

### Resultado esperado
- Consultas repetidas do mesmo CNPJ deixam de quebrar por rate limit.
- Mesmo com instabilidade dos provedores, o CRM continua preenchendo automaticamente sempre que já houver dado consultado antes.
- A experiência fica consistente nas duas telas de conta.
- O erro “Too Many Requests” deixa de bloquear o usuário na maior parte dos casos.
