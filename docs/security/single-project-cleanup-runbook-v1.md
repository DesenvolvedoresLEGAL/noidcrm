# NOID Security — Single-Project Cleanup Runbook v1

**Sprint:** NOID-SECURITY 1.2
**Escopo:** procedimento de remoção segura das fixtures sintéticas criadas
no projeto único Lovable Cloud (ref `urihdqturaebhiefwjnw`).

**REGRA ABSOLUTA:** nunca executar cleanup por filtro genérico. Apenas
pelos IDs e prefixos listados aqui. Nenhum dado real (LEGAL/HUMANOID)
pode ser tocado.

## 1. Inventário exato das fixtures

### 1.1 Organizações sintéticas

| Nome | Slug | ID | Criada em |
| --- | --- | --- | --- |
| NOID_SECURITY_ORG_A | noid-security-org-a | `e1c4881f-0cd4-45fb-bc50-48314ce7bca0` | 2026-07-20 |
| NOID_SECURITY_ORG_B | noid-security-org-b | `bea090a6-4c6c-45b1-92e0-83678c687578` | 2026-07-20 |

### 1.2 Usuários sintéticos (auth.users)

Domínio: `example.com` — nenhum e-mail real.
Prefixo: `sec-test-<a|b>-<role>`.
Metadata: `user_metadata.security_test = true`, `note = "SECURITY_TEST_DO_NOT_USE"`.

| Email | Auth ID | Org | Role (org_role) | Legacy role |
| --- | --- | --- | --- | --- |
| sec-test-a-owner@example.com | `58c9eb37-4ae3-4612-bbfd-e873f49b329b` | ORG_A | owner | owner |
| sec-test-a-admin@example.com | `2fc41788-9b17-44c2-b90b-578f72f3e3f2` | ORG_A | admin | admin |
| sec-test-a-manager@example.com | `70f0f9de-677c-46ac-9fe9-12a93f74fee9` | ORG_A | manager | member |
| sec-test-a-sales@example.com | `ec646ad0-b719-4464-be12-aaa5b139a60f` | ORG_A | sales | member |
| sec-test-a-viewer@example.com | `84cfb07e-6009-4a5e-a814-ab0d11a37daf` | ORG_A | viewer | member |
| sec-test-a-cs@example.com | `6da9ebee-770c-439c-9d18-5614fe952ac6` | ORG_A | cs | member |
| sec-test-b-owner@example.com | `4ac56488-9128-4ff4-b236-56e1e06e9526` | ORG_B | owner | owner |
| sec-test-b-admin@example.com | `e29eef51-867a-4c78-b823-2543352611e9` | ORG_B | admin | admin |
| sec-test-b-manager@example.com | `13668a50-d30a-4346-993b-521a67a6d616` | ORG_B | manager | member |
| sec-test-b-sales@example.com | `56eed1b0-542a-43b0-a01c-28a83371854f` | ORG_B | sales | member |
| sec-test-b-viewer@example.com | `ea6ca3ef-e18a-43dc-aaca-5da10a581331` | ORG_B | viewer | member |
| sec-test-b-cs@example.com | `c8a897f4-48c1-4823-a75b-d7f35cb284cc` | ORG_B | cs | member |

### 1.3 Dados de negócio sintéticos

Nenhum criado nesta parada da sprint. Ao retomar as Fases 3.2+, todos os
registros devem usar prefixo `SECURITY_TEST_ORG_A_*` ou
`SECURITY_TEST_ORG_B_*` no campo textual identificador (title, name,
subject) e devem ser registrados nesta seção com seus IDs.

### 1.4 Storage sintético

Nenhum arquivo sintético carregado ainda. Ao carregar, usar prefixo
`SECURITY_TEST_ORG_<A|B>_*.pdf` em path e nome.

### 1.5 Infraestrutura auxiliar temporária

| Recurso | Nome | Propósito | Remover ao fim |
| --- | --- | --- | --- |
| Edge Function | `nsec12-provision-fixtures` | Provisionar fixtures via admin.createUser | sim |
| Secret | `NSEC12_TOKEN2` | Guard header da edge function | sim (via `secrets--delete_secret`) |
| Secret | `NSEC12_PROVISION_TOKEN` | (deprecated, não referenciado) | sim |

