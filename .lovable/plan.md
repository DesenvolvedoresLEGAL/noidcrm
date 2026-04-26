# Sprint 1.2 — MCP Registry Foundation: Seeds + RPCs de Governança

## ✅ Pré-validação (Sprint 1.1)
Confirmado via `read_query`:
- 8 tabelas MCP existem com `organization_id` (não `tenant_id`)
- 8 organizações existem em `public.organizations`
- Helpers RLS disponíveis: `user_is_org_member`, `user_is_org_admin`, `is_platform_admin`, `get_user_organization_id`
- Função `update_updated_at_column` disponível
- Tabela `ai_agents` existe (FK de `agent_id`)
- Seeds limpos (0 registros) → idempotência simples

---

## 🎯 Escopo desta sprint

**Apenas migration SQL.** Sem frontend, sem edge functions, sem execução real, sem APIs externas, sem alteração de dados do CRM.

---

## 📦 Migration única — `<timestamp>_mcp_sprint_1_2_seeds_and_rpcs.sql`

### Bloco 1 — Seed do servidor interno (idempotente via `ON CONFLICT (slug) WHERE organization_id IS NULL`)

```sql
INSERT INTO public.mcp_servers (organization_id, name, slug, description, server_type, transport_type, status, auth_type, risk_level, metadata)
VALUES (NULL, 'NOID Internal MCP Server', 'noid_internal_mcp',
  'Servidor MCP interno do NOID Intelligence para registry, contexto, tools controladas, permissões e auditoria.',
  'internal', 'http', 'draft', 'service_role', 'low',
  '{"source":"system_seed","scope":"noid_intelligence","real_execution_enabled":false,"created_by_sprint":"1.2"}'::jsonb)
ON CONFLICT — usando o índice partial único existente da Sprint 1.1 para slug global.
```

### Bloco 2 — Seed de 5 tools (todas `is_enabled=false`)
Inseridas via CTE referenciando o `server_id` do `noid_internal_mcp`:
1. `get_lead_context` — read_only, low, requires_approval=false
2. `draft_whatsapp_followup` — suggestion_only, low, requires_approval=false
3. `draft_email_followup` — suggestion_only, low, requires_approval=false
4. `suggest_next_activity` — suggestion_only, low, requires_approval=false
5. `simulate_stage_update` — approval_required, medium, requires_approval=true

Idempotência via `ON CONFLICT` no índice partial de slug global de `mcp_tools`.

### Bloco 3 — Seed de 7 resources (todos `is_enabled=false`)
1. `crm://lead/{lead_id}` — crm/tenant/low
2. `crm://opportunity/{opportunity_id}` — sales/tenant/low
3. `crm://proposal/{proposal_id}` — proposal/tenant/medium
4. `crm://activity/{activity_id}` — activity/tenant/low
5. `crm://report/proposals_viewed_today` — report/role_based/medium
6. `crm://playbook/pre_sales` — playbook/tenant/low
7. `crm://organization/{organization_id}/sales_rules` — tenant/admin_only/high

Idempotência via `WHERE NOT EXISTS` por `(server_id, uri_pattern)` (não há índice único nesse par, mas usamos guard explícita).

### Bloco 4 — Seed de 5 prompts (todos `status=draft`, `version=1`)
1. `followup_curto_whatsapp` — sales_script
2. `objection_pavilhao_homologada` — objection_handling
3. `proposal_viewed_reactivation` — sales_script
4. `daily_sales_digest` — analysis
5. `pre_sales_call_script` — sales_script

Idempotência via `ON CONFLICT` no índice partial de slug global de `mcp_prompts`.

### Bloco 5 — Seed de `mcp_registry_settings` para todas as organizações existentes

```sql
INSERT INTO public.mcp_registry_settings (organization_id, is_mcp_enabled, allow_external_servers,
  default_requires_approval, default_daily_call_limit, log_retention_days, metadata)
SELECT o.id, false, false, true, 100, 180,
  '{"source":"system_seed","scope":"noid_intelligence","created_by_sprint":"1.2"}'::jsonb
FROM public.organizations o
ON CONFLICT (organization_id) DO NOTHING;
```

→ Cria 8 registros (uma por organização).

---

### Bloco 6 — RPC `public.mcp_log_audit`

`SECURITY DEFINER`, `SET search_path = public`.

