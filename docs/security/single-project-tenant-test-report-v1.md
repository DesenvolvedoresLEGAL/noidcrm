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

## NSEC-1.2-CHG-015 — Integridade tenant de pipeline_id e stage_id

- **Policy nova:** `nsec12_opportunities_insert_tenant_relations_guard` (RESTRICTIVE, INSERT, authenticated, somente WITH CHECK).
- **Reprobes:** 12/12 conforme esperado.
  - Owner same-org (P1/P2): `ALLOWED_ROLLED_BACK`.
  - Organization cross-org (P3/P4): `BLOCKED_RLS`.
  - Viewer same-org (P5/P6): `BLOCKED_RLS` (preservação CHG-014).
  - Pipeline cross-tenant (P7/P8): `BLOCKED_RLS`.
  - Stage cross-tenant (P9/P10): `BLOCKED_RLS`.
  - Pipeline/stage incompatíveis (P11/P12): `BLOCKED_CHECK`.
- **Baseline:** 2621 opportunities / 2218 ativas / 0 sintéticas — pré = pós.
- **SEC-013:** RESOLVED (preservado).
- **SEC-014:** RESOLVED.
- **SEC-015:** RESOLVED.
- **Matriz completa de papéis:** ainda não executada.
- **account_id / contact_id em opportunities:** ainda não testados.
- **UPDATE / DELETE:** ainda não testados.
- **RPC canary:** mantida (SECURITY INVOKER) para próximas rodadas.
- **Rollback:** `DROP POLICY IF EXISTS nsec12_opportunities_insert_tenant_relations_guard ON public.opportunities;`
- **Decisão final:** `NSEC-1.2-CHG-015 VALIDATED`.

## NSEC-1.2-CHG-016 — Matriz completa de papéis + cleanup da RPC

- **Opportunities INSERT básico — matriz de papéis:** 32/32 probes conforme esperado.
  - Same-org (12): 10 permitidos + 2 viewers bloqueados. **PASS**
  - Organization cross-org (12): 12/12 bloqueados. **PASS**
  - Pipeline/stage opcionais (6): 6/6 permitidos. **PASS**
  - `organization_id NULL` (2 INSERT diretos): 2/2 bloqueados (HTTP 403). **PASS**
- **Pipeline/stage tenant relations:** PASS (regressão preservada de CHG-015).
- **Viewer enforcement:** PASS (SEC-013 revalidado em 4 dimensões).
- **account_id:** NÃO EXECUTADO.
- **contact_id:** NÃO EXECUTADO.
- **UPDATE / DELETE:** NÃO EXECUTADOS.
- **RPC temporária `nsec12_probe_insert_opportunity`:** REMOVIDA via migration de cleanup após homologação total.
- **Baseline pré/pós:** 2621 / 2218 / 0 — idêntico.
- **Fixtures preservadas.** Dados reais intocados.
- **Relatório completo:** `docs/security/phase4-opportunities-insert-matrix-v1.md`.
- **Decisão final:** `OPPORTUNITIES INSERT BÁSICO HOMOLOGADO`.

## NSEC-1.2-CHG-017 — Contacts-base para testes relacionais de opportunities

- **Objetivo:** provisionar 2 contatos sintéticos (`SECURITY_TEST_CONTACT_ORG_A_BASE`, `SECURITY_TEST_CONTACT_ORG_B_BASE`) vinculados às accounts-base.
- **Opportunities INSERT básico:** PASS (herdado de CHG-016, sem regressão).
- **Fixtures de account:** READY.
- **Fixtures de pipeline/stage:** READY.
- **Fixtures de contact:** **BLOCKED**.
- **Motivo:** trigger `trg_contact_nome` sobrescreve `nome` a partir de `primeiro_nome`/`ultimo_nome`. Payload autorizado (com `nome` direto) resultou em row com nome vazio → guardrail STOP acionado antes de Contact B.
- **Row órfão:** `b53de59c-…-fcb3` (Org A, Account A, `nome=""`) registrado no cleanup runbook §6. **Não usar como fixture.**
- **Contact B:** NÃO criado.
- **opportunities.account_id / opportunities.contact_id:** NÃO EXECUTADOS.
- **UPDATE / DELETE:** NÃO EXECUTADOS.
- **SEC-013/014/015:** permanecem RESOLVED (sem regressão).
- **Dados reais intocados.** Zero egress externo.
- **Relatório completo:** `docs/security/phase4-opportunity-contact-fixtures-report-v1.md`.
- **Decisão final:** `OPPORTUNITY CONTACT FIXTURES BLOCKED`. Remediação proposta em CHG-018 (usar `primeiro_nome`), aguardando autorização humana.

