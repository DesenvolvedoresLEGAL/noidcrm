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
| INSERT com `account_id` FK | **NÃO EXECUTADO** | — | fora do escopo autorizado (CHG-007 pára aqui) |
| UPDATE | não executado | — | fora do escopo autorizado |
| DELETE | não executado | — | fora do escopo autorizado |
| RPC temporária de probe | **REMOVIDA** | NSEC-1.2-CHG-007 (cleanup) | `DROP FUNCTION nsec12_probe_insert_contact` — `pg_proc` 0 linhas |

### Demais tabelas (`opportunities`, `activities`, `proposals`, …)

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
