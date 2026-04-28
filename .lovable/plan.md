# Sprint 4 — Motor de Dashboards Dinâmicos (preview only)

Objetivo: criar a infraestrutura silenciosa que resolve qual dashboard cada usuário deveria ver, com fallback total e somente em modo preview. O dashboard real, sidebar, login, rotas e flags permanecem intocados.

## 1. Migration de schema

Arquivo: `supabase/migrations/<timestamp>_sprint4_dashboard_resolver.sql`

### Tabela `crm_dashboard_profiles`
- Campos exatamente como especificado (id, tenant_id, key, name, description, scope_type, scope_key, layout/widgets/filters/permissions/metadata jsonb, is_system, is_active, timestamps).
- Constraints: key/name não vazios, `scope_type in ('user','business_function','department','permission_role','default')`, unique (tenant_id, key) e (tenant_id, scope_type, scope_key).
- Índices: (tenant_id, key), (tenant_id, scope_type, scope_key), (tenant_id, is_active).
- Trigger `set_updated_at()`.
- RLS on. Policies:
  - SELECT: `user_belongs_to_tenant(tenant_id)`.
  - ALL (manage): `is_tenant_admin_or_owner(tenant_id)`.

### Tabela `crm_dashboard_resolution_logs`
- Campos como especificado (append-only, sem updated_at).
- FK `resolved_profile_id` → `crm_dashboard_profiles(id)` ON DELETE SET NULL.
- Check em `resolution_source` com os 7 valores permitidos.
- Índices: (tenant_id, user_id, created_at desc), (tenant_id, resolution_source, created_at desc), (tenant_id, fallback_used, created_at desc).
- RLS on. Apenas policy de SELECT para Owner/Admin. Inserção exclusivamente via RPC SECURITY DEFINER.

## 2. Seeds idempotentes

Mesma migration, bloco `DO $$ ... $$` que itera por todos os tenants distintos de `crm_user_contexts` e faz `INSERT ... ON CONFLICT (tenant_id, key) DO NOTHING` para os 10 placeholders:

1. `dashboard_legacy_default` (default/default)
2. `dashboard_owner_placeholder` (permission_role/owner)
3. `dashboard_admin_placeholder` (permission_role/admin)
4. `dashboard_manager_placeholder` (permission_role/manager)
5. `dashboard_user_placeholder` (permission_role/user)
6. `dashboard_sales_closer_placeholder` (business_function/closer)
7. `dashboard_pre_sales_sdr_placeholder` (business_function/sdr)
8. `dashboard_cs_placeholder` (business_function/cs)
9. `dashboard_operations_placeholder` (department/operations)
10. `dashboard_finance_placeholder` (department/finance)

Todos `is_system=true`, `is_active=true`, layout/widgets exatos do briefing.

## 3. RPC `crm_resolve_dashboard_profile(p_tenant_id, p_user_id, p_preview default true)`

`security definer`, `set search_path = public`, `grant execute to authenticated`.

Fluxo:
1. Validar `auth.uid()` não nulo.
2. Validar `user_belongs_to_tenant(p_tenant_id)` — caller.
3. Validar p_user_id pertence ao tenant via `organization_members` (status active/suspended).
4. Buscar contexto em `crm_user_context_view` (permission_key, department_key, business_function_key, is_dashboard_dynamic_enabled).
5. Buscar flag `dynamic_dashboards_enabled` e `dynamic_user_context_enabled` em `crm_feature_flags` para o tenant.
6. Montar lista de candidatos em ordem (user → business_function → department → permission_role → default), descartando entradas com scope_key nulo.
7. Buscar primeiro profile `is_active=true` que bata; armazenar `candidate_profiles` (array com tentativas avaliadas).
8. Definir `resolution_source` e `fallback_used`/`fallback_reason`:
   - sem contexto → `legacy_fallback` + `missing_user_context`.
   - sem match → `legacy_fallback` + `no_matching_profile` (resolve `dashboard_legacy_default`).
   - exception → `error_fallback` + mensagem segura.
   - se flag global desligada e profile não-legacy resolvido → `fallback_reason = 'dynamic_dashboards_disabled'` (mas `resolution_source` continua sendo a real, `fallback_used = true` apenas quando caímos no legacy).
9. `should_use_dynamic_dashboard = true` SOMENTE se: `p_preview=false` AND `dynamic_dashboards_enabled=true` AND `is_dashboard_dynamic_enabled=true` AND profile encontrado AND `fallback_used=false` AND `layout->>'type' <> 'legacy'`.
10. Inserir log em `crm_dashboard_resolution_logs` com snapshot de contexto, candidatos, flags e metadata `{created_by_sprint:'dashboard_resolver_sprint_4', preview:p_preview, caller_user_id:auth.uid()}`.
11. Retornar jsonb no formato do briefing.

