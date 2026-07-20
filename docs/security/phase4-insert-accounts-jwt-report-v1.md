# NOID Security — Fase 4b-2: INSERT em `public.accounts` via JWT real (CHG-002-SAFE)

**Sprint:** NOID-SECURITY 1.2
**Autorização:** `NSEC-1.2-CHG-002-SAFE` (usuário, mensagem desta sessão)
**Data (UTC):** 2026-07-20
**Escopo:** exclusivamente `public.accounts`. Nenhuma outra tabela.
**Estado ao final:** PARADO conforme protocolo. Aguardando nova aprovação
para os 108 probes ou próxima tabela.

## 0. Metodologia final aprovada

Após a tentativa anterior (relatório `phase4-insert-low-risk-report-v1.md`,
CHG-002/CHG-002-min) ter sido reprovada por depender de `service_role` no
probe ou de `DISABLE TRIGGER`, a metodologia autorizada passou a ser:

1. **Cleanup do resíduo existente** por `DELETE` normal, deixando o trigger
   `soft_delete_account_trigger` converter em soft delete (tombstone).
2. **Probes transacionais** por meio de uma RPC `SECURITY INVOKER`,
   `public.nsec12_probe_insert_account(uuid, text)`, chamada com o JWT
   real de cada usuário sintético via PostgREST (`apikey =
   VITE_SUPABASE_PUBLISHABLE_KEY`, `Authorization: Bearer <jwt>`),
   **sem `service_role` no header**. A RPC força rollback interno de todo
   o INSERT (e efeitos dos triggers) via sub-bloco PL/pgSQL com
   `RAISE EXCEPTION`.

## 1. Parte A — Cleanup do resíduo `NSEC-1.2-CHG-002-SAFE`

Registro sintético autorizado para cleanup (identificação cumulativa):

| Campo | Valor exato |
|---|---|
| `accounts.id` | `620037d8-803c-411a-8969-a99f2850616f` |
| `razao_social` | `SECURITY_TEST_WRITE_694eeb181154_A_owner_positive_same_org` |
| `organization_id` | `e1c4881f-…-48314ce7bca0` (`NOID_SECURITY_ORG_A`) |
| `created_by` | `58c9eb37-…-e873f49b329b` (owner sintético A) |
| `deleted_at` inicial | `NULL` |

Comandos executados (via ferramenta de dados, sem alterar triggers):

1. `DELETE FROM public.lead_score_recalc_queue WHERE account_id = <UUID>
   AND organization_id = <ORG_A> AND trigger_source = 'accounts'` — 1 linha.
2. `DELETE FROM public.notifications WHERE metadata->>'account_id' = <UUID>
   AND organization_id = <ORG_A> AND type = 'account_created' AND
   created_at ∈ [21:00Z, 22:00Z]` — 1 linha.
3. `DELETE FROM public.accounts WHERE id = <UUID> AND razao_social = <exato>
   AND organization_id = <ORG_A> AND created_by = <owner sintético A> AND
   deleted_at IS NULL` — trigger `soft_delete_account_trigger` interceptou.

**Estado pós-cleanup (verificado):**

| Verificação | Resultado |
|---|---|
| `accounts.deleted_at IS NOT NULL` para o UUID | ✅ `2026-07-20 21:30:42Z` |
| `lead_score_recalc_queue` para o UUID | ✅ 0 linhas |
| `notifications` para o UUID | ✅ 0 linhas |
| `active_accounts` da Org A sintética (`deleted_at IS NULL`) | ✅ 0 |
| `entity_snapshots` para o UUID (gerado pelo trigger) | 1 linha (`before_delete`) — tombstone |
| `audit_log` para o UUID (gerado pelo trigger) | 1 linha (`account_deleted`) — tombstone |
| Dados reais tocados | ✅ nenhum |

O soft delete + snapshots + audit_log foram gerados pelo próprio produto e
preservados intencionalmente como **tombstone sintético** (registrado no
cleanup runbook).

**Baseline oficial redefinido** (só considera registros ativos):