**Validações:**
- `p_entity_type` e `p_action` não vazios
- Se `p_organization_id IS NOT NULL`: exigir `user_is_org_member(p_organization_id) OR is_platform_admin(auth.uid())`
- `auth.uid()` aceito como `p_user_id` default

**Comportamento:**
- INSERT em `mcp_audit_logs`
- Retorna `uuid` do log criado

**Concedido:** `GRANT EXECUTE ... TO authenticated`. Service role para seeds internos pode chamar com `p_organization_id = NULL`.

---

### Bloco 7 — RPC `public.check_mcp_permission`

`SECURITY DEFINER`, `SET search_path = public`. Retorno `jsonb`.

**Validações iniciais:**
- `p_organization_id NOT NULL`
- `p_action IN ('read','suggest','execute')`
- pelo menos um de `p_agent_id / p_user_id / p_role_name`
- pelo menos um de `p_tool_id / p_resource_id / p_prompt_id`
- `user_is_org_member(p_organization_id) OR is_platform_admin(auth.uid())` — caso contrário retorna `{"allowed":false,"requires_approval":true,"reason":"Cross-organization access denied"}`

**Lógica de match (CTE):**
- Filtra `mcp_permissions` com `organization_id = p_organization_id` AND `status = 'active'`
- Match de subject: `(agent_id = p_agent_id OR user_id = p_user_id OR role_name = p_role_name)` para os parâmetros não-nulos
- Match de objeto: `(tool_id = p_tool_id OR resource_id = p_resource_id OR prompt_id = p_prompt_id)` para os parâmetros não-nulos
- Filtra por flag da ação: `can_read` / `can_suggest` / `can_execute`

**Retornos:**
- Sem nenhuma permissão na org com subject+objeto match → `{"allowed":false,"requires_approval":true,"reason":"No matching MCP permission found"}`
- Permissões existem mas nenhuma autoriza a ação pedida → `{"allowed":false,"requires_approval":true,"reason":"MCP permission does not allow requested action"}`
- Permitido → `requires_approval = bool_or(requires_approval)` (mais restritiva prevalece). `{"allowed":true,"requires_approval":<bool>,"reason":"Permission granted"}`

**Concedido:** `GRANT EXECUTE ... TO authenticated`.

---

### Bloco 8 — RPC `public.mcp_record_invocation`

`SECURITY DEFINER`, `SET search_path = public`. Retorno `jsonb`.

**Fluxo (12 passos):**
1. Valida `p_organization_id NOT NULL`
2. Valida `user_is_org_member OR is_platform_admin` → senão retorna erro de cross-org
3. Busca `mcp_registry_settings` da org
4. Se não existir → INSERT em `mcp_tool_invocations` com `execution_status='blocked'`, `error_message='MCP settings not found for this organization'`, audit log `blocked_invocation`, return
5. Se `is_mcp_enabled = false` → INSERT blocked, error `'MCP is disabled for this organization'`, audit, return
6. Busca tool por `p_tool_id`
7. Se não existir → blocked `'Tool not found'`
8. Se `is_enabled = false` → blocked `'Tool is disabled'`
9. Mapeia `execution_mode → action`:
   - `read_only` → `read`
   - `suggestion_only` → `suggest`
   - `approval_required` ou `automatic_controlled` → `execute`
10. Chama `check_mcp_permission` (subject = agent_id ou user_id da chamada)
11. Se `allowed=false` → blocked `'Permission denied'`
12. Caso contrário INSERT com:
   - `invocation_type='simulated'`
   - `execution_status='success'`
   - `approval_status = CASE WHEN requires_approval THEN 'pending' ELSE 'not_required' END`
   - `started_at = finished_at = now()`
   - `output_json = '{"simulated":true,"message":"Simulated MCP invocation completed. No external action was executed."}'::jsonb`
   - `risk_level / execution_mode` herdados da tool
   - `volts_consumed = 0`
13. Audit log via `mcp_log_audit` com `entity_type='mcp_invocation'`, `action='simulated_invocation_created'` ou `'blocked_invocation'`
14. Retorna `jsonb` com `invocation_id, execution_status, approval_status, error_message, output_json`

**Crítico:** RPC nunca toca leads, oportunidades, propostas, atividades. Apenas escreve em `mcp_tool_invocations` + `mcp_audit_logs`.

**Concedido:** `GRANT EXECUTE ... TO authenticated`.

---

### Bloco 9 — Auditoria dos próprios seeds

