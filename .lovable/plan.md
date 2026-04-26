
# Sprint 1.3 — MCP Registry UI (NOID Intelligence)

Sprint focada **somente em interface administrativa** para visualizar e gerenciar os dados criados nas Sprints 1.1 e 1.2. Sem execução, sem gateway, sem permissions UI, sem invocations UI, sem audit logs UI.

---

## 1. Posicionamento e rota

A área NOID Intelligence já existe em `/app/settings/noid-intelligence` (SettingsLayout + breadcrumbs já configurados). Vou aproveitar a estrutura existente:

- **Hub**: adicionar card **MCP Registry** (categoria *Configurações Técnicas*) no `NoidIntelligenceHub.tsx` — sem criar segunda sidebar.
- **Rota base**: `/app/settings/noid-intelligence/mcp-registry`
- **Subrotas (tabs internas via state, não rotas filhas)** — uma página única com `Tabs` para evitar inflar o `App.tsx`:
  - Overview, Servers, Tools, Resources, Prompts, Settings
- **Breadcrumbs**: adicionar entrada em `SettingsLayout.tsx`:
  ```
  '/app/settings/noid-intelligence/mcp-registry': { label: 'MCP Registry', parent: { label: 'NOID Intelligence', href: '/app/settings/noid-intelligence' } }
  ```

---

## 2. Controle de acesso

Reutilizar hooks existentes — **sem criar lógica paralela**:

- `useCurrentOrganization()` → `isOwner`, `isAdmin`
- `usePlatformAdmin()` → `isPlatformAdmin`, `isSuperAdmin`

Regra de acesso (`canAccessMcpRegistry`):
```
isOwner || isAdmin || isPlatformAdmin
```

Aplicação:
1. **Hub card** só renderiza se `canAccessMcpRegistry === true`.
2. **Página** valida no topo; se negado, renderiza `<AccessDenied />` (componente já existe) com texto: *"Acesso restrito. O MCP Registry é uma configuração técnica do NOID Intelligence."*
3. **Edição de registros globais** (`organization_id IS NULL`) só liberada se `isPlatformAdmin === true`. Caso contrário, item global é exibido em modo read-only com badge "Global" e botões de edição desabilitados com tooltip: *"Item global — somente platform admin pode editar."*

---

## 3. Estrutura de arquivos

### Página principal
- `src/pages/settings/noid-intelligence/McpRegistryPage.tsx` — página única com Tabs.

### Tabs (componentes, mesmo diretório)
- `src/components/mcp-registry/tabs/OverviewTab.tsx`
- `src/components/mcp-registry/tabs/ServersTab.tsx`
- `src/components/mcp-registry/tabs/ToolsTab.tsx`
- `src/components/mcp-registry/tabs/ResourcesTab.tsx`
- `src/components/mcp-registry/tabs/PromptsTab.tsx`
- `src/components/mcp-registry/tabs/SettingsTab.tsx`

### Componentes reutilizáveis
- `src/components/mcp-registry/MCPRegistryHeader.tsx` — título, subtítulo, banner de segurança.
- `src/components/mcp-registry/MCPMetricCard.tsx`
- `src/components/mcp-registry/MCPStatusBadge.tsx` — `draft|active|inactive|archived|enabled|disabled`
- `src/components/mcp-registry/MCPRiskBadge.tsx` — `low|medium|high|critical`
- `src/components/mcp-registry/MCPExecutionModeBadge.tsx`
- `src/components/mcp-registry/MCPScopeBadge.tsx` — Global vs Organização
- `src/components/mcp-registry/MCPJsonViewer.tsx` — read-only `<pre>` com formatação.
- `src/components/mcp-registry/MCPJsonEditor.tsx` — `<Textarea>` com validação `JSON.parse` antes de salvar.
- `src/components/mcp-registry/MCPEmptyState.tsx`
- `src/components/mcp-registry/MCPConfirmDialog.tsx` (wrapper sobre `AlertDialog` shadcn)
- `src/components/mcp-registry/forms/MCPServerForm.tsx`
- `src/components/mcp-registry/forms/MCPToolForm.tsx`
- `src/components/mcp-registry/forms/MCPResourceForm.tsx`
- `src/components/mcp-registry/forms/MCPPromptForm.tsx`
- `src/components/mcp-registry/MCPSettingsPanel.tsx`

### Camada de serviço
- `src/services/mcp-registry/mcpRegistryService.ts` — todos os CRUDs e helpers, usando o cliente Supabase normal (RLS aplicada).
- `src/hooks/useMcpRegistry.ts` — hooks React Query (`useMcpServers`, `useMcpTools`, `useMcpResources`, `useMcpPrompts`, `useMcpSettings`, `useMcpOverviewMetrics`) + mutations.

---

## 4. Camada de serviço (resumo das funções)

