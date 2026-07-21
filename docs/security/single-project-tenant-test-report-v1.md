# NOID Security — Single-Project Tenant Test Report v1

Sprint: NOID-SECURITY 1.2
Ambiente: projeto Lovable Cloud único de produção (ref `urihdqturaebhiefwjnw`)
Metodologia: fixtures sintéticas `sec-test-*@example.com` + RPC `SECURITY INVOKER`
com rollback interno + JWT real por HTTPS (`apikey` publishable, nunca `service_role`).

## Cobertura por tabela

### `public.accounts`

| Operação | Estado | Autorização | Evidência |
|---|---|---|---|
| SELECT | PASS | NSEC-1.2-CHG (Fase 4) | `docs/security/phase4-select-report-v1.md` — 168 probes, 144 cross-org negados, 24 sanidade OK |
| INSERT same-org (owner/admin/manager/sales/cs) | PASS | NSEC-1.2-CHG-004 | 10/10 `ALLOWED_ROLLED_BACK` — `phase4-insert-accounts-jwt-report-v1.md` §9.3 |
| INSERT same-org (viewer) | PASS — bloqueado | NSEC-1.2-CHG-003 | Policy RESTRICTIVE `nsec12_accounts_insert_block_viewer` |
| INSERT cross-org (todos os papéis) | PASS — bloqueado | NSEC-1.2-CHG-004 | 12/12 `BLOCKED_RLS` — §9.4 |
| INSERT `organization_id = NULL` | PASS — bloqueado | NSEC-1.2-CHG-004 | 2/2 HTTP 403 (RLS) — §9.5 |
| Role enforcement (`org_role`) | PASS | NSEC-1.2-CHG-004 | manager/sales/cs preservados; viewer bloqueado — §9.2 |
| UPDATE | não executado | — | fora do escopo autorizado |
| DELETE | não executado | — | fora do escopo autorizado |
| RPC temporária de probe | REMOVIDA | NSEC-1.2-CHG-004 (cleanup) | `DROP FUNCTION nsec12_probe_insert_account` — §9.8 |

### `public.contacts`

| Operação | Estado | Autorização | Evidência |
|---|---|---|---|
| SELECT | PASS | NSEC-1.2-CHG (Fase 4) | `phase4-select-report-v1.md` |
| INSERT same-org sem `account_id` (owner/admin/manager/sales/cs) | PASS | NSEC-1.2-CHG-007 | 10/10 `ALLOWED_ROLLED_BACK` — `phase4-insert-contacts-jwt-report-v1.md` (CHG-007) |
| INSERT same-org sem `account_id` (viewer) | PASS — bloqueado | NSEC-1.2-CHG-006 (policy) + CHG-007 (reprobe matriz) | 2/2 `BLOCKED_RLS` |
| INSERT cross-org sem `account_id` (todos os papéis) | PASS — bloqueado | NSEC-1.2-CHG-007 | 12/12 `BLOCKED_RLS` |
| INSERT `organization_id = NULL` (owners A/B) | PASS — bloqueado | NSEC-1.2-CHG-007 | 2/2 HTTP 403 RLS |
| Role enforcement (`org_role`) | PASS | NSEC-1.2-CHG-006 + CHG-007 | manager/sales/cs preservados; viewer bloqueado |
| INSERT com `account_id` FK — canary 8 probes | PASS | NSEC-1.2-CHG-009 | `phase4-contact-account-relationship-report-v1.md` (canary) |
| INSERT com `account_id` FK — matriz 36 probes | PASS | NSEC-1.2-CHG-010 | `phase4-contact-account-relationship-report-v1.md` §4 — 12/12 same-org (10 allowed, 2 viewers blocked), 12/12 account cross-org bloqueados, 12/12 org cross-org bloqueados |
| Role enforcement com `account_id` (owner/admin/manager/sales/cs allowed; viewer blocked) | PASS | NSEC-1.2-CHG-010 | Matriz por papel §5 |
| UPDATE | não executado | — | fora do escopo autorizado |
| DELETE | não executado | — | fora do escopo autorizado |
| RPC temporária `nsec12_probe_insert_contact` | **REMOVIDA** | NSEC-1.2-CHG-007 | `pg_proc` 0 linhas |
| RPC temporária `nsec12_probe_insert_contact_with_account` | **REMOVIDA** | NSEC-1.2-CHG-010 | `pg_proc` 0 linhas |

### `public.opportunities`

