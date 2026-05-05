## Diagnóstico (forense, baseado em logs reais)

Confirmado pelos logs do Postgres (últimos 5 min) e pelo console:

1. **Timeout em `GET /opportunities?select=...account...contact...`** (HTTP 400 / “canceling statement due to statement timeout”). É a query que carrega o Pipeline.
2. **`get_unified_won_revenue_v2` cancelada** (mesmo motivo) → Dashboard cai pro fallback legacy.
3. **`get-current-user` retornando 401 em loop** (8+ chamadas seguidas) → loop de refresh/retry no `useCurrentUser`.
4. Erros colaterais reincidentes: `column sellers.team_id does not exist`, `column "completed_at" of relation "playbook_runs" does not exist`, `proposal_alerts_alert_type_check` violado.

### Causa raiz #1 — RLS de “acesso público via proposal token” penalizando todo acesso autenticado

As tabelas `opportunities`, `accounts` e `contacts` têm **duas** policies SELECT empilhadas:

- `opportunities_select_by_visibility` (authenticated)
- `Public access to ... via proposal token` (anon) — faz `EXISTS (SELECT 1 FROM proposals p WHERE p.opportunity_id = opportunities.id AND p.public_token IS NOT NULL AND p.status IN (...))`

Postgres aplica policies do mesmo comando com **OR**, então o `EXISTS` no `proposals` é avaliado pra **cada linha** mesmo em request autenticado. Em `accounts`/`contacts` é pior: o EXISTS faz JOIN `opportunities × proposals`. Quando a query é o pipeline (753 opps + lateral join em accounts/contacts), explode o tempo de planning/execução até bater o `statement_timeout`.

### Causa raiz #2 — `listOpportunities` carrega tudo, sem paginação

`src/services/supabase/opportunities.ts:25` faz:
- `select('*, account:accounts(...), contact:contacts(...)', { count: 'exact' })`
- `.is('deleted_at', null)`
- **sem** filtro por `organization_id`, **sem** `range/limit`, **sem** índice usado pra ordenação (`created_at DESC` força top-N sort).

Com `count: 'exact'` PostgREST roda também um `count(*)` no full set, dobrando o trabalho. Combine isso com a RLS acima e você tem o timeout reproduzível.

### Causa raiz #3 — `get-current-user` em loop 401

Em `useCurrentUser.fetchCurrentUser`, quando a edge devolve 401 a gente chama `auth.refreshSession()` e re-invoca a função. Se o refresh devolve session mas o JWT ainda não propagou para a edge (race), volta 401 → próximo render dispara a query de novo (5 min stale, mas sem dados retorna sempre). O `retry: 2` da query soma mais 2 chamadas. Resultado: cascata visível no console (8+ POSTs 401).

---

## Plano de correção

### 1) RLS — eliminar custo do acesso público em sessões autenticadas

Migração SQL:

- Trocar as 3 policies `Public access to ... via proposal token` (em `opportunities`, `accounts`, `contacts`) para **só valer pro role `anon`** explicitamente: `TO anon` + `USING (auth.uid() IS NULL AND EXISTS(...))`. Hoje elas são `{anon}` mas o planner ainda OR-eia os USING entre policies do mesmo comando — adicionar o guard `auth.uid() IS NULL` faz o planner descartar o branch em sessões autenticadas (curto-circuito barato).
- Garantir que as policies authenticated (`opportunities_select_by_visibility`, `Users view org accounts`, `Users can view org contacts` / `Users view contacts by role and account`) tenham `TO authenticated`.

Resultado esperado: planner remove o `EXISTS proposals` para qualquer chamada com JWT.

### 2) `listOpportunities` — paginar e tirar `count: 'exact'`

Em `src/services/supabase/opportunities.ts`:

- Adicionar parâmetros `limit` (default 200) e `offset` e aplicar `.range(offset, offset+limit-1)`.
- Trocar `count: 'exact'` → `count: 'estimated'` (ou remover; a UI não precisa do total real para o Kanban).
- Filtrar explicitamente por `organization_id` quando disponível (vindo do `useCurrentUser`) — RLS continua, mas o planner usa `idx_opportunities_org_deleted`.
- Manter ordenação `created_at DESC` mas reduzir colunas embutidas: `accounts(razao_social, nome_fantasia)` e `contacts(nome)` no Kanban (lead_score/fit_score/etc só na tela de detalhe).

Atualizar o(s) hook(s) consumidores (`useOpportunities`, kanban) para passar os novos parâmetros. Sem mudança visual.

### 3) `get-current-user` — quebrar o loop 401

- No `useCurrentUser`: se o `retry` silencioso após `refreshSession` ainda voltar 401, **não retornar `null` (que dispara nova query no próximo render)** — marcar a query com `throwOnError` controlado e desativar `enabled` por uma janela curta (ex. 30s) via state local. Já temos `staleTime: 5min`, mas como o resultado é `null`, a query não fica “successful with data”.
- Reduzir `retry` global da query de 2 → 0 para erros não-rede (já evitamos 401, mas qualquer 500 também repete 3×).
- Na edge `get-current-user`: cobrir o caso “Auth session missing” com `Cache-Control: no-store` em respostas 401 (hoje o 401 não tem header) e devolver corpo `{ error: 'unauthenticated' }` consistente para o cliente parar o loop.

### 4) Limpezas colaterais (rápidas)

- `sellers.team_id` não existe → identificar a edge function que faz esse SELECT (provavelmente `calculate-account-scores` ou correlata) e remover/ajustar para `team_members.team_id`.
- `playbook_runs.completed_at` → trocar por `finished_at` no caller restante.
- `proposal_alerts_alert_type_check` violado → conferir os valores aceitos pelo CHECK e ajustar o emissor (provavelmente edge `proposal-alerts-monitor`) para usar um dos enums válidos.

Esses 3 não causam a lentidão, mas geram ruído nos logs e mascaram o sinal.

---

## Arquivos impactados

- `supabase/migrations/<nova>.sql` (RLS hardening + `TO anon` guards).
- `src/services/supabase/opportunities.ts` (paginação, colunas reduzidas, org filter).
- `src/hooks/useOpportunities.ts` (passar `limit/offset`).
- `src/hooks/useCurrentUser.ts` (retry/loop break).
- `supabase/functions/get-current-user/index.ts` (headers/erros).
- 3 edges com colunas inválidas (a localizar com `rg` antes do patch).

## Riscos

- Mudar RLS é sensível: vamos manter o comportamento funcional (anon com token continua lendo). O guard `auth.uid() IS NULL` só desliga o branch para quem JÁ é authenticated.
- Paginar Kanban: precisa confirmar se algum lugar dependia do `count` exato. Verificar antes de alterar.
- `useCurrentUser`: cobrir bem o caso “sessão recém-renovada” para não bloquear login legítimo.

## Próximos passos

Aprove e eu aplico nessa ordem: (a) migração RLS, (b) paginação `listOpportunities`, (c) loop-break `get-current-user`, (d) limpezas de colunas. Cada passo é independente — se algo regressar, rollback é isolado.
