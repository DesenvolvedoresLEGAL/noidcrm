# Sprint 1.4 — MCP Registry: Permissions

## Contexto verificado no banco

| Item | Estado |
|---|---|
| Tabela `mcp_permissions` | Existe com colunas exatas (`agent_id`, `user_id`, `role_name`, `tool_id`, `resource_id`, `prompt_id`, `can_read/suggest/execute`, `requires_approval`, `max_calls_per_day`, `allowed_scopes`, `status`, `metadata`, audit cols) |
| Constraints DB | `has_subject` (≥1 alvo), `has_object` (≥1 objeto), `status_chk` (active/inactive/archived), `max_calls_chk` (>0 ou null) |
| RLS | SELECT: `user_is_org_admin OR is_platform_admin` · INSERT/UPDATE: `user_is_org_admin` · DELETE: bloqueado |
| FKs | `agent_id → ai_agents`, `tool_id/resource_id/prompt_id → mcp_*` ON DELETE CASCADE |
| RPCs existentes | `check_mcp_permission`, `mcp_log_audit`, `mcp_record_invocation`, `is_platform_admin`, `user_is_org_admin`, `user_is_org_member` |
| Tabelas auxiliares | `ai_agents` (id, name, slug, organization_id, status), `organization_members` (já usado em hooks) |

**Decisão arquitetural**: RLS já é suficientemente forte. Vamos usar **Supabase client direto** para CRUD (INSERT/UPDATE com `user_is_org_admin` enforced no banco) + auditoria via `mcp_log_audit`. As **3 RPCs novas** (`mcp_create_permission`, `mcp_update_permission`, `mcp_set_permission_status`) serão criadas como `SECURITY DEFINER` para centralizar **regras de segurança que CHECK constraints não conseguem expressar** (ex.: bloqueio de `can_execute` em tools `critical` ou `automatic_controlled`, forçar `requires_approval` em risco médio+, regra `admin_only`). O frontend chama as RPCs como caminho preferencial; RLS é a defesa em profundidade.

---

## 1. Migração SQL (1 arquivo)

`supabase/migrations/<ts>_sprint_1_4_mcp_permissions_rpcs.sql`

### 1.1 RPC `public.mcp_create_permission`
- `SECURITY DEFINER`, `search_path = public`
- Assinatura conforme spec (todos os parâmetros)
- Validações:
  1. `auth.uid()` não nulo
  2. `user_is_org_admin(p_organization_id) OR is_platform_admin(auth.uid())` → senão raise `insufficient_privilege`
  3. Exatamente 1 alvo: `(agent_id IS NOT NULL)::int + (user_id IS NOT NULL)::int + (role_name IS NOT NULL)::int = 1`
  4. Exatamente 1 objeto: `(tool_id IS NOT NULL)::int + (resource_id IS NOT NULL)::int + (prompt_id IS NOT NULL)::int = 1`
  5. Se `status='active'`: pelo menos um de `can_read/can_suggest/can_execute = true`
  6. `jsonb_typeof(p_allowed_scopes) = 'array'`, `jsonb_typeof(p_metadata) = 'object'`
  7. **Regras de segurança por objeto**:
     - Se `tool_id`: ler tool. Se `risk_level='critical'` E `can_execute` → raise "Tools críticas não podem receber execução nesta fase"
     - Se `execution_mode='automatic_controlled'` E `can_execute` → raise "Execução automática controlada ainda não está liberada"
     - Se `can_execute` E `risk_level IN ('medium','high','critical')` → forçar `requires_approval := true`
     - Se `execution_mode='approval_required'` → forçar `requires_approval := true`
     - Se `resource_id`: ler resource. Se `read_scope='admin_only'` E (`can_suggest` OR `can_execute`) → raise "Resources admin_only só permitem can_read"
     - Se `prompt_id`: se `can_execute` → raise "Execução de prompt não está liberada nesta sprint"
  8. Se `agent_id`: validar `agent.organization_id = p_organization_id` (cross-org)
  9. Se `user_id`: validar via `organization_members` que pertence à org
- INSERT em `mcp_permissions` com `created_by = auth.uid()`, `updated_by = auth.uid()`
- Chamar `mcp_log_audit` (entity_type=`mcp_permission`, action=`created`, after_json = row)
- Retornar `uuid`

### 1.2 RPC `public.mcp_update_permission`
- Mesma proteção (admin/platform_admin da org da permissão existente)
- **Não aceita** mudar `organization_id`, `agent_id`, `user_id`, `role_name`, `tool_id`, `resource_id`, `prompt_id` (apenas flags + status + metadata + scopes + max_calls)
- Reaplica regras de segurança de can_execute (busca tool/resource/prompt do registro)
- COALESCE para campos opcionais
- Audit `before_json`/`after_json`, action=`updated`

### 1.3 RPC `public.mcp_set_permission_status`
- Validação de admin
- UPDATE status (CHECK enum garante valores)
- Audit action = `activated` | `deactivated` | `archived`

### 1.4 GRANT EXECUTE TO authenticated nas 3 RPCs