## NSEC-1.2-CHG-018 — Recuperação das contact fixtures (READY)

- **Contact A oficial:** `55d589fb-…-bbf0` · Org A · Account A · `nome=primeiro_nome=SECURITY_TEST_CONTACT_ORG_A_BASE` · JWT `sec-test-a-owner@example.com`.
- **Contact B oficial:** `47ad14f0-…-8a27` · Org B · Account B · `nome=primeiro_nome=SECURITY_TEST_CONTACT_ORG_B_BASE` · JWT `sec-test-b-owner@example.com`.
- **Órfão CHG-017:** `b53de59c-…-fcb3` preservado read-only, `updated_at` inalterado, permanece NON-FIXTURE.
- **Matriz de visibilidade (12 probes):** owner/viewer same-org veem seu contato; cross-org 100% bloqueado; órfão invisível fora da Org A.
- **Integridade contact→account→org:** validada para A e B.
- **Accounts-base:** intactas. Efeitos derivados apenas locais (queues). Zero egress. Zero dado real alterado.
- **Estados:** Opportunities INSERT básico = PASS · Account fixtures = READY · Pipeline/stage fixtures = READY · **Contact fixtures = READY** · Órfão = registrado e excluído de probes · Opportunities.account_id = NÃO EXECUTADO · Opportunities.contact_id = NÃO EXECUTADO · UPDATE/DELETE = NÃO EXECUTADOS.
- **SEC-013, SEC-014, SEC-015:** RESOLVED (sem regressão).
- **Decisão final:** `OPPORTUNITY CONTACT FIXTURES READY`.

## NSEC-1.2-CHG-019 — Canary tenant de account_id / contact_id em opportunities (FAILED)

- **Objetivo:** validar isolamento multi-tenant dos campos relacionais `account_id` e `contact_id` no INSERT de `public.opportunities` via RPC temporária com rollback interno.
- **RPC criada:** `public.nsec12_probe_insert_opportunity_with_relations` — SECURITY INVOKER, `EXECUTE` restrito a `authenticated`, whitelist rígida (12 usuários, 2 orgs, 2 pipelines, 2 stages, 2 accounts, 2 contacts oficiais), órfão CHG-017 rejeitado, título obrigatório com prefixo `SECURITY_TEST_OPPORTUNITY_REL_CANARY_`, INSERT + `RAISE 'NSEC12_ROLLBACK'` em sub-bloco, códigos sanitizados.
- **Baseline pré/pós opportunities:** 2622 / 2622 — idêntico. Zero linhas com prefixo canary. Zero dados reais alterados. Zero egress externo.
- **Matriz de 16 probes (Owner A/B, Viewer A/B via Edge Function `nsec12-provision-fixtures/issueToken`):**
  - Relação completa same-org (P1/P2): `ALLOWED_ROLLED_BACK` ✅
  - Viewer regression (P3/P4): `BLOCKED_RLS` ✅ (SEC-013 confirmado RESOLVED)
  - Organization cross-org (P5/P6): `BLOCKED_RLS` ✅
  - Account isolada same-org (P7/P8): `ALLOWED_ROLLED_BACK` ✅
  - Contact isolado same-org (P9/P10): `ALLOWED_ROLLED_BACK` ✅
  - **Account cross-tenant isolada (P11/P12): `ALLOWED_ROLLED_BACK` ❌ → SEC-016**
  - **Contact cross-tenant isolado (P13/P14): `ALLOWED_ROLLED_BACK` ❌ → SEC-017**
  - **Account + Contact cross-tenant conjuntos (P15/P16): `ALLOWED_ROLLED_BACK` ❌ (evidência associada)**
