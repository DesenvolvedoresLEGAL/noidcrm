# Phase 4 — Contact × Account Relationship Matrix Report v1

**Change ID:** NSEC-1.2-CHG-010
**Classe:** Amarela controlada
**Data (UTC):** 2026-07-21
**Superfície:** `public.contacts.account_id` (matriz completa por papel)

## 1. Pré-flight

- Accounts-base ativas e inalteradas (`36085a30-…-d92b` e `b777baac-…-9f41`, `deleted_at IS NULL`, nomes `SECURITY_TEST_ACCOUNT_ORG_<A|B>_BASE`).
- 12 memberships sintéticos ativos (6 papéis × 2 orgs) confirmados em `organization_members` (`role`/`org_role` conforme runbook).
- Policies de `contacts` inalteradas desde CHG-009 (5 permissivas + 1 restritiva `nsec12_contacts_insert_block_viewer`).
- 8 triggers em `contacts` idênticos aos capturados na CHG-009; nenhum novo, todos locais e transacionais.
- Baseline pré:
  - contatos ativos: 1.684 / totais: 1.733 / sintéticos MATRIX: 0
  - accounts sintéticas base: 2 ativas
  - `lead_score_recalc_queue` (accounts-base): 2 linhas

## 2. RPC temporária

- Nome: `public.nsec12_probe_insert_contact_with_account(uuid, uuid, text)`.
- `SECURITY INVOKER`, `SET search_path = public`.
- `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated`.
- Guards: JWT `email` sintético (`sec-test-*@example.com`), whitelist rígida de UUIDs (2 orgs, 2 accounts), prefixo `SECURITY_TEST_CONTACT_ACCOUNT_MATRIX_`.
- Guards **não** validam antecipadamente se account e organização combinam — cross-org precisa alcançar RLS.
- Rollback interno: `RAISE EXCEPTION 'NSEC12_ROLLBACK' USING ERRCODE='P0001'` após INSERT.
- Retorno sanitizado (`ALLOWED_ROLLED_BACK`, `BLOCKED_RLS`, `BLOCKED_CHECK`, `BLOCKED_CONSTRAINT`, `REJECTED_*`, `UNEXPECTED_ERROR`).

## 3. Autenticação

- 12 JWTs sintéticos emitidos pela Edge Function `nsec12-provision-fixtures` (`action=issueToken`) com guard `x-nsec12-token`.
- `apikey` = publishable anon key; `Authorization: Bearer <JWT sintético>`.
- **`service_role` jamais utilizado**; nenhum JWT/secret registrado em log.

## 4. Matriz completa — 36 probes

### 4.1 Bloco 1 — Vínculo correto same-org (12)

| # | Persona | organization_id | account_id | Esperado | Obtido |
|---|---|---|---|---|---|
| 1 | Owner A | Org A | Acc A | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK ✅ |
| 2 | Admin A | Org A | Acc A | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK ✅ |
| 3 | Manager A | Org A | Acc A | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK ✅ |
| 4 | Sales A | Org A | Acc A | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK ✅ |
| 5 | Viewer A | Org A | Acc A | BLOCKED_RLS | BLOCKED_RLS ✅ |
| 6 | CS A | Org A | Acc A | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK ✅ |
| 7 | Owner B | Org B | Acc B | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK ✅ |
| 8 | Admin B | Org B | Acc B | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK ✅ |
| 9 | Manager B | Org B | Acc B | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK ✅ |
| 10 | Sales B | Org B | Acc B | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK ✅ |
| 11 | Viewer B | Org B | Acc B | BLOCKED_RLS | BLOCKED_RLS ✅ |
| 12 | CS B | Org B | Acc B | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK ✅ |

**Resultado:** 10/10 papéis não-viewer permitidos; 2/2 viewers bloqueados.

### 4.2 Bloco 2 — Account cross-org (12)

| # | Persona | organization_id | account_id | Esperado | Obtido |
|---|---|---|---|---|---|
| 13 | Owner A | Org A | Acc B | BLOCKED_* | BLOCKED_RLS ✅ |
| 14 | Admin A | Org A | Acc B | BLOCKED_* | BLOCKED_RLS ✅ |
| 15 | Manager A | Org A | Acc B | BLOCKED_* | BLOCKED_RLS ✅ |
| 16 | Sales A | Org A | Acc B | BLOCKED_* | BLOCKED_RLS ✅ |
| 17 | Viewer A | Org A | Acc B | BLOCKED_* | BLOCKED_RLS ✅ |
| 18 | CS A | Org A | Acc B | BLOCKED_* | BLOCKED_RLS ✅ |
| 19 | Owner B | Org B | Acc A | BLOCKED_* | BLOCKED_RLS ✅ |
| 20 | Admin B | Org B | Acc A | BLOCKED_* | BLOCKED_RLS ✅ |
| 21 | Manager B | Org B | Acc A | BLOCKED_* | BLOCKED_RLS ✅ |
| 22 | Sales B | Org B | Acc A | BLOCKED_* | BLOCKED_RLS ✅ |
| 23 | Viewer B | Org B | Acc A | BLOCKED_* | BLOCKED_RLS ✅ |
| 24 | CS B | Org B | Acc A | BLOCKED_* | BLOCKED_RLS ✅ |

