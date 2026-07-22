# NSEC-1.2-CHG-025 / CHG-026 — Critical UPDATE/DELETE Canary (Accounts + Contacts + Opportunities)

**Status final:** `NSEC-1.2-CHG-026 VALIDATED — CRITICAL UPDATE/DELETE HOMOLOGADO`
**Data:** 2026-07-21 → 2026-07-22
**Escopo:** UPDATE e DELETE em `public.accounts`, `public.contacts`, `public.opportunities`.

## 1. Contexto CHG-025 (referência histórica)

Executados 36 probes; 30/36 conforme esperado. Falha real: **SEC-019 (viewer UPDATE em accounts+contacts same-org)**. As demais divergências foram falso-negativos da lógica de detecção de soft-delete em `nsec12_probe_contact_write` (não regressão funcional). Fixtures de contatos afetadas pelo incidente foram restauradas (deleted_at→NULL, audit_log/entity_snapshots limpos). RPCs e Edge Function foram mantidas para reprobe.

## 2. NSEC-1.2-CHG-026 — Remediação e reprobe final

### 2.1 Pre-flight (read-only)

- 3 RPCs `nsec12_probe_*_write` ativas, `prosecdef=false`, `search_path=public`.
- Edge Function `nsec12-canary-025` restrita aos 6 usuários sintéticos.
- 6 fixtures WRITE_TARGET intactas (deleted_at NULL, nomes/titles originais).
- Policies INSERT-block-viewer confirmam expressão canônica de papel efetivo (org_role prioritário, fallback para role legacy).
- Nenhuma policy `nsec12_*_update_block_viewer` pré-existente.
- Baseline pré: accounts=4791, contacts=1697, opportunities=2227.
- Zero resíduos do incidente CHG-025 (0 audit `contact_deleted`, 0 snapshots `before_delete` das fixtures).
- Baseline pré-CHG-026: 6 policies em accounts, 6 em contacts.

### 2.2 Policies criadas (aditivas, RESTRICTIVE, FOR UPDATE, TO authenticated)

- `public.accounts` → `nsec12_accounts_update_block_viewer`
- `public.contacts` → `nsec12_contacts_update_block_viewer`

Expressão USING/WITH CHECK equivalente à das policies INSERT-block-viewer homologadas: bloqueia quando o `organization_members` do caller na `organization_id` da linha tem `org_role='viewer'` (ou, se `org_role IS NULL`, `role='viewer'`) e `status='active'`.

Rollback documentado:
```
DROP POLICY IF EXISTS nsec12_accounts_update_block_viewer ON public.accounts;
DROP POLICY IF EXISTS nsec12_contacts_update_block_viewer ON public.contacts;
```

Pós-migration: contagens accounts=7, contacts=7 (baseline+1). Nenhuma policy anterior alterada. Nenhum trigger tocado. Zero mutação de dados.

### 2.3 RPC corrigida: `nsec12_probe_contact_write` (SECURITY INVOKER preservado)

Fluxo DELETE novo:
1. `v_visible_before := EXISTS(id ∧ deleted_at IS NULL)`
2. `DELETE FROM public.contacts WHERE id = p_target_id`
3. `v_visible_after := EXISTS(id ∧ deleted_at IS NULL)`
4. Cenário A (visível→invisível): `RAISE 'NSEC12_ROLLBACK'` → `ALLOWED_ROLLED_BACK`
5. Cenário B (visível→visível): `BLOCKED_RLS`
6. Cenário C (não visível antes): `BLOCKED_NO_VISIBLE_ROW`

O rollback envolve UPDATE de deleted_at do trigger, audit_log e entity_snapshots na mesma sub-transação. Sem SECURITY DEFINER, sem service-role, sem alterar o trigger.

### 2.4 Resultado — 18/18 reprobes

**BLOCO 1 — ACCOUNTS UPDATE**
| Probe | Persona | Target | Esperado | Obtido |
|---|---|---|---|---|
| A-U1 | owner-a | Account A | ALLOWED_ROLLED_BACK | ✅ ALLOWED_ROLLED_BACK |
| A-U2 | owner-b | Account B | ALLOWED_ROLLED_BACK | ✅ ALLOWED_ROLLED_BACK |
| A-U3 | viewer-a | Account A | BLOCKED | ✅ BLOCKED_RLS |
| A-U4 | viewer-b | Account B | BLOCKED | ✅ BLOCKED_RLS |
| A-U5 | owner-a | Account B | BLOCKED | ✅ BLOCKED_RLS |
| A-U6 | owner-b | Account A | BLOCKED | ✅ BLOCKED_RLS |

**BLOCO 2 — CONTACTS UPDATE**
| Probe | Persona | Target | Esperado | Obtido |
|---|---|---|---|---|
| C-U1 | owner-a | Contact A | ALLOWED_ROLLED_BACK | ✅ ALLOWED_ROLLED_BACK |
| C-U2 | owner-b | Contact B | ALLOWED_ROLLED_BACK | ✅ ALLOWED_ROLLED_BACK |
| C-U3 | viewer-a | Contact A | BLOCKED | ✅ BLOCKED_RLS |
| C-U4 | viewer-b | Contact B | BLOCKED | ✅ BLOCKED_RLS |
| C-U5 | owner-a | Contact B | BLOCKED | ✅ BLOCKED_RLS |
| C-U6 | owner-b | Contact A | BLOCKED | ✅ BLOCKED_RLS |

