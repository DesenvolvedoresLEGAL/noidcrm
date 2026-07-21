# Fase 4 — INSERT Canary em `public.contacts` (JWT real)

**Mudança:** NSEC-1.2-CHG-005
**Escopo:** canary isolado (6 probes) — não é matriz completa.
**Metodologia:** RPC `public.nsec12_probe_insert_contact` (SECURITY INVOKER) + PostgREST com JWT dos usuários sintéticos. Rollback interno via `RAISE EXCEPTION 'NSEC12_PROBE_ROLLBACK'`.

## Pre-flight

- `public.contacts` existe. 15 colunas.
- Campos NOT NULL: `id` (default `gen_random_uuid()`), `nome`, `organization_id`, `primeiro_nome` (default `''`).
- `account_id` **NULLABLE** — probes inserem com `NULL`.
- FKs: `account_id → accounts(id)`, `organization_id → organizations(id)`.
- Triggers ativos (8): `trg_contact_nome` (BEFORE INSERT/UPDATE, normaliza nome), `trg_lsrq_contacts_iud` / `trg_nrhs_enqueue_contacts` / `trg_lsrq_contacts_upd` / `trg_osrq_contacts_upd` (AFTER, enfileiram recalc locais), `check_deletion_rate_contacts` / `create_deletion_alert_contacts` / `soft_delete_contact_trigger` (só em DELETE).
- Nenhuma função de trigger usa `pg_net`, `http_*` ou chamada externa (verificado por inspeção de `pg_get_functiondef`). Todos os efeitos derivados são gravações locais transacionais — revertidos pelo rollback.
- Policies em `contacts`:
  - **INSERT** (`Users insert contacts in own org`, PERMISSIVE): `organization_id = get_user_organization_id() AND (account_id IS NULL OR EXISTS accounts.same_org)` — **não filtra por `org_role`**.
  - SELECT/UPDATE/DELETE: ver dump.
- Grants: `authenticated` possui `arwdDxtm`.

Pre-flight seguro: `account_id` opcional, zero efeitos externos, rollback cobre todos os triggers. Prosseguido.

## RPC temporária

- Nome: `public.nsec12_probe_insert_contact(p_organization_id uuid, p_nome text) RETURNS text`
- **SECURITY INVOKER**, `SET search_path = public`.
- `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE TO authenticated`.
- Guards: `auth.uid()` presente, papel JWT `authenticated`, `uid` ∈ 12 usuários sintéticos, `p_organization_id` ∈ {ORG_A, ORG_B}, `p_nome` começa com `SECURITY_TEST_CONTACT_`.
- INSERT com `account_id = NULL` seguido de `RAISE EXCEPTION 'NSEC12_PROBE_ROLLBACK'` → rollback do sub-bloco (INSERT e triggers AFTER revertidos).
- Retornos sanitizados: `ALLOWED_ROLLED_BACK`, `BLOCKED_RLS`, `BLOCKED_CHECK`, `BLOCKED_CONSTRAINT`, `REJECTED_*`, `UNEXPECTED_ERROR`.
- Rollback documentado: `DROP FUNCTION IF EXISTS public.nsec12_probe_insert_contact(uuid, text);` (não executado — RPC mantida até nova aprovação, por mandato).

## Emissão de JWT

- `functions/v1/nsec12-provision-fixtures` (`action=issueToken`) reseta senha do sintético e faz `password grant` no `/auth/v1/token`.
- Probes chamados com `Authorization: Bearer <JWT sintético>` e `apikey: <anon publishable>`. Nenhum probe utilizou `service_role`.

## Resultado dos 6 probes canary

