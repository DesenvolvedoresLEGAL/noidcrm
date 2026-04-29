## Sprint Scoring 1.1 — Auto-Recalculate Lead Score

Recalcular Lead Score automaticamente quando dados relevantes da conta/contato/oportunidade/atividade mudarem, e propagar via realtime para todas as telas que mostram score, sem hard refresh.

### Mapeamento ao schema real do NOID

Antes de tudo, traduzir os nomes do briefing para o schema atual:

- `companies` → **`accounts`**
- `contacts` → **`contacts`**
- `deals` → **`opportunities`**
- `tenant_id` → **`organization_id`**
- Campos da conta: `legal_name`→`razao_social`, `trade_name`→`nome_fantasia`, `tax_id`/`cnpj`→`cnpj`, `segment`→`segmento`, `company_size`→`porte`/`tamanho`, `city`→`cidade`, `state`→`uf`, `cnae`→`cnae` etc.
- Score já vive em `accounts.fit_score`, `accounts.intent_score`, `accounts.lead_score`, `accounts.lead_grade`, `accounts.score_updated_at`.
- Já existe edge function `calculate-account-scores` (modo `accountId`) que faz exatamente FIT + INTENT + persiste no `accounts`.
- Já existe tabela `score_history` (reutilizar — não criar `lead_score_history` duplicada).
- Já existe `score_recalc_jobs` para batch — manter.

A sprint **NÃO altera fórmula nem cria tabela duplicada**: reutiliza o que existe e adiciona apenas a fila de eventos + triggers + realtime + invalidação centralizada.

---

### Parte 1 — Banco (1 migration)

**Nova tabela `lead_score_recalc_queue`** (fila de eventos, distinta de `score_recalc_jobs` que é batch admin):

```text
id uuid pk default gen_random_uuid()
organization_id uuid not null
account_id uuid not null references accounts(id) on delete cascade
trigger_source text not null  -- 'accounts'|'contacts'|'opportunities'|'activities'|'manual'
trigger_action text not null  -- 'insert'|'update'|'delete'
status text not null default 'pending'  -- pending|processing|completed|failed|skipped
error_message text
created_at timestamptz default now()
processed_at timestamptz
```

Índices: `(organization_id, account_id, status)`, `(status, created_at)`, `(account_id, created_at desc)`.
RLS: `SELECT` para membros da org via `is_active_org_member`; `INSERT/UPDATE` apenas service role (triggers e edge functions usam service role).

**Função `enqueue_lead_score_recalc()`** (SECURITY DEFINER, `search_path=public`):

- Resolve `organization_id` e `account_id` a partir da `TG_TABLE_NAME` e `NEW`/`OLD`:
  - `accounts`: direto.
  - `contacts`: usa `NEW.account_id`.
  - `opportunities`: usa `NEW.account_id`.
  - `activities`: usa `NEW.account_id` (se NULL, sai sem enfileirar).
- **Debounce**: se já existe linha `pending` para o mesmo `(organization_id, account_id, trigger_source)` criada nos últimos 2 minutos, retorna sem inserir.
- Se relevante, insere `pending`.

**Triggers `AFTER INSERT/UPDATE/DELETE`** com `WHEN` nos campos relevantes:

- `accounts`: `razao_social, nome_fantasia, cnpj, segmento, tamanho, porte, capital_social, cidade, uf, type, status, owner_id, telefones, emails, cnae, tags`.
- `contacts`: `name, email, telefone, cargo, is_primary, account_id`.
- `opportunities`: `stage_id, status, valor_previsto, probabilidade, expected_close_date, won_at, lost_at, account_id`.
- `activities`: `status, type, completed_at, due_at, account_id`.

Triggers apenas enfileiram — zero cálculo síncrono — para não atrasar saves.

---

### Parte 2 — Edge Functions

**Reusar** `calculate-account-scores` (modo `accountId`) como o "recalculator". Apenas adicionar:

1. Espelhar `lead_score` e `lead_grade` em `accounts` no final do `processAccount` (hoje grava `fit_score`/`intent_score`/`scoring_factors` mas não `lead_score`/`lead_grade`/`score_updated_at`).
2. Inserir snapshot em `score_history` com `previous_*` e `new_*` (`fit`, `intent`, `lead` consolidado) — reutilizar formato existente, adicionando entrada `kind='lead'`.

**Nova edge function `process-lead-score-queue`**:

- Chamada pelo cron a cada 1 min e também invocada pelo frontend para flushing imediato (best-effort).
- `SELECT … FOR UPDATE SKIP LOCKED LIMIT 50` em `lead_score_recalc_queue` onde `status='pending'`.
- Marca `processing`, deduplica por `account_id` (1x por ciclo), invoca `calculate-account-scores` com `{ accountId }`.
- Marca `completed` ou `failed` com `error_message`.
- Idempotente.

Cron: `pg_cron` `* * * * *` chamando `process-lead-score-queue` (via `net.http_post`).

---

### Parte 3 — Frontend: recálculo imediato + invalidação centralizada

**`src/lib/scoring/invalidateScoreQueries.ts`** (novo helper):

```text
invalidateScoreRelatedQueries(queryClient, { organizationId, accountId })
```