- **SEC-013 / SEC-014 / SEC-015:** permanecem RESOLVED (P3–P6 confirmaram).
- **SEC-016 (HIGH, OPEN):** `account_id` de outro tenant aceito em INSERT — nenhuma policy/CHECK/trigger valida `accounts.organization_id = opportunities.organization_id`.
- **SEC-017 (HIGH, OPEN):** `contact_id` de outro tenant aceito em INSERT — nenhuma policy/CHECK/trigger valida `contacts.organization_id = opportunities.organization_id`. Risco secundário de vazamento indireto de PII em relatórios cruzados.
- **Cenário mesmo-tenant com `account_id ≠ contact.account_id`:** NÃO TESTADO (fixture única por tenant); documentado para CHG futura.
- **RPC canary:** MANTIDA para reprobes após remediação. Rollback DDL: `DROP FUNCTION IF EXISTS public.nsec12_probe_insert_opportunity_with_relations(uuid,text,text,uuid,uuid,text);`
- **Relatório completo:** `docs/security/phase4-opportunity-account-contact-canary-v1.md`.
- **Decisão final:** `OPPORTUNITIES ACCOUNT/CONTACT CANARY FAILED`. Correção fora de escopo desta mudança — aguardando autorização humana explícita para CHG de remediação (proposta: policy RESTRICTIVE tenant-aware para `account_id` e `contact_id`, análoga à `nsec12_opportunities_insert_tenant_relations_guard`).

## NSEC-1.2-CHG-020 — Integridade tenant de account_id / contact_id em opportunities (VALIDATED)

- **Objetivo:** remediar SEC-016 e SEC-017 impedindo INSERT em `public.opportunities` com `account_id` ou `contact_id` de outro tenant.
- **Migration aplicada:** policy única aditiva `nsec12_opportunities_insert_account_contact_tenant_guard` (RESTRICTIVE, INSERT, authenticated, apenas WITH CHECK). Sem trigger, sem função auxiliar, sem alteração de policies existentes. Total pós: 9 policies.
- **Rollback documentado:** `DROP POLICY IF EXISTS nsec12_opportunities_insert_account_contact_tenant_guard ON public.opportunities;`
- **Reprobes (16/16 conforme esperado, JWT real via `issueToken`, publishable key em `apikey`, zero service role em `Authorization`):**
  - Relação completa same-org (P1/P2): `ALLOWED_ROLLED_BACK` ✅
  - Viewer (P3/P4): `BLOCKED_RLS` ✅
  - Organization cross-org (P5/P6): `BLOCKED_RLS` ✅
  - Account isolada same-org (P7/P8): `ALLOWED_ROLLED_BACK` ✅
  - Contact isolado same-org (P9/P10): `ALLOWED_ROLLED_BACK` ✅
  - Account cross-tenant (P11/P12): `BLOCKED_RLS` ✅ → **SEC-016 RESOLVED**
  - Contact cross-tenant (P13/P14): `BLOCKED_RLS` ✅ → **SEC-017 RESOLVED**
  - Account + Contact cross-tenant conjuntos (P15/P16): `BLOCKED_RLS` ✅
- **Baseline pré/pós opportunities:** 2623 / 2623 — idêntico. Zero linhas com prefixo `SECURITY_TEST_OPPORTUNITY_REL_CANARY_%`. Fixtures A/B intactas; órfão preservado; pipelines/stages sintéticos intactos. Zero egress externo. Zero dado real alterado.
- **Estados consolidados:**
  - Opportunities INSERT básico: **PASS** (CHG-016).
  - `pipeline_id`: **PASS** (CHG-015).
  - `stage_id`: **PASS** (CHG-015).
  - `account_id` tenant: **PASS** (CHG-020).
  - `contact_id` tenant: **PASS** (CHG-020).
  - Compatibilidade account↔contact same-tenant: **NÃO EXECUTADA** (fora de escopo).
  - Matriz completa relacional por papel: **NÃO EXECUTADA.**
  - UPDATE / DELETE: **NÃO EXECUTADOS.**
  - RPC temporária `nsec12_probe_insert_opportunity_with_relations`: **MANTIDA** para reprobes futuros.
- **SEC-013 / SEC-014 / SEC-015:** permanecem RESOLVED (sem regressão em P3–P6).
- **Relatório completo:** `docs/security/phase4-opportunity-account-contact-canary-v1.md` (seção CHG-020).
- **Decisão final:** `NSEC-1.2-CHG-020 VALIDATED`.

## NSEC-1.2-CHG-021 — Matriz completa por papel de account_id/contact_id em opportunities (HOMOLOGADA)