## 2. Ordem segura de cleanup

Executar **na ordem exata**. Cada passo é idempotente.

### Passo 1 — Bloquear escrita (opcional, se testes estiverem em andamento)

Suspender memberships:

```sql
UPDATE public.organization_members
SET status = 'suspended'
WHERE organization_id IN (
  'e1c4881f-0cd4-45fb-bc50-48314ce7bca0',
  'bea090a6-4c6c-45b1-92e0-83678c687578'
);
```

Rollback: `UPDATE ... SET status='active' WHERE ...`.

### Passo 2 — Remover dados de negócio sintéticos

Somente por IDs registrados na seção 1.3. Ordem: notifications → activities →
proposal_items → proposals → opportunity_notes → opportunities → contacts →
accounts → user_invitations → convite tokens → misc.

**Nunca** executar `DELETE FROM opportunities WHERE title LIKE 'SECURITY_TEST%'`
sem lista explícita de IDs; usar sempre `id IN (...)`.

### Passo 3 — Remover memberships e roles

```sql
DELETE FROM public.user_roles
WHERE user_id IN (
  '58c9eb37-4ae3-4612-bbfd-e873f49b329b','2fc41788-9b17-44c2-b90b-578f72f3e3f2',
  '70f0f9de-677c-46ac-9fe9-12a93f74fee9','ec646ad0-b719-4464-be12-aaa5b139a60f',
  '84cfb07e-6009-4a5e-a814-ab0d11a37daf','6da9ebee-770c-439c-9d18-5614fe952ac6',
  '4ac56488-9128-4ff4-b236-56e1e06e9526','e29eef51-867a-4c78-b823-2543352611e9',
  '13668a50-d30a-4346-993b-521a67a6d616','56eed1b0-542a-43b0-a01c-28a83371854f',
  'ea6ca3ef-e18a-43dc-aaca-5da10a581331','c8a897f4-48c1-4823-a75b-d7f35cb284cc'
);
```

`organization_members` é removido em cascata via `ON DELETE CASCADE` da
FK `user_id` quando o auth.user é deletado (passo 5). Se preferir remover
antes, usar o mesmo filtro `user_id IN (...)`.

### Passo 4 — Remover profiles

```sql
DELETE FROM public.profiles WHERE id IN (<mesma lista de UUIDs>);
```

### Passo 5 — Remover usuários auth

Via `auth.admin.deleteUser(userId)` na mesma edge function
`nsec12-provision-fixtures` (adicionar rota `action:"delete"`) ou
manualmente pelo painel de admin. **Não** deletar via `DELETE FROM auth.users`
por SQL.

### Passo 6 — Remover organizações sintéticas

```sql
DELETE FROM public.organizations
WHERE id IN (
  'e1c4881f-0cd4-45fb-bc50-48314ce7bca0',
  'bea090a6-4c6c-45b1-92e0-83678c687578'
);
```

Cascatas conhecidas: `organization_members` (CASCADE), demais tabelas
com FK a organizations. Antes de executar, rodar:

```sql
SELECT c.confrelid::regclass AS parent, c.conrelid::regclass AS child
FROM pg_constraint c
WHERE c.confrelid = 'public.organizations'::regclass AND c.contype='f';
```

para confirmar o grafo de dependências.

### Passo 7 — Remover infra auxiliar

- `supabase--delete_edge_functions(["nsec12-provision-fixtures"])`
- `secrets--delete_secret` para `NSEC12_TOKEN2` e `NSEC12_PROVISION_TOKEN`

## 3. Validação após cleanup

```sql
SELECT count(*) FROM public.organizations WHERE slug LIKE 'noid-security-org-%'; -- 0
SELECT count(*) FROM auth.users WHERE email LIKE 'sec-test-%@example.com';       -- 0
SELECT count(*) FROM public.organization_members WHERE user_id IN (<lista>);     -- 0
```

## 4. O que **não** pode ser removido automaticamente

