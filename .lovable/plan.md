# Análise Forense — Notificação Perdida (CANON MEDICAL → R$ 1.994,00)

## Linha do tempo do incidente

1. **11/05/2026 18:42:59 UTC** — Aline Cavalcante aceita a proposta `053419df-bd83-4941-9673-53b7e41b0a75` na página pública.
2. Trigger `on_proposal_accepted` (em `public.proposals`) dispara e enfileira o job em `acceptance_effect_jobs`:
   - `id = 66c9f722-110f-4f80-aaaa-1d1bf58feff1`
   - `status = pending`, `attempt_count = 0`
   - `notifications_processed_at = NULL`, `slack_processed_at = NULL`
3. Cliente (`ProposalPublicView` + `acceptProposal`/`updateProposal` em `src/services/supabase/proposals.ts`) faz **fire-and-forget** `supabase.functions.invoke('post-acceptance-effects', ...)`.
4. A edge function `post-acceptance-effects` exige `x-internal-secret = INTERNAL_WORKFLOW_SECRET` no header, retorna **401 Unauthorized**.
5. Como é fire-and-forget, o erro só vai para `console.error` no navegador do cliente externo. Nenhum retry. Job permanece `pending` para sempre.
6. Não existe **nenhum cron** drenando `acceptance_effect_jobs`, nem chamada `pg_net` no trigger.
7. Resultado: **40 jobs pendentes acumulados desde 23/04/2026**, todos sem notificação in-app, sem Slack, sem celebração.

## Causa raiz (3 falhas combinadas)

| # | Falha | Arquivo |
|---|------|---------|
| 1 | Função gated por `INTERNAL_WORKFLOW_SECRET`, mas é chamada do navegador (anon) sem o secret | `supabase/functions/post-acceptance-effects/index.ts` (linhas 22-30) |
| 2 | Ausência de `[functions.post-acceptance-effects] verify_jwt = false` (proposta pública = anon) | `supabase/config.toml` |
| 3 | Sem worker (cron + pg_net) que processe a fila, então qualquer falha do path do cliente nunca é compensada | nenhuma migração existente |

---

## Plano de correção

### 1. Corrigir auth da edge function `post-acceptance-effects`
- Remover o gate exclusivo por `x-internal-secret`. Aceitar duas vias:
  - **Worker/cron**: `x-internal-secret` válido → modo worker drena fila.
  - **Cliente (público ou autenticado)**: aceita `proposalId` no body, valida via `service_role` que o registro `proposals.id = proposalId` está com `status = 'accepted'` (ou que existe job pendente em `acceptance_effect_jobs` para esse `proposalId`). Se sim, processa. Se não, 403.
- Manter idempotência por `notifications_processed_at` / `slack_processed_at` que já existem.

### 2. Configurar `verify_jwt = false`
- Adicionar bloco em `supabase/config.toml`:
  ```toml
  [functions.post-acceptance-effects]
  verify_jwt = false
  ```

### 3. Cron worker (segurança em camadas)
- Criar migração com `pg_cron` + `pg_net` que dispara `post-acceptance-effects` em **modo worker** (sem `proposalId`) a cada **1 minuto**, enviando `x-internal-secret` lido do Vault.
- A função já tem o modo worker pronto (`jobs = pending OR failed, attempt_count < 5`), só precisa ser acionada.
- Garantir secret `INTERNAL_WORKFLOW_SECRET` existe (verificar via `secrets--fetch_secrets`); se não, criar.

### 4. Backfill imediato (drenar 40 jobs)
- Após deploy, invocar o worker uma vez via `supabase--curl_edge_functions` com `x-internal-secret` para processar os 40 jobs pendentes.
- Validar especificamente o job da CANON MEDICAL (`66c9f722`):
  - Confirmar `notifications_processed_at IS NOT NULL`.
  - Confirmar `slack_processed_at IS NOT NULL`.
  - Confirmar inserts em `notifications`, `notifications_v2` e `notification_events` para a organização `d1b68a0f-...`.

### 5. Memória arquitetural
- Atualizar `mem://architectural-decision/proposals/acceptance-side-effect-redundancy` (já listado no índice) para deixar explícito:
  - Cliente NÃO deve depender só de fire-and-forget; cron drena fila.
  - Função aceita anon **somente** quando `proposalId` corresponde a job pendente válido.

---

## Arquivos impactados

- `supabase/functions/post-acceptance-effects/index.ts` — refatorar gate de auth.
- `supabase/config.toml` — adicionar bloco `verify_jwt = false`.
- `supabase/migrations/<novo>.sql` — `pg_cron` chamando worker via `pg_net` a cada 1 min, com secret do Vault.
- `mem://architectural-decision/proposals/acceptance-side-effect-redundancy` — atualizar regra.

## Riscos & mitigações

- **Risco**: chamar worker sem rate-limit pode reprocessar jobs em flight.
  - Mitigação: já existe `status = 'processing'` + `attempt_count` na função; `LIMIT 10` por execução; cron 1/min.
- **Risco**: anon abusar de `proposalId` para spam.
  - Mitigação: só processa se job já existe em `acceptance_effect_jobs` (criado pelo trigger) — anon não consegue forjar.
- **Risco**: notificações duplicadas no backfill.
  - Mitigação: idempotência por `notifications_processed_at` + dedupe por `metadata->>proposal_id` já implementados.

## Validação pós-deploy

1. `SELECT count(*) FROM acceptance_effect_jobs WHERE status='pending'` → deve cair de 40 para 0.
2. `SELECT count(*) FROM notifications_v2 WHERE metadata->>'proposal_id'='053419df-...'` → > 0.
3. Confirmar com o usuário (Wagner) que recebeu notificação in-app + mensagem no Slack para CANON MEDICAL.
4. Aceitar uma proposta de teste e confirmar que notificação chega em < 5s (path do cliente) ou < 60s (path do worker).