**Resultado:** 12/12 bloqueados pela policy permissiva `Users insert contacts in own org` (subquery em `accounts` casando `organization_id`). Zero `ALLOWED`.

### 4.3 Bloco 3 — Organization cross-org com account própria (12)

| # | Persona | organization_id | account_id | Esperado | Obtido |
|---|---|---|---|---|---|
| 25 | Owner A | Org B | Acc A | BLOCKED_RLS | BLOCKED_RLS ✅ |
| 26 | Admin A | Org B | Acc A | BLOCKED_RLS | BLOCKED_RLS ✅ |
| 27 | Manager A | Org B | Acc A | BLOCKED_RLS | BLOCKED_RLS ✅ |
| 28 | Sales A | Org B | Acc A | BLOCKED_RLS | BLOCKED_RLS ✅ |
| 29 | Viewer A | Org B | Acc A | BLOCKED_RLS | BLOCKED_RLS ✅ |
| 30 | CS A | Org B | Acc A | BLOCKED_RLS | BLOCKED_RLS ✅ |
| 31 | Owner B | Org A | Acc B | BLOCKED_RLS | BLOCKED_RLS ✅ |
| 32 | Admin B | Org A | Acc B | BLOCKED_RLS | BLOCKED_RLS ✅ |
| 33 | Manager B | Org A | Acc B | BLOCKED_RLS | BLOCKED_RLS ✅ |
| 34 | Sales B | Org A | Acc B | BLOCKED_RLS | BLOCKED_RLS ✅ |
| 35 | Viewer B | Org A | Acc B | BLOCKED_RLS | BLOCKED_RLS ✅ |
| 36 | CS B | Org A | Acc B | BLOCKED_RLS | BLOCKED_RLS ✅ |

**Resultado:** 12/12 bloqueados pela cláusula `organization_id = get_user_organization_id()`.

## 5. Resumo consolidado

| Bloco | Aprovados | Total |
|---|---|---|
| 1 — Same-org correto | 12 | 12 |
| 2 — Account cross-org | 12 | 12 |
| 3 — Organization cross-org | 12 | 12 |
| **Total** | **36** | **36** |

### Por papel (todos os cenários)

| Papel | Same-org | Account cross-org | Org cross-org |
|---|---|---|---|
| owner | ALLOWED_ROLLED_BACK ✅ | BLOCKED_RLS ✅ | BLOCKED_RLS ✅ |
| admin | ALLOWED_ROLLED_BACK ✅ | BLOCKED_RLS ✅ | BLOCKED_RLS ✅ |
| manager | ALLOWED_ROLLED_BACK ✅ | BLOCKED_RLS ✅ | BLOCKED_RLS ✅ |
| sales | ALLOWED_ROLLED_BACK ✅ | BLOCKED_RLS ✅ | BLOCKED_RLS ✅ |
| viewer | BLOCKED_RLS ✅ | BLOCKED_RLS ✅ | BLOCKED_RLS ✅ |
| cs | ALLOWED_ROLLED_BACK ✅ | BLOCKED_RLS ✅ | BLOCKED_RLS ✅ |

## 6. Baseline pré/pós

| Métrica | Pré | Pós | Delta |
|---|---|---|---|
| Contatos reais ativos | 1.684 | 1.684 | 0 |
| Contatos totais | 1.733 | 1.733 | 0 |
| Contatos sintéticos MATRIX persistidos | 0 | 0 | 0 |
| Accounts sintéticas ativas | 2 | 2 | 0 |
| `lead_score_recalc_queue` (accounts-base) | 2 | 2 | 0 |

Accounts-base preservadas com nomes/orgs exatos e `deleted_at IS NULL`. Nenhum efeito derivado novo.

## 7. Smoke read-only

- `/app/contacts` carrega normalmente.
- `/app/companies` carrega normalmente.
- Isolamento das accounts-base preservado.
- Zero novos erros de RLS.
- Zero dados reais alterados.

## 8. Estado da RPC temporária

- `REVOKE ALL ... FROM PUBLIC, authenticated, anon, service_role` executado.
- `DROP FUNCTION IF EXISTS public.nsec12_probe_insert_contact_with_account(uuid, uuid, text)` executado.
- `pg_proc` retorna 0 linhas para o nome. ✅
- Nenhum grant residual, nenhuma referência em frontend/Edge Functions.

## 9. Findings

- Nenhum finding novo aberto.
- Zero role escalation, zero cross-tenant leak.

## 10. Decisão final

**CONTACTS.ACCOUNT_ID HOMOLOGADO**

Integridade multi-tenant do vínculo `contacts.account_id` está enforçada em três camadas independentes por RLS:
1. `organization_id = get_user_organization_id()` (isolamento de organização).
2. Subquery `EXISTS` casando `account.organization_id = contact.organization_id` e `account.deleted_at IS NULL` (isolamento de account).
3. Policy RESTRICTIVE `nsec12_contacts_insert_block_viewer` (enforcement de papel).

Sprint parada conforme mandato. Não iniciado: `UPDATE`, `DELETE`, opportunities, activities, proposals, Storage.