### 1.5 Patch leve `mcp_log_audit` — **não-quebra**
Sobrecarga **não** será criada. Em vez disso, adicionar `IF auth.uid() IS NOT NULL AND p_user_id IS NOT NULL AND p_user_id <> auth.uid() AND NOT is_platform_admin(auth.uid()) THEN p_user_id := auth.uid(); END IF;` no início. Frontend ainda envia `auth.uid()`, mas o servidor passa a sobrescrever em caso de tentativa de spoof por usuário não-admin. Este patch é seguro: não muda assinatura nem casos válidos.

---

## 2. Tipos & Service Layer

### 2.1 `src/services/mcp-registry/types.ts` — adicionar
```ts
export type McpPermissionStatus = 'active' | 'inactive' | 'archived';
export type McpPermissionAction = 'read' | 'suggest' | 'execute';
export type McpPermissionTargetType = 'agent' | 'user' | 'role';
export type McpPermissionObjectType = 'tool' | 'resource' | 'prompt';

export interface McpPermission {
  id: string; organization_id: string;
  agent_id: string | null; user_id: string | null; role_name: string | null;
  tool_id: string | null; resource_id: string | null; prompt_id: string | null;
  can_read: boolean; can_suggest: boolean; can_execute: boolean;
  requires_approval: boolean; max_calls_per_day: number | null;
  allowed_scopes: unknown[]; status: McpPermissionStatus;
  metadata: Record<string, unknown>;
  created_at: string; updated_at: string;
}

export interface McpPermissionMetrics {
  total: number; active: number; inactive: number; archived: number;
  by_agent: number; by_user: number; by_role: number;
  with_execute: number; with_approval: number;
}

export interface CheckPermissionResult {
  allowed: boolean; requires_approval: boolean; reason: string;
}
```
Adicionar `'mcp_permission'` ao `McpAuditEntityType` (já é string union).

### 2.2 `src/services/mcp-registry/mcpPermissionsService.ts` (novo)
Funções (todas RLS-safe, validam `orgId`):
- `listMcpPermissions(orgId, filters): Promise<McpPermission[]>` — SELECT direto + filtros (status, target_type, object_type, can_*, requires_approval)
- `createMcpPermission(orgId, input)` → `supabase.rpc('mcp_create_permission', {...})` → refetch by id
- `updateMcpPermission(id, input)` → `rpc('mcp_update_permission', {...})`
- `setMcpPermissionStatus(id, status)` → `rpc('mcp_set_permission_status', {...})`
- `archiveMcpPermission(id)` → atalho para status='archived'
- `testMcpPermission({orgId, agentId?, userId?, roleName?, toolId?, resourceId?, promptId?, action})` → `rpc('check_mcp_permission', {...})` retorna `CheckPermissionResult`
- `getMcpPermissionMetrics(orgId): Promise<McpPermissionMetrics>` — SELECT minimal e agrega no client
- `listAiAgentsForPermissions(orgId): Promise<{id,name,slug}[]>` — `from('ai_agents').select('id,name,slug').eq('organization_id', orgId).order('name')`
- `listUsersForPermissions(orgId): Promise<{user_id, full_name, email}[]>` — join `organization_members → profiles` (mesmo padrão de `PermissionsPage.tsx`)
- `listRolesForPermissions(): {value,label}[]` — constante (founder, owner, admin, technical_admin, manager, sales, pre_sales, support)

### 2.3 `src/hooks/useMcpRegistry.ts` — adicionar hooks
- `useMcpPermissions(filters)`, `useCreateMcpPermission`, `useUpdateMcpPermission`, `useSetMcpPermissionStatus`, `useArchiveMcpPermission`, `useTestMcpPermission` (mutation)
- `useMcpPermissionMetrics()`
- `useAiAgentsForPermissions()`, `useUsersForPermissions()`
- Todos invalidam `['mcp']` e key específica `mcp/permissions`
- **Importar** `useMcpPermissionMetrics` no `OverviewTab` para somar 4 cards novos

---

## 3. Componentes UI (em `src/components/mcp-registry/permissions/`)

| Componente | Propósito |
|---|---|
| `MCPPermissionStatusBadge.tsx` | active/inactive/archived (reutiliza style de `MCPStatusBadge`) |
| `MCPPermissionTargetBadge.tsx` | "Agent: NomeBot" / "User: João" / "Role: admin" com ícone |
| `MCPPermissionObjectBadge.tsx` | "Tool · slug" / "Resource · uri" / "Prompt · slug" |
| `MCPPermissionActionBadges.tsx` | Trio Read/Suggest/Execute (verde/cinza) |
| `MCPPermissionSummaryCards.tsx` | Reusa `MCPMetricCard` x 7 (total, ativas, por agent/user/role, execute, approval) |
| `MCPPermissionFilters.tsx` | Selects de target_type, object_type, status, can_*, requires_approval |
| `MCPPermissionTable.tsx` | Tabela com colunas spec + actions dropdown (Edit, Activate, Deactivate, Archive) |
| `MCPPermissionForm.tsx` | Modal/sheet de create/edit. Step 1 (escolher tipo de alvo + alvo), Step 2 (escolher tipo de objeto + objeto), Step 3 (permissões + approval + max_calls + scopes JSON + metadata JSON). Validações client-side espelhando RPC. Avisos contextuais (tool critical, automatic_controlled, admin_only, prompt execute) |
| `MCPPermissionDetailDrawer.tsx` | Drawer read-only com todos os campos + audit log resumo |
| `MCPPermissionTestPanel.tsx` | Painel inline na aba: form (target type + alvo + object type + objeto + action) + botão "Testar permissão" → exibe `CheckPermissionResult` com 2 badges (allowed, requires_approval) + bloco `reason`. Usa `useTestMcpPermission` |