| # | Papel | Origem → Destino | Esperado | Observado |
|---|---|---|---|---|
| 1 | OWNER A | ORG A → ORG A | `ALLOWED_ROLLED_BACK` | `ALLOWED_ROLLED_BACK` ✅ |
| 2 | OWNER B | ORG B → ORG B | `ALLOWED_ROLLED_BACK` | `ALLOWED_ROLLED_BACK` ✅ |
| 3 | OWNER A | ORG A → ORG B | `BLOCKED_RLS` | `BLOCKED_RLS` ✅ |
| 4 | OWNER B | ORG B → ORG A | `BLOCKED_RLS` | `BLOCKED_RLS` ✅ |
| 5 | VIEWER A | ORG A → ORG A | `BLOCKED_RLS` | **`ALLOWED_ROLLED_BACK`** ❌ |
| 6 | VIEWER B | ORG B → ORG B | `BLOCKED_RLS` | **`ALLOWED_ROLLED_BACK`** ❌ |

### Isolamento cross-org
Preservado — probes 3 e 4 bloqueados pela policy same-org.

### Role escalation (viewer)
Probes 5 e 6 revelam que `viewer` consegue INSERT na própria organização em `public.contacts`. A policy de INSERT não diferencia `org_role`. **Mesmo padrão de SEC-011 (accounts)**. Registrado como novo finding `SEC-012` (HIGH, OPEN). Nenhuma correção aplicada nesta rodada, conforme mandato.

## Baseline pré/pós

| Métrica | Pré | Pós |
|---|---|---|
| Contatos reais (`deleted_at IS NULL`) | 1681 | 1681 |
| Contatos totais (com soft-deleted) | 1730 | 1730 |
| Contatos sintéticos ativos (`nome LIKE 'SECURITY_TEST_CONTACT_%'`) | 0 | 0 |

Nenhum registro sintético persistiu. Nenhum contato real alterado. Nenhum efeito derivado observado (rollback do sub-bloco reverte AFTER triggers no mesmo escopo transacional).

## Smoke read-only

- `SELECT count(*) FROM public.contacts WHERE deleted_at IS NULL` retorna baseline inalterado.
- Nenhuma policy, trigger, coluna ou constraint foi alterada.
- Frontend não impactado (nenhum deploy).

## Decisão (canary — NSEC-1.2-CHG-005)

**CONTACTS INSERT CANARY — METODOLOGIA VALIDATED / ROLE ENFORCEMENT FAILED.** Isolamento cross-org OK; role escalation de `viewer` confirmada (HIGH). Registrada como `SEC-012` (OPEN à época).

---

## NSEC-1.2-CHG-006 — Correção do viewer (RESTRICTIVE aditiva)

**Objetivo:** bloquear INSERT em `public.contacts` para papel efetivo `viewer`, sem alterar policies existentes, triggers, RPC temporária ou frontend.

### Pre-flight

- Policy INSERT anterior preservada: `Users insert contacts in own org` (PERMISSIVE, `authenticated`, WITH CHECK exige `organization_id = get_user_organization_id()` e — se `account_id` presente — mesma org do account; não filtra `org_role`).
- `public.contacts.organization_id` é `NOT NULL uuid`.
- Helper `organization_members` acessível de RLS sem recursão (padrão CHG-003 para accounts já validado).
- Modelo de papel efetivo confirmado: `org_role` prioritário; fallback para `role` quando `org_role IS NULL`; filtro `status = 'active'`.
- Rollback registrado antes da aplicação: `DROP POLICY IF EXISTS nsec12_contacts_insert_block_viewer ON public.contacts;`
- Nenhuma alteração feita no pre-flight.

### Policy aplicada

```sql
CREATE POLICY nsec12_contacts_insert_block_viewer
ON public.contacts
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = contacts.organization_id
      AND om.status = 'active'
      AND (
        om.org_role = 'viewer'::org_role
        OR (om.org_role IS NULL AND om.role = 'viewer')
      )
  )
);
```

- `polpermissive = false` (RESTRICTIVE), comando `INSERT`, roles `{authenticated}`.
- Apenas `WITH CHECK`, sem `USING`.
- Policies preservadas em `public.contacts` (6 total): `Admins delete contacts`, `Users can update org contacts`, `Users insert contacts in own org`, `Users update contacts in own org`, `Users view contacts in own org`, `nsec12_contacts_insert_block_viewer` (nova).

### Rollback

```sql
DROP POLICY IF EXISTS nsec12_contacts_insert_block_viewer ON public.contacts;
```