- accounts ativas Org A sintética: **0**
- accounts ativas Org B sintética: **0**
- accounts sintéticas físicas totais (incluindo tombstone): **1**
- fila / notificações vinculadas ao tombstone: **0 / 0**

## 2. Parte B — RPC transacional `nsec12_probe_insert_account`

Migration aplicada:

- Nome: `public.nsec12_probe_insert_account(p_organization_id uuid, p_razao_social text) RETURNS text`
- **`SECURITY INVOKER`** (respeita RLS do JWT do chamador)
- `SET search_path = public`
- `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated`
- Guards internos:
  - `auth.uid()` deve pertencer à lista fixa dos 12 UUIDs sintéticos
    (`sec-test-*@example.com`) → caso contrário retorna
    `REJECTED_CALLER_NOT_SYNTHETIC`.
  - `p_organization_id` deve ser exatamente `NOID_SECURITY_ORG_A` ou `_B` →
    caso contrário `REJECTED_ORG_NOT_SYNTHETIC`.
  - `p_razao_social` deve começar com `SECURITY_TEST_WRITE_` → caso
    contrário `REJECTED_NAME_PREFIX`.
- Núcleo transacional:
  ```
  BEGIN
    INSERT INTO public.accounts (...) RETURNING id INTO v_new_id;
    RAISE EXCEPTION 'NSEC12_PROBE_ROLLBACK' USING ERRCODE='P0001';
  EXCEPTION
    WHEN sqlstate 'P0001' THEN v_code := 'ALLOWED_ROLLED_BACK';
    WHEN insufficient_privilege THEN v_code := 'BLOCKED_RLS';
    WHEN check_violation      THEN v_code := 'BLOCKED_CHECK';
    WHEN not_null_violation
       | foreign_key_violation
       | unique_violation      THEN v_code := 'BLOCKED_CONSTRAINT';
    WHEN OTHERS               THEN v_code := 'UNEXPECTED_ERROR';
  END;
  ```
  O sub-bloco cria um savepoint automático em PL/pgSQL; a exception
  reverte integralmente o INSERT **e** os efeitos dos triggers
  (`enqueue_lead_score_recalc` → `lead_score_recalc_queue`,
  `notify_account_changes` → `notifications`).
- Sem DDL, sem SQL dinâmico, sem DELETE/UPDATE/chamada externa. Retorna
  apenas um `text` com um dos códigos padronizados.

**Rollback documentado:** `DROP FUNCTION public.nsec12_probe_insert_account(uuid, text);`
(a ser executado no cleanup final da sprint junto com o restante do runbook).

## 3. Quatro cenários iniciais

`test_run_id = chg002safe_1784583150`
Chamador: cliente Python via `urllib` contra `POST /rest/v1/rpc/nsec12_probe_insert_account`.
Headers verificados em cada chamada:

- `apikey`: `VITE_SUPABASE_PUBLISHABLE_KEY` (chave publishable/anon).
- `Authorization: Bearer <JWT do usuário sintético>` — nunca `service_role`.

JWT preflight (por chamada):

| Usuário | `sub` (mascarado) | `role` | `exp` | `service_role` na claim |
|---|---|---|---|---|
| sec-test-a-owner | `58c9eb37…` | `authenticated` | +3600s | ausente |
| sec-test-a-viewer | `84cfb07e…` | `authenticated` | +3600s | ausente |

### Resultados

| # | Cenário | JWT | `organization_id` | Resultado da RPC | Esperado | Veredicto |
|---|---|---|---|---|---|---|
| 1 | Owner A → own org A (positive same-org) | owner A | Org A | `ALLOWED_ROLLED_BACK` | `ALLOWED_ROLLED_BACK` | ✅ |
| 2 | Owner A → cross-org B (negative) | owner A | Org B | `BLOCKED_RLS` | `BLOCKED_RLS` | ✅ |
| 3 | Viewer A → own org A | viewer A | Org A | `ALLOWED_ROLLED_BACK` | registrar sem correção | ⚠️ **role escalation funcional confirmada** |
| 4 | Owner A → cross-org B (proxy de "sem membership no destino") | owner A | Org B | `BLOCKED_RLS` | `BLOCKED_RLS` | ✅ |