Invalida (mapeando para chaves reais já em `src/lib/query-keys.ts` — `accountKeys.detail`, `accountKeys.scoring`, `accountKeys.scoringLite`, `opportunityKeys.*`, `pipelineKeys.*`) e também:
`['lead-score-ai', accountId]`, `['scoring']`, `['scoring-dashboard']`, `['lead-scoring']`, `['account-opportunities', accountId]`.

**`useAccountScoring.recalculate`** já existe e chama `calculate-account-scores`. Estender o `onSuccess` para usar o helper acima (hoje só invalida 3 chaves).

**Hook `updateAccount`** (no fluxo de save da edição da conta): após `updateAccount` resolver, disparar:

1. `supabase.functions.invoke('calculate-account-scores', { body: { accountId } })` (fire-and-forget, não bloqueia UI).
2. Em `onSuccess` da invocação → `invalidateScoreRelatedQueries`.

Não esperar o cron para a tela do usuário que acabou de salvar.

---

### Parte 4 — Realtime

Habilitar `REPLICA IDENTITY FULL` e adicionar `accounts` à publication `supabase_realtime` (se ainda não estiver — verificar antes).

**Novo hook `useLeadScoreRealtime(accountId)`**:

- Subscreve `postgres_changes` UPDATE em `accounts` filtrado por `id=eq.{accountId}`.
- Em mudança de `lead_score`, `fit_score`, `intent_score` ou `lead_grade` → `invalidateScoreRelatedQueries`.

**Novo hook `useScoringRealtime(organizationId)`** (para Pipeline / Scoring Hub / Dashboard):

- Subscreve UPDATE em `accounts` filtrado por `organization_id=eq.{orgId}`.
- Em mudança dos 4 campos de score → invalida `['scoring']`, `['scoring-dashboard']`, `['pipeline']`, `['opportunities']`, `accountKeys.scoringLite(id)` para o `id` mudado.

Usar nas páginas: `Scoring.tsx`, `Pipeline`, `OpportunityDetail`, `AccountDetail` sidebar.

---

### Parte 5 — Componentes consumindo fonte única

Auditar e padronizar os componentes que hoje leem score para todos consumirem `accounts.lead_score`/`fit_score`/`intent_score`/`lead_grade` (sem cálculo local):

- `AccountSidebar.tsx`, `AccountCard.tsx`, `OpportunityCard.tsx`, `SidebarDataSection.tsx`, `LeadScoreTable.tsx`, `ScoringDashboard.tsx`, `LeadScoreInsights.tsx`, `ScoreBreakdownCard.tsx`.
- Onde houver fórmula local (`fit*0.4+intent*0.6`), substituir por `account.lead_score` direto. Se faltar, calcular UMA vez em `useAccountScore` e expor.

Atualizar `useAccountScore` / `useAccountScoring` para incluir `lead_score`, `lead_grade`, `score_updated_at` (hoje `useAccountScore` já busca; `useAccountScoring` não busca `lead_score` — adicionar).

---

### Parte 6 — Estados de UI

- Durante `isRecalculating` (já existe no hook): badge sutil "Atualizando score…" no `AccountSidebar` LeadScoreCard.
- Em erro: toast discreto + tooltip "Não foi possível atualizar o score agora. Último score válido mantido." Tela não quebra (silenciar erro de invoke não-bloqueante).

---

### Critérios de aceite (espelhando o briefing)

1–15: cobertos por triggers (1–5), realtime + invalidação (6–10), `score_history` (11), debounce 2 min (12), trigger só enfileira (13), RLS por `organization_id` em fila e history (14–15).

---

### Fora de escopo

Fórmula geral, novo modelo preditivo, refactor visual, Opportunity Score, Account Score novo.

---

### Arquivos impactados (resumo)

**Migration nova**: `lead_score_recalc_queue` + `enqueue_lead_score_recalc()` + 4 triggers + cron.
**Edge functions**: editar `calculate-account-scores/index.ts` (gravar `lead_score`/`lead_grade`/`score_updated_at` + `score_history`); criar `process-lead-score-queue/index.ts`.
**Frontend**:
- novo `src/lib/scoring/invalidateScoreQueries.ts`
- novo `src/hooks/scoring/useLeadScoreRealtime.ts`
- novo `src/hooks/scoring/useScoringRealtime.ts`
- editar `src/hooks/useAccountScoring.ts` (incluir `lead_score`/`lead_grade` + invalidação ampliada)
- editar serviço/hook de update de conta (`src/services/supabase/accounts.ts` consumers) para disparar recálculo imediato
- editar `AccountSidebar.tsx` (estado "Atualizando score…")
- montar `useScoringRealtime` em `Scoring.tsx`, página de Pipeline e detalhe da Oportunidade

### Riscos

- Triggers em `activities` podem gerar muito tráfego: debounce de 2 min mitiga.
- Realtime em `accounts` org-wide pode ser "barulhento" em orgs grandes: filtrar payload no cliente para apenas updates dos 4 campos de score antes de invalidar.
- `score_history` tem schema atual diferente (`kind`/`previous_value`/`new_value`); validar colunas antes de inserir snapshot consolidado.