| Operação | Estado | Autorização | Evidência |
|---|---|---|---|
| Pre-flight (schema, FKs, policies, triggers, egress, código, fixtures) | **EXECUTADO** | NSEC-1.2-CHG-011 | `docs/security/phase4-opportunities-insert-preflight-v1.md` |
| Pipeline/Stage fixtures A e B | **CRIADAS** — `OPPORTUNITY PIPELINE FIXTURES READY` | NSEC-1.2-CHG-012 | `docs/security/phase4-opportunity-relationship-fixtures-report-v1.md` |
| INSERT (probes dinâmicos) | **NÃO EXECUTADO** | — | aguarda contacts-base + autorização |
| UPDATE / DELETE | **NÃO EXECUTADOS** | — | fora do escopo |
| Readiness | `READY AFTER SYNTHETIC FIXTURES` — pipelines/stages OK; contacts-base pendentes | NSEC-1.2-CHG-012 | idem |
| Achados abertos | SEC-013 candidato (viewer insere), Achado A (FK cross-tenant sem tenant-check em account/contact/pipeline/stage) | NSEC-1.2-CHG-011 | §6.1 e §3 do pre-flight |

### Demais tabelas (`activities`, `proposals`, …)

Não homologadas para escrita. Aguardando autorização explícita.

## Baseline global (accounts)

| Métrica | Valor pré/pós CHG-004 |
|---|---|
| Accounts sintéticas ativas | 0 / 0 |
| Accounts sintéticas totais (tombstone) | 1 / 1 |
| Accounts reais ativas | 4781 / 4781 |
| Filas / notifications / eventos derivados sintéticos | 0 / 0 |

## Guardrails permanentes

- Nenhum trigger desabilitado; nenhum `session_replication_role` alterado.
- Nenhum `service_role` em header de probe.
- Nenhum JWT, secret ou dado real registrado em log/relatório.
- Rollback disponível: `DROP POLICY IF EXISTS nsec12_accounts_insert_block_viewer ON public.accounts;`

## Estado

`ACCOUNTS INSERT HOMOLOGADO`. Sprint parada conforme mandato até próxima
autorização explícita.

## NSEC-1.2-CHG-008 — Fixtures base de accounts

- Org A: **criada** (`36085a30-…-d92b`)
- Org B: **criada** (`b777baac-…-9f41`)
- Isolamento SELECT (Owner A/B, Viewer A/B contra ambas as fixtures): **PASS**
- Testes de relacionamento (`account_id` em contacts/opportunities/activities): **ainda não iniciados**

Baseline: accounts reais ativas 4781 → 4781 (delta 0); sintéticas ativas 0 → 2; tombstone 1 → 1.

Estado: `ACCOUNT RELATIONSHIP FIXTURES READY`.

## NSEC-1.2-CHG-009 — Contacts × account_id canary

- Canary executada com 8 probes via RPC `SECURITY INVOKER` + JWT real sintético.
- Same-org (Owner A→A, Owner B→B): **PASS** (`ALLOWED_ROLLED_BACK`).
- Account cross-org (Owner A→AccB, Owner B→AccA): **PASS** (`BLOCKED_RLS`).
- Organization cross-org (Owner A→OrgB, Owner B→OrgA): **PASS** (`BLOCKED_RLS`).
- Viewer same-org (A e B): **PASS** (`BLOCKED_RLS`).
- Proteção enforçada pela policy permissiva `Users insert contacts in own org` (subquery em `accounts` casando `organization_id`).
- Baseline contacts inalterado: 1.684 ativos, 1.733 totais, 0 sintéticos persistidos.
- Accounts-base intactas.
- RPC temporária removida (`pg_proc` = 0).
- Matriz completa com `account_id`: **EXECUTADA (CHG-010).**
- `UPDATE`/`DELETE`: **NÃO EXECUTADOS.**

Estado: `CONTACTS.ACCOUNT_ID CANARY VALIDATED`. Sprint parada conforme mandato.

## NSEC-1.2-CHG-010 — Contacts × account_id matriz completa

- 36/36 probes aprovados via RPC `SECURITY INVOKER` + JWT real sintético (Edge Function `issueToken`, publishable anon em `apikey`, sem service role).
- Bloco 1 — vínculo correto same-org: **12/12 PASS** (10 `ALLOWED_ROLLED_BACK` para owner/admin/manager/sales/cs; 2 `BLOCKED_RLS` para viewers).
- Bloco 2 — account cross-org (Org A→Acc B / Org B→Acc A, todos os papéis): **12/12 PASS** (`BLOCKED_RLS`).
- Bloco 3 — organization cross-org com account própria: **12/12 PASS** (`BLOCKED_RLS`).
- Role enforcement (owner/admin/manager/sales/cs vs viewer) preservado em todos os cenários.
- Baseline pré/pós idêntico: 1.684 contatos ativos, 1.733 totais, 0 sintéticos MATRIX persistidos; accounts-base ativas; 2 linhas de baseline em `lead_score_recalc_queue` intactas.
- Zero efeitos derivados novos. Zero dado real alterado. Zero JWT/secret logado.
- RPC temporária `nsec12_probe_insert_contact_with_account` removida (`pg_proc` = 0). Nenhum grant residual.
- Smoke read-only: `/app/contacts` e `/app/companies` carregam; isolamento das accounts-base preservado.
- Findings novos: **nenhum**.
- `UPDATE`/`DELETE`, opportunities, activities, proposals, Storage: **NÃO EXECUTADOS.**

