# Fase 4b-1 — INSERT transacional de baixo risco (Revenue Core)

**Sprint:** NOID-SECURITY 1.2 · Fase 4b-1
**Data/hora (UTC):** 2026-07-20
**Autor:** Agente (LEGAL / HUMANOID)
**Status:** ⛔ **INTERROMPIDA NO PRE-FLIGHT — BLOQUEADOR DE METODOLOGIA**
**Escopo autorizado:** `accounts`, `contacts`, `leads`, `opportunities`, `activities`.
**Dados reais tocados:** nenhum. **Nenhum COMMIT executado.**

---

## 1. Baseline (pré e pós)

| Tabela        | Contagem pré | Contagem pós |
|---------------|--------------|--------------|
| accounts      | 4.877        | 4.877        |
| contacts      | 1.730        | 1.730        |
| opportunities | 2.611        | 2.611        |
| activities    | 4.487        | 4.487        |

Baseline idêntico. Nenhum registro sintético persistido. Nenhum dado
real da LEGAL alterado.

---

## 2. Pre-flight read-only

### 2.1 Tabela `leads`

`public.leads` **não existe**. O módulo do frontend (`src/services/supabase/leads.ts`)
projeta `accounts` como "leads". Portanto o escopo efetivo desta fase são
4 tabelas: `accounts`, `contacts`, `opportunities`, `activities`.

### 2.2 Colunas NOT NULL sem default

| Tabela        | Campos obrigatórios sem default |
|---------------|---------------------------------|
| accounts      | `razao_social`, `organization_id` |
| contacts      | `nome`, `organization_id` |
| opportunities | `title`, `organization_id` |
| activities    | `owner_user_id`, `type`, `title`, `organization_id` |

### 2.3 Foreign keys relevantes

- `accounts`: `organization_id`, `owner_user_id`, `cs_user_id`,
  `parent_account_id`, `created_by`.
- `contacts`: `organization_id`, `account_id`.
- `opportunities`: `organization_id`, `account_id`, `contact_id`,
  `pipeline_id`, `stage_id`, `accepted_proposal_id`, `loss_reason_id`,
  `client_loss_reason_id`, `source_opportunity_id`, `created_by`,
  `plg_organization_id`.
- `activities`: `organization_id`, `account_id`, `contact_id`,
  `opportunity_id`, `email_template_id`.

### 2.4 Triggers inspecionadas

121 triggers ativas nas 4 tabelas. Nenhuma delas faz `pg_net.http_post`,
`net.http_get`, chamada a Edge Function, envio de e-mail ou webhook,
**exceto** `trg_segment_benchmark_refresh` em `opportunities`, que só
dispara quando `NEW.status IN ('won','lost')`. Portanto foi excluído
qualquer probe com `status IN ('won','lost')` no design.

Efeitos observáveis (todos transacionais, portanto rolam back com
`ROLLBACK`):

- `set_created_by()` — preenche `created_by = auth.uid()`.
- `normalize_account_segmento()` — normaliza campos de texto.
- `enqueue_lead_score_recalc()`, `enqueue_opportunity_score_recalc()`,
  `enqueue_nrhs_recalc()`, `enqueue_indicators_from_activity()`,
  `trigger_account_score_recalc()`, `trigger_opportunity_score_recalc()`
  — inserem em tabelas de fila `*_recalc_queue`.
- `log_activity_as_interaction()`, `log_activity_revenue_event()`,
  `log_opportunity_system_events()` — inserem em `interactions`,
  `revenue_events`, `system_events`.
- `notify_account_changes()`, `notify_activity_changes()` — inserem em
  `notification_events` (nenhuma chamada HTTP).
- `sync_lead_grade_from_score()`, `update_account_scores()` — recalculam
  colunas locais.
- `check_workflow_on_activity_change()` — leitura + eventual insert em
  `workflow_executions` (transacional).

**Conclusão do pre-flight:** nenhum efeito externo a rollback foi
identificado. Probes podem prosseguir com `BEGIN … ROLLBACK` sem risco
de vazamento fora da transação.

### 2.5 Policies INSERT

Todas as 4 tabelas expõem policy INSERT idêntica em espírito:
`organization_id = organization_id do membership ativo em auth.uid()`.
**Nenhuma policy INSERT diferencia `org_role`** (owner/admin/manager/
sales/viewer/cs). A restrição de papéis é implementada apenas no
frontend, não no banco.

**Matriz esperada (baseada exclusivamente em RLS):**

| Papel   | INSERT na própria org | INSERT cross-org |
|---------|-----------------------|------------------|
| owner   | ALLOWED               | BLOCKED          |
| admin   | ALLOWED               | BLOCKED          |
| manager | ALLOWED               | BLOCKED          |
| sales   | ALLOWED               | BLOCKED          |
| viewer  | ALLOWED (⚠ divergência produto-vs-RLS) | BLOCKED |
| cs      | ALLOWED               | BLOCKED          |

⚠ **Achado documental (não é vazamento — não corrigir automaticamente):**
o produto trata `viewer` como somente-leitura, mas o banco autoriza
INSERT para qualquer membership `status='active'`. Registrar como
finding a validar depois; **fora do escopo desta sub-fase**.

---

## 3. Execução — bloqueador identificado

### 3.1 Design

