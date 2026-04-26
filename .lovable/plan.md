## Sprint 1.1 — Fundação MCP Registry (NOID Intelligence)

### 🎯 Escopo

Criar **somente** a fundação de banco e segurança do MCP Registry como camada técnica avançada do NOID Intelligence. **Nenhuma tela, nenhuma execução real, nenhuma integração externa**.

### 🧭 Decisões arquiteturais (confirmadas)

| Decisão | Resolução |
|---|---|
| Nomenclatura multi-tenant | Coluna física **`organization_id`** (regra core do NOID). O termo "tenant" permanece no domínio conceitual MCP (comentários/docs), mas o schema segue o padrão do CRM. |
| Integração com agentes | FK **`agent_id REFERENCES ai_agents(id) ON DELETE SET NULL`** — preserva histórico de invocations/audit. |
| Helpers RLS | Reusar `get_user_organization_id()`, `user_is_org_member()`, `user_is_org_admin()`, `user_is_org_admin_or_manager()`, `is_platform_admin()`. **Não** criar funções novas. |
| Trigger updated_at | Reusar `public.update_updated_at_column()` existente. |
| Delete | **Bloquear DELETE físico** em todas as tabelas via política RLS `FOR DELETE USING (false)` (soft-archive via campo `status`). |

---

### 📦 Migration única

Será criado **um único arquivo de migration** com toda a fundação, executado via tool de migração:

`supabase/migrations/<timestamp>_mcp_registry_foundation.sql`

#### 1. Tabelas (8)

| Tabela | Propósito | FKs |
|---|---|---|
| `mcp_servers` | Registro de servidores MCP (internos/externos) | — |
| `mcp_tools` | Catálogo de ferramentas expostas por servers | `server_id → mcp_servers(id) ON DELETE CASCADE` |
| `mcp_resources` | Recursos de leitura (CRM, sales, proposal…) | `server_id → mcp_servers(id) ON DELETE CASCADE` |
| `mcp_prompts` | Templates/prompts versionados | — |
| `mcp_permissions` | Quem (agent/role/user) pode quê (tool/resource/prompt) | `tool_id`, `resource_id`, `prompt_id` (cascade); `agent_id → ai_agents(id) ON DELETE SET NULL` |
| `mcp_tool_invocations` | Log estruturado de invocações (simulated/real) | `tool_id → mcp_tools(id) ON DELETE SET NULL`; `agent_id → ai_agents(id) ON DELETE SET NULL` |
| `mcp_audit_logs` | Auditoria imutável de mudanças no registry | `agent_id → ai_agents(id) ON DELETE SET NULL` |
| `mcp_registry_settings` | Configuração por organização (1:1) | — |

Todas as colunas seguem **exatamente** o spec do usuário, com `tenant_id` renomeado para `organization_id`.

#### 2. Constraints CHECK

Aplicadas via `CHECK (col IN (...))` para todos os enums textuais do spec:
- `server_type`, `transport_type`, `status`, `auth_type` em `mcp_servers`
- `risk_level`, `execution_mode` em `mcp_tools` e `mcp_tool_invocations`
- `resource_type`, `read_scope` em `mcp_resources`
- `prompt_type`, `status`, `CHECK (version >= 1)` em `mcp_prompts`
- `status`, `CHECK (max_calls_per_day IS NULL OR max_calls_per_day > 0)` em `mcp_permissions`
- `invocation_type`, `approval_status`, `execution_status`, `CHECK (volts_consumed >= 0)` em `mcp_tool_invocations`
- `CHECK (default_daily_call_limit > 0 AND log_retention_days > 0)` em `mcp_registry_settings`

**Constraints especiais:**

```sql
-- mcp_permissions: precisa ter pelo menos 1 alvo E 1 objeto
ALTER TABLE mcp_permissions ADD CONSTRAINT mcp_permissions_has_subject CHECK (
  agent_id IS NOT NULL OR role_name IS NOT NULL OR user_id IS NOT NULL
);
ALTER TABLE mcp_permissions ADD CONSTRAINT mcp_permissions_has_object CHECK (
  tool_id IS NOT NULL OR resource_id IS NOT NULL OR prompt_id IS NOT NULL
);

-- mcp_servers: slug único por org (com tratamento de NULL para registros globais)
CREATE UNIQUE INDEX idx_mcp_servers_org_slug ON mcp_servers(organization_id, slug)
  WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX idx_mcp_servers_global_slug ON mcp_servers(slug)
  WHERE organization_id IS NULL;

-- mesma estratégia para mcp_tools, mcp_prompts (slug único por server/org)

-- mcp_registry_settings: 1 registro por organização
CREATE UNIQUE INDEX idx_mcp_registry_settings_org ON mcp_registry_settings(organization_id);
```