```ts
// listagens (RLS já filtra por organização + globais com organization_id IS NULL)
listMcpServers(filters?)         // mcp_servers
listMcpTools(filters?)           // join virtual com server.name
listMcpResources(filters?)
listMcpPrompts(filters?)
getMcpSettings(orgId)            // .maybeSingle()
getMcpOverviewMetrics(orgId)     // contagens agregadas por status

// mutações (organization_id sempre = currentOrgId; global bloqueado para não-platform-admin)
createMcpServer / updateMcpServer / setMcpServerStatus(id, 'active'|'inactive'|'archived')
createMcpTool / updateMcpTool / toggleMcpTool(id, enabled)
createMcpResource / updateMcpResource / toggleMcpResource(id, enabled)
createMcpPrompt / updateMcpPrompt / setMcpPromptStatus(id, status)
createMcpSettingsIfMissing(orgId)
updateMcpSettings(id, payload)

// auditoria
logMcpAudit({ entityType, entityId, action, afterJson, metadata })
   // chama supabase.rpc('mcp_log_audit', { p_organization_id, p_user_id: auth.uid(), ... })
```

**Regras de segurança no serviço:**
- `organization_id` sempre obtido do contexto (`useCurrentOrganization`) — nunca aceito como argumento da UI.
- `p_user_id` enviado para `mcp_log_audit` SEMPRE = `(await supabase.auth.getUser()).data.user.id`. Nunca confia em valor da UI.
- Cada mutação dispara `logMcpAudit` correspondente (`created|updated|enabled|disabled|activated|deactivated|archived`).
- Falha de auditoria é logada mas **não derruba a operação principal** (auditoria é best-effort, mensagem toast separada).

---

## 5. Detalhes por aba

### 5.1 Overview
- Banner de segurança: *"Modo fundação ativo. Nenhuma tool executa ações reais nesta fase."*
- Bloco explicativo "Fundação MCP do NOID Intelligence".
- Cards de métrica (`MCPMetricCard`) em grid 4 colunas (responsivo):
  - Servidores: total / active / draft
  - Tools: total / habilitadas / desabilitadas
  - Resources: total / habilitados
  - Prompts: total / active / draft
- Bloco "Status da organização":
  - Badge `MCP ativo` / `MCP desativado` (de `is_mcp_enabled`)
  - Badge `Servidores externos permitidos` / `Servidores externos bloqueados`
  - Limite diário padrão, retenção de logs.

Métricas via uma única query agregada (`getMcpOverviewMetrics`) usando `head:true, count:'exact'` com filtros por status.

### 5.2 Servers
- Tabela com colunas: Nome, Slug, Tipo, Transporte, Status, Auth, Risco, Escopo, Criado em.
- Filtros: status, tipo, transporte, risco, escopo.
- Drawer/Dialog `MCPServerForm` com todos os enums já definidos no spec.
- Validação client-side (zod): name/slug/server_type/transport_type/status/auth_type/risk_level obrigatórios; metadata JSON válido.
- **Regra externa**: ao tentar `status=active` em `server_type=external` quando `allow_external_servers=false`, bloquear com toast: *"Servidores externos estão bloqueados nas configurações MCP desta organização."*
- Ações: ativar/desativar/arquivar via `setMcpServerStatus` — sem delete físico.

### 5.3 Tools
- Tabela: Nome, Slug, Servidor (resolvido via `useMcpServers`), Categoria, Modo, Risco, Aprovação, Habilitada, Escopo, Criado em.
- Filtros: servidor, categoria, modo, risco, habilitada, requires_approval, escopo.
- Form `MCPToolForm`:
  - `is_enabled` default `false`.
  - Auto-set `requires_approval = true` quando `risk_level ∈ {high, critical}` ou `execution_mode = approval_required` (campo travado em true com tooltip).
  - Se `execution_mode = automatic_controlled`: alerta inline *"Execução automática controlada ainda não está liberada nesta fase."*
  - Validação JSON em `input_schema`, `output_schema`, `metadata`.
- **Sem botão de "executar/testar tool"** — não há chamada a `mcp_record_invocation` nesta sprint.

### 5.4 Resources
- Tabela: Nome, URI Pattern, Tipo, Escopo de leitura, Risco, Habilitado, Escopo, Criado em.
- Form `MCPResourceForm`:
  - `is_enabled` default `false`.
  - Sugestão (não bloqueia) se `read_scope=admin_only` + `risk_level=low` → propor `risk_level=high`.
  - Alerta inline para `resource_type=external`.

### 5.5 Prompts
- Tabela: Nome, Slug, Tipo, Versão, Status, Escopo, Criado em.
- Form `MCPPromptForm`:
  - `status` default `draft`.
  - `version` default `1`, validação `>= 1`.
  - `variables` validado como `JSON.parse` + `Array.isArray`.
  - Aviso ao editar prompt `active`: *"Você está editando um prompt ativo. Para ambientes produtivos, recomendamos criar uma nova versão."*
- **Botão "Duplicar nova versão"** (escopo simples): cria novo registro com `version + 1`, `status='draft'`, mesmo `slug`. Como o índice único atual é `(organization_id, slug)`, slug duplicado quebra. Solução nesta sprint: **manter apenas o aviso e desabilitar o botão "Duplicar versão"** com tooltip *"Disponível em sprint futura quando o versionamento por slug estiver finalizado"* — evita complexidade conforme permite o spec.

