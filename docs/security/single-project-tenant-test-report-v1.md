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
| SELECT | PASS (implícito na Fase 4 SELECT) | NSEC-1.2-CHG (Fase 4) | `phase4-select-report-v1.md` |
| INSERT canary (owner same-org × 2) | PASS | NSEC-1.2-CHG-005 | 2/2 `ALLOWED_ROLLED_BACK` — `phase4-insert-contacts-jwt-report-v1.md` |
| INSERT canary cross-org (owner × 2) | PASS — bloqueado | NSEC-1.2-CHG-005 | 2/2 `BLOCKED_RLS` |
| INSERT canary viewer (same-org × 2) | **FAIL — role escalation** | NSEC-1.2-CHG-005 | 2/2 `ALLOWED_ROLLED_BACK` → `SEC-012` HIGH OPEN |
| `account_id` FK | não testado | — | fora do escopo do canary |
| Matriz completa (admin/manager/sales/cs, org_id NULL) | não executada | — | aguardando autorização |
| UPDATE / DELETE | não executados | — | fora do escopo autorizado |
| RPC temporária de probe | **MANTIDA** (por mandato) | NSEC-1.2-CHG-005 | `public.nsec12_probe_insert_contact` — rollback `DROP FUNCTION IF EXISTS public.nsec12_probe_insert_contact(uuid, text);` |

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