### 3.1 `src/components/mcp-registry/tabs/PermissionsTab.tsx` (novo)
Layout:
1. Header + descrição
2. `MCPPermissionSummaryCards`
3. Botão "Nova permissão" (abre `MCPPermissionForm`)
4. `MCPPermissionFilters`
5. `MCPPermissionTable` (com empty state, loading, error)
6. Separador
7. `MCPPermissionTestPanel`

### 3.2 `MCPPermissionForm` — regras de segurança client-side (espelham RPC)
- Carrega dados do objeto selecionado (tool/resource/prompt) via cache da query existente
- Se tool `risk_level='critical'`: desabilita switch `can_execute` + tooltip
- Se tool `execution_mode='automatic_controlled'`: idem
- Se tool `risk_level IN ('medium','high','critical')` e `can_execute=true`: força `requires_approval=true` e desabilita switch
- Se tool `execution_mode='approval_required'`: força `requires_approval=true`
- Se resource `read_scope='admin_only'`: desabilita `can_suggest`/`can_execute`
- Se prompt: desabilita `can_execute`
- Validação JSON ao blur (reuso de `MCPJsonEditor` para `allowed_scopes` e `metadata`)
- Bloqueia submit se status=active e nenhum can_*

---

## 4. Wiring

### 4.1 `src/pages/settings/noid-intelligence/McpRegistryPage.tsx`
Adicionar `<TabsTrigger value="permissions">Permissions</TabsTrigger>` entre "Prompts" e "Settings" e `<TabsContent value="permissions"><PermissionsTab /></TabsContent>`. **Não criar nova rota** (mesma página).

### 4.2 `OverviewTab.tsx`
Adicionar 4 `MCPMetricCard` consumindo `useMcpPermissionMetrics`:
- "Permissões totais"
- "Permissões ativas"
- "Com execução liberada"
- "Exigem aprovação"

### 4.3 Acesso
A guarda já existe em `McpRegistryPage` via `useCanAccessMcpRegistry`. A aba herda. Sem mudanças adicionais.

---

## 5. Pontos de atenção / não-fazer

- ❌ Sem aba Invocations / Audit Logs (Sprint 1.5)
- ❌ Sem chamadas a `mcp_record_invocation` no frontend
- ❌ Sem execução real de tool
- ❌ Não criar rota nova (Permissions é aba dentro de `/app/settings/noid-intelligence/mcp-registry`)
- ✅ `organization_id` sempre de `useCurrentOrganization()` — sem dropdown
- ✅ `p_user_id` em audits sempre `auth.uid()` (já é o padrão do service); patch no `mcp_log_audit` adiciona defesa em profundidade
- ✅ Globais (org_id null) podem ser **objeto protegido** mas **permissão é sempre org-scoped**

---

## 6. Resumo de arquivos

**Migração**: 1 arquivo SQL com 3 RPCs novas + patch idempotente em `mcp_log_audit`

**Novos** (TS):
- `src/services/mcp-registry/mcpPermissionsService.ts`
- `src/components/mcp-registry/permissions/` (9 componentes)
- `src/components/mcp-registry/tabs/PermissionsTab.tsx`

**Editados**:
- `src/services/mcp-registry/types.ts` (tipos novos)
- `src/hooks/useMcpRegistry.ts` (8 hooks novos)
- `src/pages/settings/noid-intelligence/McpRegistryPage.tsx` (1 tab nova)
- `src/components/mcp-registry/tabs/OverviewTab.tsx` (4 cards novos)

## 7. Como testar (pós-implementação)
1. Como admin → MCP Registry → aba Permissions visível
2. Criar permissão `role=admin / tool=get_lead_context / can_read=true` → sucesso
3. Painel de teste → role=admin, tool=get_lead_context, action=read → `allowed: true`
4. Mesmo teste com action=execute → `allowed: false`
5. Tentar criar permissão em tool com `risk_level=critical` e `can_execute=true` → bloqueado (UI + RPC)
6. Criar permissão sem alvo / sem objeto / sem ação ativa → bloqueado
7. Login como user comum → aba não aparece, rota retorna `AccessDenied`
8. Verificar audit log: `SELECT entity_type, action FROM mcp_audit_logs WHERE entity_type='mcp_permission' ORDER BY created_at DESC LIMIT 10;`
