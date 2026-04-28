## Sprint 1 — Fundação de Permissão / Área / Função (silenciosa, com feature flags desligadas)

Auditoria do projeto atual confirmou:

- **Tabela de tenants**: `public.organizations`
- **Vínculo usuário ↔ tenant**: `public.organization_members` (com `organization_id`, `user_id`, `org_role` enum, `status`, `deleted_at`)
- Função `get_user_organization_id()` já existe (retorna org do usuário via `profiles`)
- Função `is_admin_or_owner(_user_id uuid)` já existe (checa `org_role IN ('owner','admin')` no `organization_members`)
- **NÃO existem** `user_belongs_to_tenant(uuid)` nem `is_tenant_admin_or_owner(uuid)` → serão criadas como helpers novos (não substituem nada existente)
- Auth via `auth.uid()`
- `set_updated_at()` não existe globalmente → será criada (idempotente)

Nesta sprint **nenhuma tela, hook, serviço ou rota muda**. Apenas migration de banco. Nenhuma RLS existente é tocada. Nada legado é removido.

---

## O que será criado (1 migration única)

### 1. Helpers de segurança (novos, não substituem nada)

- `public.user_belongs_to_tenant(_tenant_id uuid) returns boolean` — SECURITY DEFINER, `search_path=public`. Verifica `organization_members` com `status='active'` e `deleted_at is null` para `auth.uid()`.
- `public.is_tenant_admin_or_owner(_tenant_id uuid) returns boolean` — SECURITY DEFINER, `search_path=public`. Mesma checagem com `org_role IN ('owner','admin')`.
- `public.set_updated_at()` — trigger genérica idempotente (`CREATE OR REPLACE`).

### 2. Tabelas (todas com `tenant_id uuid not null` referenciando `organizations(id)` lógicamente — sem FK explícita para evitar cascade surpresa, igual ao padrão atual do projeto)

- `crm_permission_roles`
- `crm_departments`
- `crm_business_functions` (FK para `crm_departments`)
- `crm_user_contexts` (FKs para as 3 acima; `legacy_user_type`, `legacy_commercial_function` para futuro backfill; flags individuais de dashboard/automação dinâmica em `false`)
- `crm_feature_flags`

Todas com: `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`, `metadata jsonb default '{}'`, `is_active`/`enabled` default conforme spec, constraints CHECK e UNIQUE `(tenant_id, key)` (ou `(tenant_id, user_id)` em contexts).

### 3. Índices

Todos os listados na spec: por `(tenant_id, key)`, `(tenant_id, is_active)`, FKs em `crm_user_contexts` e `crm_business_functions`.

### 4. Triggers `updated_at`

Uma por tabela, usando `set_updated_at()`.

### 5. RLS

- `ENABLE ROW LEVEL SECURITY` nas 5 tabelas.
- Policy SELECT por tabela: `using (public.user_belongs_to_tenant(tenant_id))`.
- Policy ALL (insert/update/delete) por tabela: `using/with check (public.is_tenant_admin_or_owner(tenant_id))`.
- Nenhuma policy existente em outras tabelas é tocada.

### 6. Seeds idempotentes

Um bloco `DO $$ ... $$` que itera sobre `SELECT id FROM organizations` e faz `INSERT ... ON CONFLICT (tenant_id, key) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, ...` para:

- **5 permissões**: owner(100), admin(90), manager(70), user(40), viewer(10) — todas `is_system=true`
- **7 áreas**: pre_sales, sales, customer_success, finance, operations, it, executive — todas `is_system=true`
- **19 funções** ligadas às áreas via lookup por `(tenant_id, department_key)`: sdr/bdr/ldr (pre_sales), ae/closer/hunter (sales), cs/am/farmer (customer_success), finance/finance_admin (finance), operations/support (operations), technical_support/dev/automation (it), director/owner/viewer (executive). Cada uma com `function_group`, `dashboard_profile_key`, `automation_profile_key`, `is_sales_related` conforme spec.
- **3 feature flags**, todas com `enabled=false`: `dynamic_user_context_enabled`, `dynamic_dashboards_enabled`, `function_automations_enabled`, com `config` jsonb conforme spec.

Nenhum seed em `crm_user_contexts` (sem backfill nesta sprint).

### 7. View de leitura futura

`public.crm_user_context_view` — SELECT-only join de contexts + permissions + departments + business_functions. **Sem `security definer`**. RLS das tabelas base continua valendo.

---

## Validações pós-migration (executadas via `supabase--read_query` após aplicar)

1. Existência das 5 tabelas.
2. RLS ativa em todas (`pg_class.relrowsecurity`).
3. Contagem de policies por tabela (esperado: 2 por tabela).
4. Contagem de seeds por tenant (5 permissões + 7 áreas + 19 funções + 3 flags por org).
5. `enabled=false` em todas as 3 flags.
6. View criada e SELECT-able.

---

## Garantias de não-quebra

- Zero alteração em `profiles`, `organization_members`, `user_roles`, `app_role` enum, ou qualquer tabela existente.
- Zero alteração em policies existentes.
- Zero alteração em código TS/React/hooks/serviços/edge functions.
- Helpers novos têm nomes únicos (`user_belongs_to_tenant`, `is_tenant_admin_or_owner`) — não conflitam com nada.
- Tabelas prefixadas `crm_*` para isolar do schema atual.
- Feature flags desligadas → consumidores futuros (Sprint 2+) caem em fallback.

---

## Riscos

- **Baixíssimo**. Migration aditiva pura. Reversível com `DROP TABLE IF EXISTS crm_*` + `DROP FUNCTION user_belongs_to_tenant, is_tenant_admin_or_owner`.
- Único ponto de atenção: `set_updated_at()` usa `CREATE OR REPLACE` — se já houver uma versão idêntica no projeto, é no-op; se houver versão divergente, ela é sobrescrita pela versão padrão. Vou verificar antes via `pg_proc` e, se já existir, **não sobrescrever** (usar `CREATE FUNCTION IF NOT EXISTS` via bloco condicional).

---

## Próximos passos (após aprovação)

1. Aplicar a migration única (helpers + tabelas + índices + triggers + RLS + seeds + view).
2. Rodar as 6 validações via `read_query`.
3. Entregar resumo final: tabelas, policies, seeds por tenant, flags, e confirmação de zero impacto em telas/usuários.
