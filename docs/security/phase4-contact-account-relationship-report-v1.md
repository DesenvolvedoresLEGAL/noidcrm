# Phase 4 — Contact × Account Relationship Canary Report v1

**Change ID:** NSEC-1.2-CHG-009
**Classe:** Amarela controlada
**Data (UTC):** 2026-07-21
**Superfície:** `public.contacts.account_id`

## 1. Definição da foreign key

```
contacts_account_id_fkey
FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
```

- `ON UPDATE`: NO ACTION (default).
- `contacts.account_id`: `uuid`, NULLABLE.

## 2. Constraint / trigger tenant-aware

- **CHECK constraints em `public.contacts`:** nenhuma.
- **Trigger dedicado de integridade tenant:** nenhum.
- **Triggers ativos em `public.contacts`:** `check_deletion_rate_contacts`, `create_deletion_alert_contacts`, `soft_delete_contact_trigger`, `trg_contact_nome`, `trg_lsrq_contacts_iud`, `trg_lsrq_contacts_upd`, `trg_nrhs_enqueue_contacts`, `trg_osrq_contacts_upd` — todos locais, transacionais, sem HTTP/pg_net/e-mail/Slack/webhook/Edge Function.

## 3. Policies relevantes de INSERT

- PERMISSIVE `Users insert contacts in own org` — WITH CHECK:
  ```
  organization_id IS NOT NULL
  AND auth.uid() IS NOT NULL
  AND organization_id = get_user_organization_id()
  AND (account_id IS NULL OR EXISTS (
        SELECT 1 FROM accounts a
        WHERE a.id = contacts.account_id
          AND a.organization_id = contacts.organization_id
          AND a.deleted_at IS NULL))
  ```
- RESTRICTIVE `nsec12_contacts_insert_block_viewer` — bloqueia viewers (CHG-006).

**Proteção tenant-aware existe dentro da policy permissiva** (subquery em `accounts` casando `organization_id`). Não há constraint/trigger redundante.

## 4. Metodologia da RPC

- Nome: `public.nsec12_probe_insert_contact_with_account(uuid, uuid, text)`.
- `SECURITY INVOKER` ✅ (confirmado; nunca `SECURITY DEFINER`).
- `SET search_path = public`.
- `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated`.
- Guards: identidade sintética via `auth.jwt() ->> 'email'` (`sec-test-*@example.com`), whitelist de UUIDs (2 orgs, 2 accounts), prefixo `SECURITY_TEST_CONTACT_ACCOUNT_`.
- Guard de existência/deleção da account **removido** porque bloqueava artificialmente probes cross-org (RLS de accounts esconde a account da outra org). A whitelist fixa de UUIDs sintéticos preserva o escopo.
- Rollback interno via `RAISE EXCEPTION 'NSEC12_ROLLBACK' USING ERRCODE = 'P0001'` após INSERT.
- Retorno sanitizado (sem UUID, JWT, SQL, PII).

## 5. Confirmação de JWT real e ausência de service role

- Todos os probes usaram `Authorization: Bearer <JWT sintético>` emitido pela Edge Function `nsec12-provision-fixtures` (`action=issueToken`).
- **`service_role` nunca foi utilizado** em nenhum header de probe.
- `apikey` = publishable anon key.

## 6. Resultado dos 8 probes

| # | Persona | organization_id | account_id | Esperado | Obtido | Status |
|---|---|---|---|---|---|---|
| 1 | Owner A | Org A | Account A | `ALLOWED_ROLLED_BACK` | `ALLOWED_ROLLED_BACK` | ✅ |
| 2 | Owner B | Org B | Account B | `ALLOWED_ROLLED_BACK` | `ALLOWED_ROLLED_BACK` | ✅ |
| 3 | Owner A | Org A | Account B | `BLOCKED_RLS` / `BLOCKED_CHECK` / `BLOCKED_CONSTRAINT` | `BLOCKED_RLS` | ✅ |
| 4 | Owner B | Org B | Account A | `BLOCKED_RLS` / `BLOCKED_CHECK` / `BLOCKED_CONSTRAINT` | `BLOCKED_RLS` | ✅ |
| 5 | Viewer A | Org A | Account A | `BLOCKED_RLS` | `BLOCKED_RLS` | ✅ |
| 6 | Viewer B | Org B | Account B | `BLOCKED_RLS` | `BLOCKED_RLS` | ✅ |
| 7 | Owner A | Org B | Account A | `BLOCKED_RLS` | `BLOCKED_RLS` | ✅ |
| 8 | Owner B | Org A | Account B | `BLOCKED_RLS` | `BLOCKED_RLS` | ✅ |

### Análise
- **Same-org (P1–P2):** vínculo `contact→account` válido é permitido para Owner. ✅
- **Account cross-org (P3–P4):** contato da própria org apontando para account de outra org é **bloqueado pela policy tenant-aware** (subquery `accounts a` exige `a.organization_id = contacts.organization_id`). ✅ Nenhum ALLOWED.
- **Viewer (P5–P6):** bloqueado pela `nsec12_contacts_insert_block_viewer`. ✅
- **Organization cross-org (P7–P8):** bloqueado pela cláusula `organization_id = get_user_organization_id()`. ✅

## 7. Baseline pré/pós

| Métrica | Pré | Pós | Delta |
|---|---|---|---|
| Contatos reais ativos | 1.684 | 1.684 | 0 |
| Contatos totais | 1.733 | 1.733 | 0 |
| Contatos sintéticos persistidos | 0 | 0 | 0 |
| Accounts sintéticas ativas | 2 | 2 | 0 |
| `lead_score_recalc_queue` (accounts-base) | 2 | 2 | 0 |

Accounts-base intactas (`36085a30-…-d92b` e `b777baac-…-9f41`, `deleted_at IS NULL`, nomes exatos).

## 8. Efeitos derivados

- Nenhum novo. As duas linhas pré-existentes em `lead_score_recalc_queue` (das accounts-base) permanecem inalteradas — fazem parte do baseline.

## 9. Smoke read-only

- `/app/contacts` e `/app/companies` continuam carregando.
- Isolamento das accounts-base preservado.
- Nenhum novo erro RLS.
- Zero dado real editado.

## 10. Rollback da RPC

- Executado: `DROP FUNCTION IF EXISTS public.nsec12_probe_insert_contact_with_account(uuid, uuid, text);`
- `pg_proc` retorna 0 linhas para o nome. ✅

## 11. Decisão final

**CONTACTS.ACCOUNT_ID CANARY VALIDATED**

Integridade multi-tenant do vínculo `contacts.account_id` está enforçada exclusivamente pela policy permissiva `Users insert contacts in own org` (subquery em `accounts` casando `organization_id`). Nenhum finding aberto.

Matriz completa (26 probes), `UPDATE`/`DELETE`, opportunities, activities, proposals, Storage: **não iniciados** — aguardando autorização explícita.