- Logs de `system_events`, `auth_audit_log`, `security_audit_log` gerados
  pelas fixtures. **Preservar** como evidência de auditoria.
- Registros em `admin_access_logs`.
- Migrations aditivas eventualmente criadas por mudanças AMARELAS durante
  a sprint (essas seguem o rollback próprio no protocolo).

## 5. Como diferenciar dado real de dado sintético

| Sinal | Dado sintético | Dado real |
| --- | --- | --- |
| Slug da org começa com `noid-security-org-` | sim | não |
| E-mail termina em `@example.com` com prefixo `sec-test-` | sim | não |
| `auth.users.raw_user_meta_data->>'security_test' = 'true'` | sim | não |
| Título/nome com prefixo `SECURITY_TEST_ORG_<A\|B>_` | sim | não |

## 6. Responsáveis e log de execução

| Data | Passo executado | IDs | Responsável | Resultado |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |

Preencher em ordem cronológica antes do encerramento da sprint.

## 7. Fixtures ativas de RELACIONAMENTO (NSEC-1.2-CHG-008)

Duas accounts sintéticas base foram provisionadas via PostgREST com JWT real
dos owners sintéticos. Devem permanecer ativas até o encerramento das etapas
de relacionamento (`contacts.account_id`, `opportunities.account_id`,
`activities.account_id`). **Proibido remover enquanto houver testes
dependentes.**

### Account A
| Campo | Valor |
| --- | --- |
| UUID | `36085a30-06a1-491a-a079-a24fb42dd92b` |
| `razao_social` | `SECURITY_TEST_ACCOUNT_ORG_A_BASE` |
| `nome_fantasia` | `SECURITY_TEST_ACCOUNT_ORG_A_BASE` |
| `organization_id` | `e1c4881f-0cd4-45fb-bc50-48314ce7bca0` (NOID_SECURITY_ORG_A) |
| `created_by` | `58c9eb37-4ae3-4612-bbfd-e873f49b329b` (sec-test-a-owner@example.com) |
| Criada em (UTC) | 2026-07-21 |
| Estado | ativo (`deleted_at IS NULL`) |
| Finalidade | FIXTURE BASE PARA TESTES DE RELACIONAMENTO |
| Efeitos derivados | 1 linha em `lead_score_recalc_queue` (account_id = UUID) |

### Account B
| Campo | Valor |
| --- | --- |
| UUID | `b777baac-072a-4c1a-b481-306d0c899f41` |
| `razao_social` | `SECURITY_TEST_ACCOUNT_ORG_B_BASE` |
| `nome_fantasia` | `SECURITY_TEST_ACCOUNT_ORG_B_BASE` |
| `organization_id` | `bea090a6-4c6c-45b1-92e0-83678c687578` (NOID_SECURITY_ORG_B) |
| `created_by` | `4ac56488-9128-4ff4-b236-56e1e06e9526` (sec-test-b-owner@example.com) |
| Criada em (UTC) | 2026-07-21 |
| Estado | ativo (`deleted_at IS NULL`) |
| Finalidade | FIXTURE BASE PARA TESTES DE RELACIONAMENTO |
| Efeitos derivados | 1 linha em `lead_score_recalc_queue` (account_id = UUID) |

### Dependências futuras esperadas
- `contacts.account_id` apontando para uma dessas fixtures.
- `opportunities.account_id` apontando para uma dessas fixtures.
- `activities.account_id` apontando para uma dessas fixtures.
- Registros em `lead_score_recalc_queue`, `entity_snapshots`, `audit_log`,
  `system_events`, `notifications`, `interactions`, `revenue_events`,
  `workflow_executions` vinculados a essas UUIDs.

### Ordem de cleanup futura
1. Soft-delete de filhos vinculados (activities → opportunities → contacts).
2. Limpeza de filas/eventos por UUID exato da account.
3. Soft-delete das accounts (via `UPDATE ... SET deleted_at = now()` — nunca
   `DELETE` físico, para respeitar o trigger de auditoria).
4. Registro em tombstone e atualização deste runbook.

**Nenhum cleanup executado nesta mudança.**