#### 3. Índices

Todos os índices listados no spec (renomeando `tenant` → `org` onde aplicável). Total: ~50 índices distribuídos entre as 8 tabelas, cobrindo:
- Filtragem por organização (`organization_id`)
- Lookup por status/tipo/categoria
- Joins com `agent_id`, `user_id`, `tool_id`, etc.
- Ordenação por `created_at` em `mcp_tool_invocations` e `mcp_audit_logs`

#### 4. Trigger updated_at

```sql
-- Aplicado em: mcp_servers, mcp_tools, mcp_resources, mcp_prompts,
-- mcp_permissions, mcp_registry_settings (NÃO em invocations/audit_logs por design)
CREATE TRIGGER trg_<tabela>_updated_at
  BEFORE UPDATE ON public.<tabela>
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

#### 5. RLS — Políticas (padrão NOID)

**Todas as 8 tabelas com `ENABLE ROW LEVEL SECURITY`** + `FORCE ROW LEVEL SECURITY` para garantir que owners da tabela também passem pelo RLS.

##### Padrão geral aplicado

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `mcp_servers` | Membro da org **OU** `organization_id IS NULL` (globais) **OU** platform_admin | Admin da org (org_id obrigatório) | Admin da org | **Bloqueado** (`USING false`) |
| `mcp_tools` | idem servers | Admin da org | Admin da org | **Bloqueado** |
| `mcp_resources` | idem servers | Admin da org | Admin da org | **Bloqueado** |
| `mcp_prompts` | idem servers | Admin da org | Admin da org | **Bloqueado** |
| `mcp_permissions` | **Apenas admin da org** (org_id obrigatório, sem globais) | Admin da org | Admin da org | **Bloqueado** |
| `mcp_tool_invocations` | Admin da org vê tudo da org; usuário comum vê apenas onde `user_id = auth.uid()` | **Bloqueado pelo frontend** (`USING false` para INSERT — futuras invocations virão via RPC `SECURITY DEFINER`) | **Bloqueado** | **Bloqueado** |
| `mcp_audit_logs` | Admin da org | **Bloqueado** (escrita só via trigger/RPC `SECURITY DEFINER` futuros) | **Bloqueado** | **Bloqueado** |
| `mcp_registry_settings` | Admin da org | Admin da org | Admin da org | **Bloqueado** |

##### Exemplo concreto (mcp_servers SELECT)

```sql
CREATE POLICY "mcp_servers_select" ON public.mcp_servers
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL                                  -- registros globais
    OR public.user_is_org_member(organization_id)            -- membros da org
    OR public.is_platform_admin(auth.uid())                  -- super admin
  );

CREATE POLICY "mcp_servers_insert" ON public.mcp_servers
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND public.user_is_org_admin(organization_id)
  );

CREATE POLICY "mcp_servers_update" ON public.mcp_servers
  FOR UPDATE TO authenticated
  USING (public.user_is_org_admin(organization_id))
  WITH CHECK (public.user_is_org_admin(organization_id));

CREATE POLICY "mcp_servers_no_delete" ON public.mcp_servers
  FOR DELETE TO authenticated USING (false);