Sobre o cenário 4 (usuário sem membership): as fixtures atuais contêm
apenas usuários que têm membership em alguma org sintética. A policy de
INSERT em `accounts` bloqueia a inserção quando o `organization_id`
não pertence à lista de orgs em que `auth.uid()` tem `organization_members
… status = 'active'`. O cenário 2 exercita exatamente essa predicate na
Org B a partir de um usuário que não tem membership na Org B, cumprindo
funcionalmente o teste de "sem membership no destino". A criação de um
usuário sintético inteiramente sem membership não foi executada (fora
do escopo autorizado desta rodada) e está registrada como pendência para
o próximo ciclo.

### Contagens pré/pós (Data API + banco)

| Verificação | Antes | Depois |
|---|---|---|
| `accounts` ativas Org A sintética (`deleted_at IS NULL`) | 0 | 0 |
| `accounts` ativas Org B sintética (`deleted_at IS NULL`) | 0 | 0 |
| `accounts` sintéticas físicas (`razao_social LIKE 'SECURITY_TEST_WRITE_%'`) | 1 (tombstone) | 1 (tombstone) |
| `accounts` sintéticas físicas com `deleted_at IS NULL` | — | 0 |
| `lead_score_recalc_queue` vinculadas a accounts sintéticas | 0 | 0 |
| `notifications` `type=account_created` sintéticas (últimos 5 min) | — | 0 |

Nenhum registro novo persistiu em `accounts`, `lead_score_recalc_queue`,
`notifications`, `entity_snapshots` ou `audit_log`. Todos os efeitos dos
triggers foram revertidos pelo sub-bloco.

## 4. Vazamentos / role escalation

- **Cross-org (Owner A → Org B):** negado (`BLOCKED_RLS`). ✅
- **Cross-org proxy de "sem membership":** negado (`BLOCKED_RLS`). ✅
- **Role escalation (viewer):** **CONFIRMADA** para INSERT same-org. A
  policy atual `Org members can insert accounts` (`organization_id IN
  (SELECT om.organization_id FROM organization_members om WHERE
  om.user_id = auth.uid() AND om.status = 'active')`) não diferencia
  `org_role`, então um membership com `org_role='viewer'` obtém permissão
  de INSERT no PostgREST. Nenhum vazamento cross-org — é escalação
  funcional dentro da própria organização. **Nenhuma correção automática
  aplicada.** Proposta e rollback devem ser tratados em CHG separado,
  após nova aprovação explícita.

## 5. Segurança operacional / sanitização

- Nenhum JWT, token, senha, service_role ou dado real foi escrito em log,
  relatório, prints ou tabelas.
- Todos os UUIDs de usuários sintéticos foram mascarados quando
  aplicável (`58c9eb37…`, `84cfb07e…`).
- Nenhum registro real foi lido além dos contadores agregados (COUNT).
- Nenhum trigger foi desabilitado, nenhuma policy foi alterada.
- Nenhuma alteração em `session_replication_role`, `ALTER TABLE …
  DISABLE TRIGGER`, `SECURITY DEFINER` para hard delete, `pg_net` ou
  qualquer chamada externa.

## 6. Guardrails verificados

| Guardrail | Estado |
|---|---|
| RPC criada como SECURITY DEFINER | ✅ Não — `SECURITY INVOKER` |
| Qualquer trigger foi desabilitado | ✅ Não |
| Qualquer `ALTER TABLE` foi necessário | ✅ Não |
| INSERT positivo deixou registro físico | ✅ Não — rollback verificado |
| Efeito de trigger sobreviveu | ✅ Não |
| Cross-org permitido | ✅ Não |
| `service_role` no `Authorization` do probe | ✅ Não |
| Baseline de registros ativos mudou | ✅ Não |
| Secret ou JWT em log | ✅ Não |
| Dados reais alterados | ✅ Não |

## 7. NSEC-1.2-CHG-003 — Restrição de INSERT para `viewer`