**BLOCO 3 — CONTACTS DELETE**
| Probe | Persona | Target | Esperado | Obtido |
|---|---|---|---|---|
| C-D1 | admin-a | Contact A | ALLOWED_ROLLED_BACK | ✅ ALLOWED_ROLLED_BACK |
| C-D2 | admin-b | Contact B | ALLOWED_ROLLED_BACK | ✅ ALLOWED_ROLLED_BACK |
| C-D3 | viewer-a | Contact A | BLOCKED | ✅ BLOCKED_RLS |
| C-D4 | viewer-b | Contact B | BLOCKED | ✅ BLOCKED_RLS |
| C-D5 | admin-a | Contact B | BLOCKED | ✅ BLOCKED_NO_VISIBLE_ROW |
| C-D6 | admin-b | Contact A | BLOCKED | ✅ BLOCKED_NO_VISIBLE_ROW |

**Total: 18/18 conforme esperado.**

### 2.5 Baseline pós

- accounts=4791, contacts=1697, opportunities=2227 (idêntico ao pré).
- 6 fixtures ativas, `deleted_at IS NULL`, nomes/titles originais preservados.
- 0 markers `SECURITY_TEST_WRITE_CANARY_CHG02%` persistidos em accounts.nome_fantasia ou contacts.primeiro_nome.
- 0 audit_log `contact_deleted` das fixtures.
- 0 entity_snapshots `before_delete` das fixtures.
- Zero mutação de dados reais. Zero egress (pg_net não disparou — sem transição de status).

### 2.6 Cleanup executado

- `DROP FUNCTION public.nsec12_probe_account_write(uuid,text,text)` — pg_proc=0 ✅
- `DROP FUNCTION public.nsec12_probe_contact_write(uuid,text,text)` — pg_proc=0 ✅
- `DROP FUNCTION public.nsec12_probe_opportunity_write(uuid,text,text)` — pg_proc=0 ✅
- Edge Function `nsec12-canary-025` deletada (endpoint indisponível, código local removido) ✅
- `nsec12-provision-fixtures`, secrets compartilhados, publishable key e service role compartilhada preservados.
- Policies `nsec12_*_update_block_viewer` permanecem ativas.
- 6 fixtures WRITE_TARGET intactas.

## 3. Findings

### SEC-019 — Viewer UPDATE same-org (MEDIUM) — **RESOLVED**
- Correções: `nsec12_accounts_update_block_viewer` + `nsec12_contacts_update_block_viewer`.
- Evidência: A-U3, A-U4, C-U3, C-U4 = BLOCKED_RLS.
- Rollback disponível por policy individual.
- Risco residual: matriz completa de UPDATE por papel (manager/sales/cs) não executada nesta canary — classificada como backlog pós-GO.

### Contacts DELETE — reclassificação
As linhas D1/D2 da CHG-025 marcadas como BLOCKED_RLS foram **falso-negativo da ferramenta**, não regressão funcional. O admin same-org sempre teve DELETE autorizado (via soft-delete trigger). A correção necessária estava exclusivamente na RPC de probe. Reprobe CHG-026 confirma o comportamento correto: C-D1/C-D2 = ALLOWED_ROLLED_BACK (rollback do soft-delete válido, com contenção síncrona de audit_log e entity_snapshots).

### SEC-020, SEC-021, SEC-022 — não confirmados
Nenhuma evidência positiva; não abertos como findings.

## 4. Estado final consolidado

| Controle | Evidência | Status |
|---|---|---|
| Accounts UPDATE same-org (owner) | A-U1/A-U2 | PASS |
| Accounts UPDATE viewer | A-U3/A-U4 | PASS (nova policy) |
| Accounts UPDATE cross-tenant | A-U5/A-U6 | PASS |
| Accounts DELETE (todos os cenários) | CHG-025 D1..D6 accounts | PASS (evidência retida) |
| Contacts UPDATE same-org (owner) | C-U1/C-U2 | PASS |
| Contacts UPDATE viewer | C-U3/C-U4 | PASS (nova policy) |
| Contacts UPDATE cross-tenant | C-U5/C-U6 | PASS |
| Contacts DELETE admin same-org | C-D1/C-D2 | PASS (metodologia corrigida) |
| Contacts DELETE viewer | C-D3/C-D4 | PASS |
| Contacts DELETE cross-tenant | C-D5/C-D6 | PASS |
| Opportunities UPDATE (todos) | CHG-025 U1..U6 opportunities | PASS (evidência retida) |
| Opportunities DELETE (todos) | CHG-025 D1..D6 opportunities | PASS (evidência retida) |

## 5. Decisão final

**`NSEC-1.2-CHG-026 VALIDATED — CRITICAL UPDATE/DELETE HOMOLOGADO`**
