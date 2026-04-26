# Sprint 1.5 — MCP Registry: Invocations & Audit Logs

## Objetivo
Adicionar as duas últimas abas do MCP Registry dentro do NOID Intelligence:
- **Invocations** — listagem, detalhe e formulário de **simulação controlada** via RPC `mcp_record_invocation`.
- **Audit Logs** — listagem e detalhe somente-leitura de `mcp_audit_logs`.

Ordem final das abas: Overview · Servers · Tools · Resources · Prompts · Permissions · **Invocations** · **Audit Logs** · Settings.

Nada nesta sprint executa ação real, envia email/WhatsApp, conecta API externa, altera CRM, cria gateway/servidor MCP, ou duplica builder/playground.

## Estado já validado no banco (não precisa migration nova)
- `mcp_tool_invocations` e `mcp_audit_logs` existem com colunas exatas usadas pela UI.
- RLS já correto:
  - SELECT: admin da org + platform_admin (invocations também permite o próprio user_id ver suas chamadas).
  - INSERT/UPDATE/DELETE bloqueados → frontend só pode ler. Mutações **só via RPC**.
- RPC `public.mcp_record_invocation(p_organization_id, p_tool_id, p_agent_id, p_user_id, p_input_json)` já existe, é `SECURITY DEFINER`, faz cross-org guard, trata 4 cenários (settings ausentes, MCP off, tool off/inexistente, sem permissão) e success → retorna `jsonb` com `invocation_id`, `execution_status`, `approval_status`, `error_message`, `output_json`.
- RPC já chama `mcp_log_audit` com action `blocked_invocation` ou `simulated_invocation_created`.

➡️ **Sem migrations obrigatórias.** Patch defensivo opcional listado no fim.

## 1. Tipos novos — `src/services/mcp-registry/types.ts`
Adicionar:
- `McpInvocationType = 'simulated' | 'real'`
- `McpExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'blocked'`
- `McpApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected' | 'expired'`
- Interface `McpToolInvocation` (mapeada 1:1 com colunas reais do banco).
- Interface `McpAuditLog` (idem).
- Interfaces de métricas: `McpInvocationMetrics`, `McpAuditMetrics`.
- Interface `RecordInvocationResult` (retorno da RPC).
- Adicionar `'mcp_invocation'` em `McpAuditEntityType` e `'simulated_invocation_created'`, `'blocked_invocation'`, `'system_seed_created'`, `'system_seed_verified'` em `McpAuditAction`.

## 2. Service — `src/services/mcp-registry/mcpInvocationsService.ts` (novo)
Funções (todas usando o supabase client normal, RLS-compliant, **nunca** service_role):
- `listMcpInvocations(orgId, filters)` — query em `mcp_tool_invocations`, filtros: data range, tool_id, invocation_type, risk_level, execution_mode, approval_status, execution_status, agent_id, user_id. Order by `created_at desc`, limit configurable (default 200).
- `getMcpInvocationById(id)` — single + cast JSON.
- `createSimulatedMcpInvocation({ orgId, toolId, agentId, userId, inputJson })` — chama RPC `mcp_record_invocation`. **Nunca** faz insert direto. Retorna `RecordInvocationResult` para a UI tratar blocked/success/error sem confundir blocked com erro.
- `getMcpInvocationMetrics(orgId)` — count queries em paralelo: total, simulated, blocked, success, failed, pending_approval, last_24h, sum(volts_consumed). Usa `head: true, count: 'exact'` quando possível.
- Helpers de resolução (compartilhados):
  - `listAiAgentsForInvocation(orgId)` — `ai_agents` filtrado por organization_id.
  - `listOrganizationMembersForSelection(orgId)` — reaproveita pattern já em `mcpPermissionsService.ts`.
  - `listMcpToolsForInvocation(orgId)` — visíveis (globais + org), inclui `risk_level`, `execution_mode`, `is_enabled`.

## 3. Service — `src/services/mcp-registry/mcpAuditService.ts` (novo)
- `listMcpAuditLogs(orgId, filters)` — filtros: date range, entity_type, action, user_id, agent_id; metadata JSON filters via `metadata->>'sprint'`, `metadata->>'source'`, `metadata->>'area'` usando `eq` em colunas computadas. Order by `created_at desc`, limit 200.
- `getMcpAuditLogById(id)` — single.
- `getMcpAuditMetrics(orgId)` — count queries paralelas: total, last_24h, last_7d, by entity_type (permission, invocation, settings), seeds (action começa com `system_seed_`), blocked (action = `blocked_invocation`).

## 4. Hooks — extend `src/hooks/useMcpRegistry.ts`
React Query hooks novos:
- `useMcpInvocations(filters)`, `useMcpInvocationDetail(id)`, `useMcpInvocationMetrics()`
- `useCreateSimulatedMcpInvocation()` — mutation com `onSuccess` invalidando keys de invocations, audit logs e overview metrics. **Não** mostra toast aqui — UI decide com base em `execution_status`.
- `useMcpAuditLogs(filters)`, `useMcpAuditLogDetail(id)`, `useMcpAuditMetrics()`
- `useMcpToolsForInvocation()`, `useAiAgentsForInvocation()`, `useOrgMembersForInvocation()` — selects compartilhados.