Após criar todas as RPCs, chamar `mcp_log_audit` (via `DO $$ ... $$`) com role de service para registrar:
- 1× `mcp_server` / `system_seed_created`
- 5× `mcp_tool` / `system_seed_created`
- 7× `mcp_resource` / `system_seed_created`
- 5× `mcp_prompt` / `system_seed_created`
- 8× `mcp_registry_settings` / `system_seed_created` (uma por org)

`organization_id = NULL` para os seeds globais; `organization_id = <org>` para settings.

---

## 🔒 Garantias de segurança

- **Sem `tenant_id`** em nenhum lugar
- **Sem nova tabela de agentes** — usa `ai_agents` (FK já estabelecida na Sprint 1.1)
- **Sem service_role no frontend** — RPCs `SECURITY DEFINER` validam org via helpers
- **`search_path = public`** em todas as 3 RPCs (regra core do projeto)
- **Sem cross-org** — `check_mcp_permission` retorna `false` antes de qualquer query
- **Sem execução real** — `mcp_record_invocation` apenas escreve em tabelas MCP
- **RLS Sprint 1.1 não enfraquecido** — apenas adicionamos RPCs e dados; nenhuma policy alterada
- **Idempotente** — pode ser re-executado sem duplicar

---

## 🧪 Validações pós-deploy

```sql
-- 1. Servidor interno
SELECT id, slug, status FROM mcp_servers WHERE slug = 'noid_internal_mcp';
-- → 1 linha

-- 2. Tools (5, todas disabled)
SELECT slug, is_enabled, execution_mode, requires_approval FROM mcp_tools ORDER BY slug;

-- 3. Resources (7, todos disabled)
SELECT uri_pattern, is_enabled, read_scope FROM mcp_resources ORDER BY uri_pattern;

-- 4. Prompts (5, todos draft v1)
SELECT slug, status, version FROM mcp_prompts ORDER BY slug;

-- 5. Settings (8, uma por org)
SELECT organization_id, is_mcp_enabled, allow_external_servers FROM mcp_registry_settings;

-- 6. Permissão sem registro (esperado: allowed=false)
SELECT public.check_mcp_permission(
  p_organization_id := '<org_id>',
  p_role_name := 'admin',
  p_tool_id := (SELECT id FROM mcp_tools WHERE slug='get_lead_context'),
  p_action := 'read');

-- 7. Invocation com MCP desabilitado (esperado: blocked)
SELECT public.mcp_record_invocation(
  p_organization_id := '<org_id>',
  p_tool_id := (SELECT id FROM mcp_tools WHERE slug='get_lead_context'));

-- 8. Invocation registrada
SELECT execution_status, error_message FROM mcp_tool_invocations ORDER BY created_at DESC LIMIT 5;

-- 9. Audit logs dos seeds
SELECT entity_type, action, count(*) FROM mcp_audit_logs GROUP BY 1,2 ORDER BY 1,2;
```

---

## 📋 Resumo entregável

| Item | Quantidade |
|---|---|
| Servidores criados | 1 (`noid_internal_mcp`) |
| Tools criadas | 5 (todas `is_enabled=false`) |
| Resources criados | 7 (todos `is_enabled=false`) |
| Prompts criados | 5 (todos `status=draft`, `version=1`) |
| Settings criadas | 8 (uma por organização) |
| RPCs criadas | 3 (`mcp_log_audit`, `check_mcp_permission`, `mcp_record_invocation`) |
| Audit logs gerados | ~26 (1 server + 5 tools + 7 resources + 5 prompts + 8 settings) |
| Tabelas alteradas | 0 (apenas INSERTs e CREATE FUNCTION) |
| Frontend | 0 arquivos |
| Edge functions | 0 |

---

## ⚠️ Pontos de atenção para Sprint 1.3

1. A Sprint 1.3 criará a UI dentro de **NOID Intelligence → Configurações Técnicas → MCP Registry** (sem rota nova de produto).
2. Toda criação/edição de permissões pela UI deverá usar RPCs (não INSERT direto), pois RLS bloqueia gestão por usuário comum.
3. Antes de habilitar qualquer tool real (`is_enabled=true`), Sprint 1.3 precisará introduzir o MCP Gateway (fora do escopo atual).
4. `is_mcp_enabled=false` em todas as orgs é o estado seguro padrão — UI deverá exigir ação explícita do owner para ativar.
5. `simulate_stage_update` é a única tool com `requires_approval=true` — útil para validar o fluxo de approval na Sprint 1.3.