### Reprobes (RPC `nsec12_probe_insert_contact` + JWT sintético via PostgREST)

| # | Papel | Origem → Destino | Esperado | Observado |
|---|---|---|---|---|
| 1 | OWNER A | ORG A → ORG A | `ALLOWED_ROLLED_BACK` | `ALLOWED_ROLLED_BACK` ✅ |
| 2 | OWNER B | ORG B → ORG B | `ALLOWED_ROLLED_BACK` | `ALLOWED_ROLLED_BACK` ✅ |
| 3 | OWNER A | ORG A → ORG B | `BLOCKED_RLS` | `BLOCKED_RLS` ✅ |
| 4 | OWNER B | ORG B → ORG A | `BLOCKED_RLS` | `BLOCKED_RLS` ✅ |
| 5 | VIEWER A | ORG A → ORG A | `BLOCKED_RLS` | `BLOCKED_RLS` ✅ |
| 6 | VIEWER B | ORG B → ORG B | `BLOCKED_RLS` | `BLOCKED_RLS` ✅ |

Nenhum probe usou `service_role`. Todos com `Authorization: Bearer <JWT sintético>` + `apikey: <anon publishable>`.

### Baseline pré/pós (CHG-006)

| Métrica | Pré | Pós |
|---|---|---|
| Contatos reais ativos (excluindo orgs sintéticas) | 1681 | 1681 |
| Contatos sintéticos ativos ou em orgs sintéticas | 0 | 0 |

Nenhum registro sintético persistiu. Nenhum contato real alterado. Nenhum efeito derivado.

### Smoke read-only

- `SELECT` em `public.contacts` continua funcional para papéis autorizados (policies SELECT intactas).
- Nenhuma organização real perdeu leitura.
- Nenhuma policy anterior removida ou alterada.
- RPC `nsec12_probe_insert_contact` continua **SECURITY INVOKER** (`prosecdef = false`).

### Estado da RPC temporária

Mantida por mandato. Não removida nesta rodada.

### Decisão

**NSEC-1.2-CHG-006 → VALIDATED.** SEC-012 marcado como RESOLVED com correção `nsec12_contacts_insert_block_viewer`.

### Pendências

- Matriz completa de INSERT em `contacts` (admin/manager/sales/cs/`account_id`) não executada.
- UPDATE/DELETE em `contacts` não executados.
- RPC temporária permanece por mandato.


---

## NSEC-1.2-CHG-007 — Matriz completa (`account_id = NULL`)

**Escopo:** homologação do INSERT básico em `public.contacts` (sem vínculo com `accounts`), matriz por papel × organização + `organization_id` NULL, seguida da remoção da RPC temporária.

### Baseline (pré/pós idêntico)

| Métrica | Pré | Pós |
|---|---|---|
| `contacts` reais ativos (`deleted_at IS NULL`) | 1684 | 1684 |
| `contacts` reais totais | 1733 | 1733 |
| `contacts` sintéticos persistidos (`nome LIKE 'SECURITY_TEST_CONTACT_%'`) | 0 | 0 |
| Notifications / interactions / entity_snapshots / audit / filas / revenue_events / system_events / workflow_executions sintéticas | 0 | 0 |

Nenhum contato real alterado, nenhuma organização real tocada, nenhuma account tocada.

### Validação de `org_role` (pré-probes)

Confirmado via `SELECT org_role, role FROM organization_members`:

- `manager` → `role='member'`, `org_role='manager'` (A + B).
- `sales` → `role='member'`, `org_role='sales'` (A + B).
- `viewer` → `role='member'`, `org_role='viewer'` (A + B).
- `cs` → `role='member'`, `org_role='cs'` (A + B).
- `owner` / `admin` → `role` legado igual ao `org_role`.

### Bloco 1 — SAME-ORG (12 probes via RPC transacional)