### 5.6 Settings
- Carrega `mcp_registry_settings` para `organization_id` atual via `.maybeSingle()`.
- Se ausente: empty state com botão **"Criar settings MCP para esta organização"** → `createMcpSettingsIfMissing` com defaults do spec.
- Painel com switches/inputs e copies do spec:
  - `is_mcp_enabled` (com confirm dialog ao ativar)
  - `allow_external_servers` (com confirm dialog ao ativar)
  - `default_requires_approval`
  - `default_daily_call_limit` (number > 0)
  - `log_retention_days` (number > 0)
  - `metadata` (JSON Editor)

---

## 6. Banco de dados

**Nenhuma migração de schema** nesta sprint — a fundação está pronta. Apenas leituras/escritas via RLS existente e RPC `mcp_log_audit`.

---

## 7. Integração no Hub e App.tsx

### `src/pages/settings/noid-intelligence/NoidIntelligenceHub.tsx`
- Adicionar item:
  ```ts
  {
    id: 'mcp-registry',
    title: 'MCP Registry',
    description: 'Governança técnica de tools, resources e prompts',
    icon: Database, // lucide
    path: '/app/settings/noid-intelligence/mcp-registry',
    available: true,
    requiresAdmin: true, // novo flag → render condicional
  }
  ```
- Filtrar `hubItems` por `canAccessMcpRegistry` antes do `.map`.

### `src/App.tsx`
- Adicionar import lazy:
  ```ts
  const McpRegistryPage = lazy(() => import("./pages/settings/noid-intelligence/McpRegistryPage"));
  ```
- Registrar rota dentro do bloco NOID Intelligence (mesmo padrão `<Route>` simples já usado nas demais).

### `src/pages/settings/SettingsLayout.tsx`
- Adicionar entrada de breadcrumb (item 1).

---

## 8. Estados e UX

- Loading: `Skeleton` (já existe) em todas as tabelas e cards.
- Empty states com texto exato do spec.
- Erros: `toast` com mensagens amigáveis.
- Validação JSON: bloqueia salvamento, exibe mensagem inline + toast *"JSON inválido. Corrija antes de salvar."*
- Mutations usam React Query → `invalidateQueries(['mcp', ...])` para atualização reativa.

---

## 9. O que NÃO será feito (reforço do spec)

- ❌ Aba Permissions (Sprint 1.4)
- ❌ Aba Invocations (Sprint 1.5)
- ❌ Aba Audit Logs (Sprint 1.5)
- ❌ Botão executar/testar tool
- ❌ Chamadas a `mcp_record_invocation`
- ❌ MCP Gateway, servidor MCP HTTP
- ❌ Conexões externas (WhatsApp, Gmail, Apollo, etc.)
- ❌ Alterações em leads/oportunidades/propostas
- ❌ Duplicação do builder ou playground
- ❌ Nova tabela de agentes ou coluna `tenant_id`

---

## 10. Critérios de aceite (mapa para verificação)

Todos os 34 critérios do spec serão atendidos:
- Acesso gated via `usePermissions` + `usePlatformAdmin` ✓
- Tabs Overview/Servers/Tools/Resources/Prompts/Settings ✓
- Métricas reais agregadas via Supabase count ✓
- Tools/Resources nascem desabilitados; Prompts em draft ✓
- Tools `high|critical` forçam `requires_approval=true` ✓
- JSON inválido bloqueia salvamento ✓
- `mcp_log_audit` chamado com `p_user_id = auth.uid()` ✓
- `organization_id` sempre do contexto, nunca da UI ✓
- Globais read-only para não-platform-admin ✓
- RLS preservada (sem service_role no front) ✓

---

## 11. Resumo de entregáveis

**Arquivos novos (~22):**
- 1 página principal
- 6 tabs
- ~13 componentes reutilizáveis (header, badges, json viewer/editor, empty state, confirm dialog, 4 forms, settings panel, metric card, scope badge)
- 1 service file
- 1 hook file (React Query)

**Arquivos editados (3):**
- `src/App.tsx` — 1 import lazy + 1 `<Route>`
- `src/pages/settings/noid-intelligence/NoidIntelligenceHub.tsx` — 1 hub item + filtro de acesso
- `src/pages/settings/SettingsLayout.tsx` — 1 entry de breadcrumb

**Risco:** Baixo. Toda a interação com banco passa por RLS já validada nas Sprints 1.1/1.2. Nenhuma RPC nova, nenhuma migração. A única lógica sensível é o gating de acesso — coberto por reuso dos hooks já existentes (`usePermissions`, `usePlatformAdmin`).

**Pontos de atenção para Sprint 1.4:**
- O índice único atual de `mcp_prompts` `(organization_id, slug)` precisa evoluir para `(organization_id, slug, version)` para suportar versionamento real do botão "Duplicar versão" — adiado para a sprint que tratar de Permissions ou explicitamente de versionamento.
- Considerar adicionar coluna `created_by`/`updated_by` automática via trigger usando `auth.uid()` para reduzir dependência de envio manual desses campos pela UI.