Todos usam `useCurrentOrganization()` para resolver `organization_id` automaticamente — UI nunca passa orgId manualmente.

Reutilizar `useCanAccessMcpRegistry()` da Sprint 1.3 nas novas tabs.

## 5. Componentes novos — `src/components/mcp-registry/`

### 5.1 Badges (`badges/`)
- `MCPInvocationStatusBadge.tsx` — variantes: pending (default), running (info), success (success), failed (destructive), cancelled (muted), blocked (warning, com ícone Shield).
- `MCPApprovalStatusBadge.tsx` — variantes para 5 estados.
- `MCPInvocationTypeBadge.tsx` — `simulated` (secondary) vs `real` (destructive + tooltip "Registro real encontrado. Esta UI não executa ações reais.").
- `MCPAuditActionBadge.tsx` — mapping de cores por ação (created/updated/enabled/disabled/etc).
- `MCPAuditEntityBadge.tsx` — entity_type → ícone + label.

### 5.2 Invocations (`invocations/`)
- `MCPInvocationsTab.tsx` — wrapper com banner "Ambiente seguro. As invocations desta fase são apenas simulações…", summary cards, filtros, tabela, drawer de detalhe e botão "Criar invocation simulada".
- `MCPInvocationSummaryCards.tsx` — 8 cards (totais, simuladas, bloqueadas, success, com erro, pending approval, últimas 24h, volts consumidos).
- `MCPInvocationFilters.tsx` — date range, selects para tool/type/risk/mode/approval/exec status/agent/user.
- `MCPInvocationTable.tsx` — colunas: Data, Tool (slug + nome resolvido), Tipo (badge), Agente (nome resolvido ou ID curto + copy), Usuário (idem), Risco, Modo, Aprovação, Status, Volts, Erro (truncado). Linha clicável → drawer.
- `MCPInvocationDetailDrawer.tsx` — usa `Sheet`. Mostra todos os campos, `MCPJsonViewer` para input/output/error_message, tabela de timing (started_at/finished_at/duration). Botões: Copiar ID, Copiar input JSON, Copiar output JSON. Sem editar/deletar/aprovar/reprocessar/executar.
- `MCPSimulatedInvocationForm.tsx` — em `Dialog`. Campos: Tool (Combobox com risk/mode/is_enabled visíveis), Agent opcional, User opcional (default = usuário atual, oculto se não houver listagem disponível), Input JSON (`MCPJsonEditor` com validação). Caixa de ajuda (Alert info) explicando como obter success. Submit chama `useCreateSimulatedMcpInvocation` e roteia mensagem por `execution_status`:
  - `success` → toast.success "Simulação registrada com sucesso. Nenhuma ação externa foi executada."
  - `blocked` → toast.warning "Simulação bloqueada corretamente pela camada MCP." + mostra `error_message`.
  - erro técnico (RPC retorna erro Postgres) → toast.error "Não foi possível registrar a simulação MCP."
  Após qualquer resposta da RPC (success ou blocked), invalida queries e fecha o dialog.

### 5.3 Audit Logs (`audit/`)
- `MCPAuditLogsTab.tsx` — wrapper com summary cards, filtros, tabela, drawer.
- `MCPAuditLogSummaryCards.tsx` — 8 cards (total, 24h, 7d, permission events, invocation events, settings events, seed events, blocked events).
- `MCPAuditLogFilters.tsx` — date range, entity_type select, action select, user/agent select, sprint/source/area selects (a partir de metadata).
- `MCPAuditLogTable.tsx` — colunas: Data, Entidade (badge + ID curto), Ação (badge), Usuário, Agente, Entity ID (copy), Origem (`metadata.source`/`area`/`sprint`).
- `MCPAuditLogDrawer.tsx` — usa `Sheet`. Mostra ID, organization_id, entity_type/id/action, user/agent, ip_address, user_agent, created_at, e três `MCPJsonViewer`: before_json, after_json, metadata. Botões: Copiar ID, Copiar entity_id, Copiar JSON. **Sem** editar/deletar/regravar.

## 6. Integração — `src/pages/settings/noid-intelligence/McpRegistryPage.tsx`
Adicionar 2 `TabsTrigger` + 2 `TabsContent` para `invocations` e `audit-logs`, posicionados entre `permissions` e `settings`. Lazy import dos novos tabs para não inflar bundle inicial.

## 7. Overview — atualizar `src/components/mcp-registry/tabs/OverviewTab.tsx`
Adicionar uma nova seção "Atividade & Auditoria" com 8 cards:
- Invocations totais, Invocations 24h, Invocations bloqueadas, Invocations success, Invocations simuladas
- Audit logs totais, Audit logs 7d, Último evento MCP (relative time)