| Papel | Org A → Org A | Org B → Org B |
|---|---|---|
| owner | `ALLOWED_ROLLED_BACK` ✅ | `ALLOWED_ROLLED_BACK` ✅ |
| admin | `ALLOWED_ROLLED_BACK` ✅ | `ALLOWED_ROLLED_BACK` ✅ |
| manager | `ALLOWED_ROLLED_BACK` ✅ | `ALLOWED_ROLLED_BACK` ✅ |
| sales | `ALLOWED_ROLLED_BACK` ✅ | `ALLOWED_ROLLED_BACK` ✅ |
| viewer | `BLOCKED_RLS` ✅ | `BLOCKED_RLS` ✅ |
| cs | `ALLOWED_ROLLED_BACK` ✅ | `ALLOWED_ROLLED_BACK` ✅ |

Total: 10 `ALLOWED_ROLLED_BACK` + 2 `BLOCKED_RLS` — bate 1:1 com a matriz esperada.

### Bloco 2 — CROSS-ORG (12 probes via RPC transacional)

Todos os 6 papéis da Org A tentando inserir na Org B: `BLOCKED_RLS` (6/6).
Todos os 6 papéis da Org B tentando inserir na Org A: `BLOCKED_RLS` (6/6).

Total: 12 `BLOCKED_RLS` ✅.

### Bloco 3 — `organization_id = NULL` (2 probes PostgREST direto)

RPC não alterada (não aceita UUID nulo). INSERT via `POST /rest/v1/contacts` com `organization_id: null`, `account_id: null`, `nome` iniciando por `SECURITY_TEST_CONTACT_`:

| Origem | HTTP | Motivo |
|---|---|---|
| Owner A → NULL | 403 | `42501` — `new row violates row-level security policy for table "contacts"` ✅ |
| Owner B → NULL | 403 | `42501` — idem ✅ |

Zero linhas persistidas.

### Confirmação `account_id = NULL`

Todos os probes usaram `p_organization_id` + `p_nome` na RPC (que insere com `account_id = NULL` fixo) ou PostgREST com `account_id: null` explícito. Nenhum probe referenciou account real ou sintética.

### Totais

| Bloco | Executados | Aprovados | Divergentes |
|---|---|---|---|
| 1 — Same-org | 12 | 12 | 0 |
| 2 — Cross-org | 12 | 12 | 0 |
| 3 — Org NULL | 2 | 2 | 0 |
| **Total** | **26** | **26** | **0** |

### Smoke test read-only pós-probes

- Tela `/contatos` carrega para usuários reais (sem novos erros de RLS).
- Contatos reais permanecem visíveis aos autorizados; nenhum papel real perdeu leitura.
- Nenhum novo erro de RLS em `contacts` nos logs do PostgREST durante a janela.
- Nenhum contato real criado/editado.

### Remoção da RPC temporária

Migration de cleanup executada:

```
REVOKE ALL ON FUNCTION public.nsec12_probe_insert_contact(uuid, text) FROM PUBLIC, authenticated, anon, service_role;
DROP FUNCTION IF EXISTS public.nsec12_probe_insert_contact(uuid, text);
```

Verificações pós-cleanup:

- `pg_proc WHERE proname='nsec12_probe_insert_contact'` → 0 linhas ✅.
- Nenhum grant residual (função inexistente).
- Nenhuma referência em código frontend ou Edge Functions (única ocorrência é em `src/integrations/supabase/types.ts`, arquivo autogerado — regenerado após a migration).
- Policies em `contacts` preservadas:
  - PERMISSIVE: `Users view contacts in own org`, `Users insert contacts in own org`, `Users update contacts in own org`, `Users can update org contacts`, `Admins delete contacts`.
  - RESTRICTIVE: `nsec12_contacts_insert_block_viewer` (ativa).
- Tela de contatos segue carregando; nenhum dado real alterado.

### Estado da policy viewer

`nsec12_contacts_insert_block_viewer` (RESTRICTIVE, FOR INSERT, TO authenticated) — **ativa e preservada**. Não alterada nesta mudança.

### Decisão final

**CONTACTS INSERT BÁSICO HOMOLOGADO** — contato sem `account_id`, isolamento por organização, matriz de papéis. Nenhuma validação executada sobre vínculo contato→empresa.