Estado: `CONTACTS.ACCOUNT_ID HOMOLOGADO`. Sprint parada conforme mandato.

## NSEC-1.2-CHG-011 — Opportunities INSERT pre-flight

- Pre-flight read-only concluído em 12 fases (schema, FKs, policies, triggers, egress, defaults).
- `title` e `organization_id` únicos NOT NULL sem default; `status='new'` neutro e sem egress externo.
- 16 triggers inspecionados; `trg_segment_benchmark_refresh` restrito a won/lost.
- Estado: `OPPORTUNITIES INSERT READY AFTER SYNTHETIC FIXTURES`.

## NSEC-1.2-CHG-012 — Pipeline/Stage fixtures

- Fixtures criadas via JWT real (sem service role), `is_primary=false`, `pipeline_type=sales`, sem stage won/lost/qualified.
- Pipeline A `d1f1c882-...-30f5`, Stage A `18208f58-...-9bc7`, Pipeline B `0526054f-...-f992`, Stage B `7efae798-...-1e48`.
- Visibilidade same-org OK; cross-org 4/4 bloqueado; nenhum pipeline/stage real alterado.
- Estado: `OPPORTUNITY PIPELINE FIXTURES READY`.

## NSEC-1.2-CHG-013 — Opportunities INSERT canary

- RPC `nsec12_probe_insert_opportunity(text,text,text,text)` `SECURITY INVOKER`, rollback interno via `RAISE 'NSEC12_ROLLBACK'`.
- 12 probes executados com JWT real dos 4 atores sintéticos (Owner A/B, Viewer A/B) via `apikey` publishable — zero service role.
- Same-org (P1/P2): **PASS** (`ALLOWED_ROLLED_BACK`).
- Organization cross-org (P3/P4): **PASS** (`BLOCKED_RLS`).
- Viewer same-org (P5/P6): **FAIL** — `ALLOWED_ROLLED_BACK` → **SEC-013 CONFIRMED**.
- Pipeline cross-tenant isolado (P7/P8): **FAIL** — `ALLOWED_ROLLED_BACK` → **SEC-014 NEW**.
- Stage cross-tenant isolada (P9/P10): **FAIL** — `ALLOWED_ROLLED_BACK` → **SEC-015 NEW**.
- Pipeline+stage incompatíveis mesmo tenant (P11/P12): **PASS** (`BLOCKED_CHECK`).
- Baseline pré/pós idêntico em opportunities/system_events/audit_log/entity_snapshots/revenue_events/stage_history/notifications/interactions/workflow_executions; +31 em score/nrhs queues atribuídos a atividade real concorrente (nenhum referencia fixtures/canary).
- Fixtures pipeline/stage inalteradas. Zero opportunity persistida. Zero dado real alterado. Zero egress externo.
- RPC canary **permanece instalada** aguardando reprobes pós-correção. Rollback DDL: `DROP FUNCTION IF EXISTS public.nsec12_probe_insert_opportunity(text,text,text,text);`.
- Matriz completa de papéis, `account_id`, `contact_id`, UPDATE, DELETE: **NÃO EXECUTADOS.**

Estado: `OPPORTUNITIES INSERT CANARY FAILED` (metodologia OK; 3 findings lógicos abertos).

## NSEC-1.2-CHG-014 — Opportunities viewer INSERT block

- Migration aditiva: policy `nsec12_opportunities_insert_block_viewer` (`AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK`) barrando papel efetivo `viewer` (prioriza `org_role`, fallback `role`).
- 6 policies anteriores preservadas sem edição; nenhum trigger tocado; RPC canary permanece `SECURITY INVOKER`.
- Reprobes com JWT real (owner_a/b + viewer_a/b), publishable key, sem service role:
  - P1/P2 same-org owner: **PASS** (`ALLOWED_ROLLED_BACK`).
  - P3/P4 organization cross-org: **PASS** (`BLOCKED_RLS`).
  - P5/P6 viewer same-org: **PASS** (`BLOCKED_RLS`) → SEC-013 resolvido.
- Baseline pré/pós idêntico: 2616 totais / 2213 ativas / 0 sintéticas; fixtures pipeline/stage intactas; contagem de policies 6→7.
- Smoke: `/app/opportunities`, Forecast e Revenue Command carregam sem regressão.
- Estado dos findings: SEC-013 `RESOLVED`; SEC-014 e SEC-015 permanecem `OPEN`.
- Matriz completa de papéis, `account_id`, `contact_id`, UPDATE, DELETE: **NÃO EXECUTADOS.**
- Rollback: `DROP POLICY IF EXISTS nsec12_opportunities_insert_block_viewer ON public.opportunities;`.

Estado: `NSEC-1.2-CHG-014 VALIDATED`.