- **Objetivo:** validar a proteção tenant de `account_id` e `contact_id` para os 6 papéis funcionais em ambas as orgs sintéticas, remover a RPC temporária.
- **Execução:** 36 probes via `nsec12_probe_insert_opportunity_with_relations` com JWT real de cada persona; publishable key em `apikey`; zero service role.
- **Resultados:**
  - Bloco 1 same-org (12/12): 10 `ALLOWED_ROLLED_BACK` + 2 `BLOCKED_RLS` (viewers A e B). ✅
  - Bloco 2 account cross-tenant (12/12): `BLOCKED_RLS` em 100% dos papéis. ✅ → SEC-016 revalidado.
  - Bloco 3 contact cross-tenant (12/12): `BLOCKED_RLS` em 100% dos papéis. ✅ → SEC-017 revalidado.
- **Baseline pré/pós:** 2624 / 2624; zero opportunities `SECURITY_TEST_OPPORTUNITY_REL_CANARY_MATRIX_CHG021%`; 9 policies; fixtures e órfão intactos; zero egress externo.
- **Estados consolidados:**
  - Opportunities INSERT básico: **PASS**.
  - `pipeline_id` / `stage_id`: **PASS**.
  - `account_id` tenant matriz completa por papel: **PASS**.
  - `contact_id` tenant matriz completa por papel: **PASS**.
  - Viewer: **BLOCKED** conforme esperado (dupla barreira em cross-tenant).
  - Compatibilidade account↔contact same-tenant: **NÃO EXECUTADA**.
  - UPDATE / DELETE: **NÃO EXECUTADOS**.
  - RPC `nsec12_probe_insert_opportunity_with_relations`: **REMOVIDA** (REVOKE + DROP FUNCTION). `pg_proc` = 0. Sem referências de produto.
- **SEC-013 / SEC-014 / SEC-015:** permanecem RESOLVED (viewer revalidado sem regressão).
- **SEC-016 / SEC-017:** RESOLVED — matriz por papel homologada, evidência CHG-021 registrada em `security-findings-v1.csv`.
- **Relatório completo:** `docs/security/phase4-opportunity-account-contact-matrix-v1.md`.
- **Rollback (informativo — RPC removida):** RPC pode ser reprovisionada por migration reversível caso testes futuros exijam.
- **Decisão final:** `OPPORTUNITIES ACCOUNT/CONTACT TENANT MATRIX HOMOLOGADA`.

## NSEC-1.2-CHG-022 — Same-tenant mismatch fixtures (PARTIAL)

- **Data:** 2026-07-21
- **Classificação:** AMARELA controlada
- **Decisão:** `OPPORTUNITY SAME-TENANT MISMATCH FIXTURES PARTIAL`

### Fixtures oficiais criadas
| Kind | UUID (mascarado) | Tenant | Vínculo |
|---|---|---|---|
| Account A ALT | `1412****61af` | Org A | — |
| Account B ALT | `9558****da5e` | Org B | — |
| Contact A ALT | `b1ab****d089` | Org A | account_id = Account A ALT |
| Contact B ALT | `edfd****e0e3` | Org B | account_id = Account B ALT |

### Consolidated status
- Opportunities INSERT básico: **PASS**
- Pipeline/stage tenant: **PASS**
- Account/contact tenant (guard): **PASS**
- Account/contact tenant matrix (36 probes): **PASS**
- Fixtures same-tenant mismatch (CHG-022): **PARTIAL** (4 fixtures oficiais prontas + 1 orphan account documentado)
- Compatibility account↔contact same-tenant: **NÃO EXECUTADA**
- UPDATE / DELETE: **NÃO EXECUTADOS**
- RPC ativa para opportunities: **nenhuma**

### Findings
- SEC-013 / SEC-014 / SEC-015 / SEC-016 / SEC-017 permanecem **RESOLVED** (não reavaliados nesta CHG; nenhum vazamento cross-org observado).
- Nenhum finding HIGH novo: cross-org visibility confirmada `[]` por ID em todos os probes.

### Observação operacional
Guardrails #10 (>2 accounts) e #12 (retry duplicidade) acionados por parse local incorreto de `jq` durante Fase C, gerando 1 orphan account (`73db****7f77`) em Org A sem referências downstream. Registrado em `single-project-cleanup-runbook-v1.md §8bis`. Nenhum DELETE executado (não autorizado nesta CHG).