Manter as métricas de permissions da Sprint 1.4. Usar os hooks `useMcpInvocationMetrics()` e `useMcpAuditMetrics()`.

## 8. Segurança — defense-in-depth
- Frontend **nunca** envia `p_user_id` arbitrário para `mcp_record_invocation`. Default: omite p_user_id (RPC já faz `COALESCE(p_user_id, auth.uid())`). Só envia se admin selecionou um membro real da org via combobox.
- Frontend nunca insere direto em `mcp_tool_invocations` nem em `mcp_audit_logs`.
- Tabs gated por `useCanAccessMcpRegistry` (mesmo guard das demais).
- RLS já garante isolamento. Sem alteração de policies.

### Patch defensivo opcional (registrado, **não** aplicado nesta sprint para evitar risco):
A RPC `mcp_record_invocation` aceita `p_user_id` arbitrário. Embora o cross-org guard já bloqueie usar user de outra org, idealmente, espelhando o patch de `mcp_log_audit` da Sprint 1.4, devemos forçar `v_user_id := auth.uid()` quando o caller não for admin/owner/founder/technical_admin/platform_admin. Como a UI já é restrita a admins, isso é defesa em profundidade. **Ponto de atenção registrado para Sprint 2.1.**

## 9. UX patterns
- Empty states usando `MCPEmptyState` existente.
- Loading: skeletons em cards, tabela e drawer.
- Blocked deve **parecer** comportamento de segurança (warning amarelo + ícone Shield), nunca erro vermelho.
- Success da simulação deixa explícito "Nenhuma ação externa foi executada".
- Type `real` aparece com badge destrutivo + tooltip de aviso. UI nunca cria `real`.

## 10. Critérios de aceite (resumo)
- 2 tabs novas dentro do MCP Registry, gated por admin.
- Listagem real, filtros funcionais, métricas reais.
- Detalhes em drawer somente-leitura, com JSON viewer.
- Simulação chama RPC (nunca insert direto), trata 4 cenários (blocked × 3 + success).
- Overview atualizado.
- Sem service_role, sem alteração de RLS, sem chamada externa, sem mexer em CRM, sem duplicar Hub/Builder/Playground.

## Arquivos a criar/editar

**Novos (≈18 arquivos):**
- `src/services/mcp-registry/mcpInvocationsService.ts`
- `src/services/mcp-registry/mcpAuditService.ts`
- `src/components/mcp-registry/badges/MCPInvocationStatusBadge.tsx`
- `src/components/mcp-registry/badges/MCPApprovalStatusBadge.tsx`
- `src/components/mcp-registry/badges/MCPInvocationTypeBadge.tsx`
- `src/components/mcp-registry/badges/MCPAuditActionBadge.tsx`
- `src/components/mcp-registry/badges/MCPAuditEntityBadge.tsx`
- `src/components/mcp-registry/invocations/MCPInvocationsTab.tsx`
- `src/components/mcp-registry/invocations/MCPInvocationSummaryCards.tsx`
- `src/components/mcp-registry/invocations/MCPInvocationFilters.tsx`
- `src/components/mcp-registry/invocations/MCPInvocationTable.tsx`
- `src/components/mcp-registry/invocations/MCPInvocationDetailDrawer.tsx`
- `src/components/mcp-registry/invocations/MCPSimulatedInvocationForm.tsx`
- `src/components/mcp-registry/audit/MCPAuditLogsTab.tsx`
- `src/components/mcp-registry/audit/MCPAuditLogSummaryCards.tsx`
- `src/components/mcp-registry/audit/MCPAuditLogFilters.tsx`
- `src/components/mcp-registry/audit/MCPAuditLogTable.tsx`
- `src/components/mcp-registry/audit/MCPAuditLogDrawer.tsx`

**Editados (4 arquivos):**
- `src/services/mcp-registry/types.ts` (tipos novos)
- `src/hooks/useMcpRegistry.ts` (hooks novos)
- `src/pages/settings/noid-intelligence/McpRegistryPage.tsx` (2 tabs novas)
- `src/components/mcp-registry/tabs/OverviewTab.tsx` (seção Atividade & Auditoria)

**Migrations:** nenhuma obrigatória. Patch defensivo em `mcp_record_invocation` deferido para Sprint 2.1.

## Riscos
- Baixo. Não toca em RLS, RPCs existentes, schema, ou em produtos vivos do CRM.
- Único risco potencial: a RPC retorna `jsonb` que precisamos parsear corretamente — já validei o shape no banco.

## Próximos passos (Sprint 2)
1. Patch defensivo em `mcp_record_invocation` (force `auth.uid()` quando caller não for admin).
2. Estender RPC para aceitar `p_role_name` permitindo testar simulação por role na UI.
3. Aprovação humana de invocations (`approval_status = pending` → admin aprova/rejeita).
4. Início da camada de execução real (MCP Gateway).
