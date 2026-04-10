

# SPRINT 0.1 — NOID Intelligence: Fundação do Módulo

## Resumo

Criar o módulo NOID Intelligence como substituição da seção "Automação", com CRUD completo de agentes, versionamento, auditoria e páginas placeholder para áreas futuras.

## Adaptações ao projeto existente

O spec usa `workspaces` mas o projeto usa `organizations` (tabela `public.organizations`). Todas as FKs `workspace_id` serão mapeadas para `organization_id → organizations(id)`. O helper RLS existente é `get_user_organization_id()`. O `owner_id` referenciará `profiles(id)`.

---

## 1. Database Migration

Uma migration SQL criando:

**Tabela `ai_agents`** — cadastro mestre de agentes
- `organization_id` (FK → organizations), `owner_id` (FK → profiles)
- Constraints de status e autonomy_level via CHECK
- UNIQUE em (organization_id, name) e (organization_id, slug)
- Trigger para `updated_at`

**Tabela `ai_agent_versions`** — versionamento imutável
- `agent_id` (FK → ai_agents ON DELETE CASCADE)
- `organization_id` (FK → organizations)
- `published_by` (FK → profiles ON DELETE SET NULL)
- UNIQUE em (agent_id, version_number)

**Tabela `ai_agent_bindings`** — ponte polimórfica para entidades CRM
- entity_type CHECK com valores do spec
- Sem FK em entity_id (polimórfica)

**Tabela `ai_agent_audit`** — log de ações administrativas

**Índices** conforme spec.

**RLS** — todas as tabelas com policies SELECT/INSERT/UPDATE/DELETE usando `organization_id = get_user_organization_id()`.

**Trigger** — auto-update de `updated_at` em `ai_agents`.

## 2. Edge Function: `create-ai-agent`

Função transacional que:
1. Valida payload (Zod)
2. Gera slug a partir do nome (slugify + uniqueness check)
3. Insere em `ai_agents`
4. Insere versão 1 em `ai_agent_versions` (is_active = true)
5. Insere audit em `ai_agent_audit`
6. Retorna agente + versão

## 3. Service Layer

**`src/services/ai-agents/`**:
- `aiAgentsService.ts` — listAgents, getAgentById, createAgent (chama edge function), updateAgent, archiveAgent
- `aiAgentVersionsService.ts` — listVersions
- Tipos em `src/types/ai-agents.ts` (AgentStatus, AutonomyLevel, AgentScope, AIAgent, AIAgentVersion)

## 4. React Hooks

- `useAIAgents()` — lista com filtros
- `useAIAgent(id)` — detalhe
- `useCreateAIAgent()` — mutation
- `useUpdateAIAgent()` — mutation
- `useArchiveAIAgent()` — mutation
- `useAIAgentVersions(agentId)` — lista versões

## 5. Frontend Pages

### Hub NOID Intelligence
**Rota:** `/app/settings/noid-intelligence`
- Cards de navegação: Agentes (ativo), Orquestrações, Aprovações, Logs, Métricas, Ferramentas, Memórias, Ambientes (todos "Em breve")

### Listagem de Agentes
**Rota:** `/app/settings/noid-intelligence/agents`
- Busca, filtros (status, autonomia, owner), tabela com colunas do spec
- Ações: visualizar, editar, pausar, arquivar
- Empty state

### Criar Agente
**Rota:** `/app/settings/noid-intelligence/agents/new`
- Formulário: nome, descrição, objetivo, scope (multiselect), autonomy_level, primary_channel
- Ao salvar: cria via edge function, redireciona para detalhes, toast

### Detalhes do Agente
**Rota:** `/app/settings/noid-intelligence/agents/:id`
- Resumo, status badge, owner, scope tags
- Abas: Visão Geral (funcional), Versões (funcional), Vínculos (placeholder), Auditoria (funcional)

### 7 Páginas Placeholder
- `/app/settings/noid-intelligence/orchestrations|approvals|logs|metrics|tools|memories|environments`
- Cada uma: título, descrição, badge "Em construção", botão voltar

## 6. Routing (App.tsx)

Adicionar rotas dentro do SettingsLayout:
- `/app/settings/noid-intelligence` → Hub
- `/app/settings/noid-intelligence/agents` → Lista
- `/app/settings/noid-intelligence/agents/new` → Criar
- `/app/settings/noid-intelligence/agents/:id` → Detalhes
- 7 rotas placeholder

## 7. Settings Menu Update

Em `SettingsPageV3.tsx`, atualizar a categoria "automation" para apontar os items para as novas rotas do hub e agentes.

Em `SettingsLayout.tsx`, adicionar breadcrumbs para as novas rotas.

## 8. Sidebar

Atualizar `AppSidebar.tsx` — na seção "inteligencia", manter ou adicionar entrada para NOID Intelligence se desejado (o módulo vive dentro de Settings, acessível pelo card).

---

## Arquivos a criar/editar

| Ação | Arquivo |
|------|---------|
| Create | `supabase/migrations/XXXX_noid_intelligence_foundation.sql` |
| Create | `supabase/functions/create-ai-agent/index.ts` |
| Create | `src/types/ai-agents.ts` |
| Create | `src/services/ai-agents/aiAgentsService.ts` |
| Create | `src/services/ai-agents/aiAgentVersionsService.ts` |
| Create | `src/hooks/useAIAgents.ts` |
| Create | `src/pages/settings/noid-intelligence/NoidIntelligenceHub.tsx` |
| Create | `src/pages/settings/noid-intelligence/AgentsList.tsx` |
| Create | `src/pages/settings/noid-intelligence/CreateAgent.tsx` |
| Create | `src/pages/settings/noid-intelligence/AgentDetail.tsx` |
| Create | `src/pages/settings/noid-intelligence/PlaceholderPage.tsx` |
| Edit | `src/App.tsx` — adicionar rotas |
| Edit | `src/pages/settings/SettingsPageV3.tsx` — atualizar items |
| Edit | `src/pages/settings/SettingsLayout.tsx` — breadcrumbs |