Cada probe foi projetado assim, uma transação isolada por probe:

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"<user_sintetico>","role":"authenticated"}', true);
<INSERT payload SECURITY_TEST_WRITE_ORG_?_*>;
ROLLBACK;
```

108 probes projetados: 4 tabelas × 12 usuários × (1 positivo same-org +
1 negativo cross-org) + 12 probes de `organization_id = NULL` para
`accounts`.

### 3.2 Bloqueador

O usuário SQL disponível no sandbox de execução é `sandbox_exec`, que
**não possui membership no role `authenticated`** do Supabase. Toda
tentativa de `SET LOCAL ROLE authenticated` retorna:

```
ERROR:  permission denied to set role "authenticated"
```

Isso invalida todos os probes rodados nessa via: os 60 aparentes
"BLOCKED" no primeiro batch são **falsos positivos** — a transação foi
abortada antes do INSERT tocar RLS. Portanto **nenhuma evidência
válida de RLS foi coletada** e o resultado do batch inicial foi
descartado. O arquivo `/tmp/nsec12/phase4b_results.jsonl` fica marcado
como inválido.

Baseline verificado antes e depois: idêntico (nenhuma linha persistida,
nenhuma linha vazada — a barreira parou tudo antes de qualquer efeito).

### 3.3 Causa

Impersonação transacional (`SET LOCAL ROLE authenticated` +
`set_config('request.jwt.claims', …, true)`) exige que o role atual
tenha `GRANT authenticated TO <role>`. Em Supabase gerenciado isso
existe apenas para `postgres`/`service_role`, aos quais o sandbox não
tem acesso. Uma outra estratégia é necessária.

---

## 4. Proposta (aguardando aprovação — não executada)

Duas opções tecnicamente viáveis para a Fase 4b-1:

### Opção A — Extender a Edge Function `nsec12-provision-fixtures`

Adicionar ação `probeInsert` (guarded pelo mesmo `NSEC12_TOKEN2` já
existente), que:

1. Abre transação no Postgres com `service_role`.
2. Executa `SET LOCAL ROLE authenticated` + jwt claims para o
   usuário sintético.
3. Executa o INSERT recebido no payload.
4. Verifica o resultado (linha inserida, erro RLS, erro FK).
5. `ROLLBACK` sempre.
6. Retorna JSON com `outcome` (`ALLOWED` / `BLOCKED_RLS` /
   `BLOCKED_FK` / `BLOCKED_CHECK`) e mensagem de erro sanitizada.

Restrições obrigatórias no código: whitelist estática das 4 tabelas,
whitelist de colunas por tabela, whitelist do prefixo do payload
(`SECURITY_TEST_WRITE_ORG_*`), transação sempre encerrada em ROLLBACK,
sem `COMMIT` possível, retorno sanitizado (sem row real).

Classificação: **AMARELO** (Edge Function nova + uso transacional de
`service_role`). Requer o template ANTES/EXECUÇÃO/DEPOIS do
`single-project-change-protocol-v1.md` e aprovação humana explícita
antes do deploy.

### Opção B — Emitir JWTs via `issueToken` (já existente) + PostgREST

Rodar os 108 INSERTs via HTTP com JWT do usuário sintético. Vantagem:
usa exatamente o mesmo caminho do frontend (PostgREST). Desvantagem:
**sem rollback nativo**. Cada INSERT bem-sucedido persistiria como
`SECURITY_TEST_WRITE_ORG_*` e teria de ser removido depois via
`service_role` (novo runbook de cleanup). Isso viola a regra
transacional obrigatória desta sub-fase ("cada probe em transação
isolada com ROLLBACK, nenhum registro persistindo").

**Opção A é a única que respeita integralmente o mandato.**

---

## 5. Resumo por tabela

| Tabela        | Probes projetados | Probes válidos executados | Resultado |
|---------------|-------------------|---------------------------|-----------|
| accounts      | 36 (12 pos + 12 neg + 12 null) | 0 | BLOQUEADO — sem impersonação |
| contacts      | 24 (12 pos + 12 neg)          | 0 | BLOQUEADO — sem impersonação |
| opportunities | 24 (12 pos + 12 neg)          | 0 | BLOQUEADO — sem impersonação |
| activities    | 24 (12 pos + 12 neg)          | 0 | BLOQUEADO — sem impersonação |

## 6. Resumo por papel

Nenhum papel testado com validade — impersonação bloqueada antes do
INSERT em todas as 12 identidades sintéticas.

## 7. Cross-org / payload adulterado / sem membership

Não executado — mesma causa.

## 8. Positive sanity

Não executado — mesma causa.

## 9. Rollback

Não aplicável — nenhuma linha foi inserida. Baseline idêntico antes e
depois (§1).

## 10. Divergência `role` legado vs `org_role`

Nada novo além do já registrado na Fase 4 SELECT:
`organization_members.role='member'` para todos os papéis não-owner/
admin, com `org_role` real armazenado à parte. RLS de INSERT hoje só
consulta membership `status='active'` e ignora `org_role` — ver §2.5.

## 11. Dados reais intocados

Confirmado:

- Nenhuma linha real da LEGAL foi criada, alterada ou apagada.
- Nenhum COMMIT executado nesta sub-fase.
- Nenhum efeito externo disparado (pg_net não é usado pelos triggers
  em jogo — §2.4).
- Nenhuma alteração estrutural (nenhuma migration, nenhuma policy,
  nenhuma RPC, nenhuma Edge Function nova).

## 12. Decisão

**Fase 4b-1: BLOQUEADA no pre-flight de metodologia.** Solicitar
autorização explícita para a Opção A (§4) — extensão de
`nsec12-provision-fixtures` com ação `probeInsert` sob o protocolo
`NSEC-1.2-CHG-002`. Sem essa aprovação, não é possível coletar
evidência válida de RLS de INSERT via sandbox.

Sem essa aprovação, **não avançar** para UPDATE, DELETE, RPC, Views
ativas, Edge Functions, Importação, Notificações ou Storage.