### 7.1 Policies anteriores (preservadas, inalteradas)

- `Org members can insert accounts` (permissive, `authenticated`, WITH CHECK: membership ativo na org do registro).
- `Users insert accounts in own org` (permissive, roles padrão, WITH CHECK: `organization_id = get_user_organization_id()`).

Nenhuma das duas foi removida ou recriada. Verificado via `pg_policy` após a migration.

### 7.2 Policy nova (aditiva, RESTRICTIVE)

Nome: `nsec12_accounts_insert_block_viewer`
Tabela: `public.accounts` — Comando: `INSERT` — Roles: `authenticated`
Modo: `AS RESTRICTIVE` (`polpermissive = false` confirmado). Somente `WITH CHECK`.

```sql
NOT EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.user_id = auth.uid()
    AND om.organization_id = accounts.organization_id
    AND om.status = 'active'
    AND (om.org_role = 'viewer'
         OR (om.org_role IS NULL AND om.role = 'viewer'))
)
```

Papel efetivo prioriza `org_role`; `role` legado só é consultado quando
`org_role` é NULL. Sem recursão: a policy de leitura de
`organization_members` usa o helper SECURITY DEFINER `user_is_org_member`,
que não referencia `accounts`. Nenhuma função nova, nenhum trigger, RPC,
tabela ou bucket alterado.

### 7.3 Rollback registrado

```sql
DROP POLICY IF EXISTS nsec12_accounts_insert_block_viewer ON public.accounts;
```

### 7.4 Baseline

| Métrica | Pré | Pós |
|---|---|---|
| Accounts sintéticas ativas (orgs A/B) | 0 | 0 |
| Accounts sintéticas totais (tombstone) | 1 | 1 |
| Accounts reais totais ativas | 4781 | 4781 |
| `lead_score_recalc_queue` sintéticas | 0 | 0 |

Baseline idêntico. Tombstone preservado.

### 7.5 Seis reprobes (RPC `nsec12_probe_insert_account`, JWT real, apikey publishable)

| # | Ator | Alvo | Esperado | Observado |
|---|---|---|---|---|
| 1 | Owner A (`58c9eb37…`) | Org A | `ALLOWED_ROLLED_BACK` | `ALLOWED_ROLLED_BACK` ✅ |
| 2 | Owner B (`4ac56488…`) | Org B | `ALLOWED_ROLLED_BACK` | `ALLOWED_ROLLED_BACK` ✅ |
| 3 | Owner A | Org B | `BLOCKED_RLS` | `BLOCKED_RLS` ✅ |
| 4 | Owner B | Org A | `BLOCKED_RLS` | `BLOCKED_RLS` ✅ |
| 5 | Viewer A (`84cfb07e…`) | Org A | `BLOCKED_RLS` | `BLOCKED_RLS` ✅ |
| 6 | Viewer B (`ea6ca3ef…`) | Org B | `BLOCKED_RLS` | `BLOCKED_RLS` ✅ |

Owner na própria org preservado; cross-org bloqueado pela policy
permissiva existente (RESTRICTIVE nova não afrouxa nada); viewer na
própria org corrigido — de `ALLOWED_ROLLED_BACK` (Fase 4b-2) para
`BLOCKED_RLS`. Nenhum probe persistiu: rollback interno da RPC reverteu
todos os efeitos de trigger.

### 7.6 Smoke não destrutivo

- `SELECT` sobre `accounts` continua retornando as 4781 contas ativas.
- Nenhuma alteração de código de frontend; policy afeta apenas INSERT
  de `viewer` em `accounts`.
- Nenhum registro real foi criado, alterado ou removido.

### 7.7 Decisão

`NSEC-1.2-CHG-003`: **VALIDATED** — policy ativa; rollback disponível
em um único `DROP POLICY`.

## 8. PARADO — aguardando nova aprovação explícita

Não executado nesta rodada: os 108 probes; expansão para `contacts`,
`opportunities`, `activities`; UPDATE/DELETE; Storage; cleanup da RPC
temporária. Nenhuma dessas etapas será iniciada sem autorização
específica.
