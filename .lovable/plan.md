

## Plano: corrigir filtro de TAG na lista de Contas + bloco "Lead Score por TAG"

### Problema 1 — Filtro "Tag: Expositor" retorna 0 contas
A página `/app/accounts` já carrega todas as 3.861 contas (`page_size: 10000`) e depois chama `useAccountTagsBulk(accountIds)` para puxar `account_tags` via `.in('account_id', [...3861 ids])`.

Causa real: o PostgREST aplica internamente um limite padrão de 1.000 linhas por resposta. Mesmo que existam 1.343 vínculos para "Expositor", a query retorna apenas as primeiras ~1.000 linhas no total (somando todas as tags de todas as contas), então a maioria dos accounts marcados como Expositor recebe `tagsByAccount[id] = undefined` no client e o `.some(...)` do filtro falha.

Prova: a tela de gestão de Tags conta corretamente 1.343 (lá usamos `select('tag_id').in('tag_id', [tagId])` com poucos IDs e o filtro é direto em `tag_id`, não retorna milhares de rows).

### Correção — Filtro server-side por tag (não filtrar no client a partir de bulk)

Mudar a estratégia quando `tagFilter !== 'all'`:

1. Em `src/services/supabase/account-tags.ts`, adicionar:
   - `getAccountIdsByTag(tagId: string): Promise<Set<string>>` — faz `select('account_id').eq('tag_id', tagId)` paginado de 1.000 em 1.000 até esgotar. Retorna o `Set<string>` com todos os account_ids vinculados.
2. Em `src/hooks/useAccountTags.ts`, expor `useAccountIdsByTag(tagId)` (React Query, `staleTime: 30s`).
3. Em `src/pages/Accounts.tsx`:
   - Quando `tagFilter !== 'all'`, usar `useAccountIdsByTag(tagFilter)` e filtrar `accounts` por `accountIdsSet.has(account.id)` em vez de `tagsByAccount[id].some(...)`.
   - Manter `useAccountTagsBulk` apenas para exibir os badges nos cards. **Adicionalmente paginar** o bulk dentro do service (chunks de 500 ids, agregando resultado) para que os badges também apareçam corretamente em listas grandes.

Resultado: o filtro "Expositor" passa a listar as 1.343 contas reais.

### Problema 2 — Falta bloco "Lead Score por TAG" no dashboard de Scoring

Adicionar componente novo análogo a `LeadScoreBySegment`, posicionado no dashboard `/app/scoring` (página Lead Scoring), abaixo do bloco já existente de "Lead Score por Segmento".

### Implementação do novo bloco

1. **Hook** `useLeadScoreByTag(orgId)` em `src/hooks/useLeadScoreByTag.ts`:
   - Query única que junta `account_tags` + `tags` + `accounts(lead_score)` por organização.
   - Estratégia eficiente: 1 SELECT em `account_tags` filtrando pela org, com `select('tag_id, tag:tags(id,name,color), account:accounts(id, lead_score, lead_grade, deleted_at)')`, paginado.
   - Agrega no client: `[{ tagId, name, color, count, averageScore }]` ordenado por `count` desc.
   - Exclui `accounts.deleted_at IS NOT NULL`.

2. **Componente** `LeadScoreByTag.tsx` em `src/components/scoring/lead/`:
   - Mesmo visual do `LeadScoreBySegment` (lista ranqueada com `#`, nome, count, badge de score).
   - Cada linha vira clicável → abre um Dialog com a lista de contas daquela tag (razão social + lead_score + lead_grade + link para a conta).
   - Dialog usa um segundo hook `useAccountsByTagWithScore(tagId)` que faz `select('id, razao_social, nome_fantasia, lead_score, lead_grade').in('id', accountIdsFromTag)` paginado.

3. **Integração** em `src/components/scoring/lead/LeadScoreDashboard.tsx`:
   - Trocar o grid de 2 colunas atual (`LeadScoreBySegment` + `LeadScoreInsights`) por um layout que acomode também `LeadScoreByTag`. Proposta: manter grid 2 colunas e mover `LeadScoreInsights` para baixo em linha cheia, ou usar 3 colunas em `xl`. Prefiro: linha 1 = Segment + Tag (lado a lado), linha 2 = Insights full-width.

### Arquivos impactados

**Editados:**
- `src/services/supabase/account-tags.ts` — adicionar `getAccountIdsByTag`, paginar `listAccountTagsBulk`.
- `src/hooks/useAccountTags.ts` — expor `useAccountIdsByTag`.
- `src/pages/Accounts.tsx` — usar o novo hook quando `tagFilter !== 'all'`.
- `src/components/scoring/lead/LeadScoreDashboard.tsx` — adicionar o bloco de Tag ao layout.

**Novos:**
- `src/hooks/useLeadScoreByTag.ts`
- `src/components/scoring/lead/LeadScoreByTag.tsx`
- `src/components/scoring/lead/LeadScoreByTagDialog.tsx` (modal com a lista de empresas)

### Riscos
- **Baixos.** Sem mudanças em RLS, schema ou dados. Apenas leitura paginada.
- Garantir paginação real (loop até `length < pageSize`) para não cair de novo no limite de 1.000 do PostgREST.
- Performance: o bloco "Lead Score por TAG" puxa `account_tags` da org inteira; com ~1.350 rows hoje é trivial. Cache via React Query (`staleTime: 30s`).

### Resultado esperado
- Filtro "Tag: Expositor" mostra as 1.343 contas corretamente.
- Badges de tag continuam aparecendo nos cards mesmo em listas grandes.
- Novo bloco "Lead Score por TAG" no dashboard Lead Scoring, ranqueando tags por nº de contas com média de score, e drill-down em modal listando todas as empresas + score + grade.