```

##### Diferenciações importantes

- **`mcp_permissions`**: `organization_id NOT NULL` + leitura/escrita **somente** por `user_is_org_admin`. Usuários comuns nunca veem permissões.
- **`mcp_tool_invocations`**: `INSERT`/`UPDATE`/`DELETE` totalmente bloqueados pelo frontend. Sprint 1.2+ criará RPCs `SECURITY DEFINER` para gravar invocations de forma controlada.
- **`mcp_audit_logs`**: `INSERT`/`UPDATE`/`DELETE` totalmente bloqueados pelo frontend. Escrita futura será via trigger interno ou RPC `SECURITY DEFINER`.

#### 6. Compatibilidade com agentes existentes

- `agent_id` em `mcp_permissions`, `mcp_tool_invocations`, `mcp_audit_logs` referencia **`public.ai_agents(id) ON DELETE SET NULL`**.
- Nenhuma tabela de agente é alterada, criada ou removida.
- Não há trigger ou view que dependa do MCP — agentes existentes continuam 100% funcionais.

---

### 🔒 Segurança & garantias

- ✅ Sem `service_role` no frontend
- ✅ Sem credenciais/secrets em colunas (não há colunas de credencial nesta sprint)
- ✅ Sem servidor HTTP MCP, sem gateway, sem execução real
- ✅ `FORCE ROW LEVEL SECURITY` em todas as 8 tabelas
- ✅ Bloqueio total de DELETE (soft-archive via `status`)
- ✅ Bloqueio total de escrita direta em `mcp_tool_invocations` e `mcp_audit_logs` pelo frontend
- ✅ Helpers RLS reusados (zero duplicação de lógica de permissão)

### 🧪 Como validar no Supabase (após aplicar)

1. **Linter**: `supabase--linter` deve retornar 0 issues críticas (RLS habilitado em todas).
2. **Schema**: `\d+ public.mcp_*` no SQL editor do projeto mostra 8 tabelas + constraints.
3. **RLS**: `SELECT * FROM mcp_servers` autenticado como usuário comum retorna apenas registros globais + da própria org.
4. **Cross-tenant**: Tentar `INSERT` em `mcp_permissions` com `organization_id` de outra org → bloqueado.
5. **Delete**: Tentar `DELETE FROM mcp_servers WHERE id = '...'` → 0 rows affected (política `USING false`).
6. **Constraints**: `INSERT INTO mcp_permissions (organization_id) VALUES (...)` sem alvo nem objeto → erro de check constraint.

### ⚠️ Pontos de atenção

1. **`tenant_id` → `organization_id`**: Divergência intencional do spec literal para preservar a regra core do NOID. Documentação interna do MCP deve esclarecer que "tenant" no contexto MCP **mapeia para** `organization_id` no schema.
2. **`mcp_audit_logs` sem INSERT policy**: Por design. Sprint 1.2+ adicionará RPC `SECURITY DEFINER` para escrita controlada. Tentar inserir hoje pelo client retornará erro de RLS — **comportamento esperado**.
3. **`mcp_tool_invocations` sem INSERT policy**: Idem. Sprint 1.2 adicionará a função `mcp_record_invocation(...)` `SECURITY DEFINER`.
4. **Slug único condicional**: Implementado via 2 índices parciais (org-scoped e global) porque `UNIQUE (organization_id, slug)` permite múltiplos NULLs em `organization_id`, o que quebraria a regra "único entre globais".
5. **Sem seed**: Nenhum dado seed nesta sprint. Servers/tools/prompts default virão na Sprint 1.2 ou via UI da Sprint 1.3.
6. **Realtime**: Tabelas MCP **não** serão adicionadas ao `supabase_realtime` nesta sprint (sem UI consumindo).

### ✅ Critérios de aceite mapeados

| # | Critério | Coberto |
|---|---|---|
| 1 | 8 tabelas criadas | ✅ |
| 2 | Constraints aplicadas | ✅ |
| 3 | Índices principais | ✅ |
| 4 | RLS ativo | ✅ + FORCE |
| 5 | Isolamento cross-tenant | ✅ via helpers |
| 6 | Globais legíveis quando apropriado | ✅ |
| 7 | `updated_at` automático | ✅ trigger reusado |
| 8 | Suporta simulated + real, sem executar | ✅ |
| 9 | Permissions valida alvo + objeto | ✅ CHECK constraints |
| 10 | Audit logs sem edição/exclusão pelo front | ✅ políticas USING false |
| 11 | Nenhuma tela nova | ✅ |
| 12 | Nada existente quebrado | ✅ tabelas isoladas |
| 13 | Pronto para Sprint 1.2 | ✅ |

### 📋 Entregáveis

1. **1 arquivo de migration** (`mcp_registry_foundation.sql`) executado via tool de migração com aprovação.
2. Resumo técnico final com:
   - Lista das 8 tabelas + colunas-chave
   - Lista de constraints CHECK aplicadas
   - Lista de índices criados (~50)
   - Lista de políticas RLS criadas (~30)
   - Lista de triggers `updated_at` (6)
   - Pontos de atenção para Sprint 1.2
   - Comandos SQL para validação manual

### 🚫 Fora do escopo (confirmado)

- ❌ Telas frontend
- ❌ RPCs de execução
- ❌ Edge functions
- ❌ Conexões externas (HTTP/SSE/stdio)
- ❌ MCP Gateway / proxy
- ❌ Envio de email/WhatsApp
- ❌ Automações reais
- ❌ Duplicação do builder ou playground de agentes
- ❌ Alterações em qualquer tabela existente do CRM
- ❌ Seed de dados