Bloco `EXCEPTION WHEN OTHERS` para garantir error_fallback + log.

## 4. Frontend (preview only, Owner/Admin)

### Service
`src/services/crm/dashboardProfiles.ts`
- `getDashboardProfiles(tenantId)`
- `resolveDashboardProfilePreview(tenantId, userId)` → chama RPC com `p_preview=true`
- `getDashboardResolutionLogs(tenantId, { limit=50 })`

### Hook
`src/hooks/dashboard/useDashboardResolver.ts`
- `useDashboardProfiles()`, `useResolveDashboardPreview()` (mutation), `useDashboardResolutionLogs()`
- Stub não-usado: `useResolvedDashboardForCurrentUser()` (criado mas NÃO importado pelo dashboard real).

### Componentes
`src/components/settings/dashboardResolver/`
- `DashboardPreviewModal.tsx` — Dialog com seções: Usuário, Permissão/Área/Função, Flags (global + individual), Dashboard resolvido, Fonte, Fallback + motivo, Lista de candidatos avaliados, Widgets placeholder, Aviso "Uso real: Não, dashboard atual permanece ativo". Se `requires_review=true`, exibe Alert amarelo. Botão único: Fechar.
- `DashboardResolutionBadge.tsx` — badge colorido por `resolution_source`.
- `DashboardCandidateList.tsx` — lista das tentativas (ordem + match/miss).
- `DashboardPlaceholderWidgets.tsx` — render dos widgets jsonb como cards "placeholder".

### Integração na aba existente
`src/components/settings/userContext/UserContextTab.tsx`:
- Adicionar coluna/ação "Preview Dashboard" por linha (ícone + tooltip), visível só para Owner/Admin (já é o caso da aba inteira).
- Ao clicar, abrir `DashboardPreviewModal` com `tenant_id` + `user_id` da linha.
- (Opcional, se não inflar) subaba "Logs de resolução" com tabela simples (Data, Usuário, Dashboard, Fonte, Fallback, Motivo, Preview), top 50. Se ficar pesado, omitir nesta sprint conforme o briefing autoriza.

Nenhuma mudança em sidebar, rotas, login, dashboard real ou no componente `Dashboard.tsx`.

## 5. Validações pós-deploy

Rodar via `supabase--read_query`:
1. `select tenant_id, count(*) from crm_dashboard_profiles group by 1` → 10 por tenant (7 tenants → 70 total).
2. `select count(*) from crm_dashboard_resolution_logs` → 0.
3. Flags: 3 chaves × 8 tenants, todas `false`.
4. Sem duplicatas em (tenant_id, scope_type, scope_key).
5. Após preview manual no UI, logs > 0 com `resolution_source` esperado e `fallback_used` correto.

## 6. Garantias de não-regressão

- Não toca: `Dashboard.tsx`, `App.tsx`, sidebar, rotas, login, `organization_members`, `user_roles`, `profiles`, `crm_user_contexts`, `crm_feature_flags`.
- Não habilita nenhuma flag.
- RPC isolada, sem efeitos colaterais além do log.
- Rollback documentado: drop da RPC + 2 tabelas, nada mais.

## Arquivos a criar/editar

**Criar**
- `supabase/migrations/<ts>_sprint4_dashboard_resolver.sql`
- `src/services/crm/dashboardProfiles.ts`
- `src/hooks/dashboard/useDashboardResolver.ts`
- `src/components/settings/dashboardResolver/DashboardPreviewModal.tsx`
- `src/components/settings/dashboardResolver/DashboardResolutionBadge.tsx`
- `src/components/settings/dashboardResolver/DashboardCandidateList.tsx`
- `src/components/settings/dashboardResolver/DashboardPlaceholderWidgets.tsx`

**Editar (mínimo)**
- `src/components/settings/userContext/UserContextTab.tsx` — adicionar ação "Preview Dashboard" na linha.

## Riscos

- View `crm_user_context_view` precisa estar acessível dentro da RPC (já é definer + search_path public). ✅
- Logs append-only podem crescer; índices cobrem consultas; sem retenção nesta sprint (aceitável).
- Se `is_dashboard_dynamic_enabled` na view vier `null` para usuários não-revisados, tratar como `false` no resolver.

## Definição de pronto

Owner/Admin abre Configurações → Equipes e Usuários → Contexto CRM → Preview Dashboard em qualquer linha; modal mostra profile resolvido, candidatos e fallback; logs registram cada chamada; `should_use_dynamic_dashboard` retorna sempre `false`; nenhuma flag ativada; dashboard real, sidebar, login e rotas inalterados.
