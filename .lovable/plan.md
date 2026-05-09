# Auditoria: Arquitetura Agent-Ready (Headless Humanoid)

Boa notícia: **~80% da arquitetura proposta já está implementada**. O que falta não é refundação — é **formalizar contratos** (Action Registry) e **unificar pontas soltas** (audit single source, approval router).

---

## Status por camada

### ✅ 1. Core Data Layer — COMPLETO
Todas as tabelas existem: `accounts`, `contacts`, `opportunities`, `proposals`, `proposal_items`, `activities`, `contracts`, `billing_invoices`, `inventory_items`, `inventory_reservations`, `score_history`, `audit_log`, `ai_agent_approval_queue`.

### ✅ 2. Business Logic Layer — COMPLETO
- RPCs: `calculate_lead_grade`, `has_role`, `get_user_organization_id`, dezenas de triggers de negócio (close_date, win_rate, opportunity_title_upper, etc.)
- Edge functions: 50+ (auto-apply-ai-suggestions, calculate-opportunity-score, post-acceptance-effects, generate-recommendations, etc.)
- Services TS: `proposalOrchestrator`, `inventoryProposalBridge`, `agentBuilderService`, etc.
- Regras já vivem **fora da tela** (triggers DB + edge functions + services).

### ⚠️ 3. Action Registry — PARCIAL
**Existe:** `mcp_tools` + `ai_agent_tools` + `ai_agent_execution_actions` cobrem o caso "ferramentas que o agente pode chamar".
**Falta:** Tabela canônica `action_registry` com TODAS as ações operacionais (humanas + agentes) listando: `action_key`, `required_role`, `approval_required`, `risk_level`, `input_schema`, `available_surfaces`. Hoje as ações estão **espalhadas** entre edge functions, RPCs e mutações no front — não há um catálogo único consultável.

### ⚠️ 4. Tool Layer — PARCIAL
**Existe:** Catálogo de tools no contexto Noid Intelligence (`mcp_tools`, `ai_agent_tools`, registry com risk levels — ver memory `tool-registry-catalog-and-risk-levels`).
**Falta:** Tools wrappando ações **CRM operacionais** (`noid_create_opportunity`, `noid_generate_proposal`, `noid_request_approval`, `noid_reserve_inventory`). Hoje os agentes têm tools de IA/sourcing, mas não de operação CRM end-to-end.

### ✅ 5. Permission & Approval Layer — COMPLETO
- RBAC: `user_roles`, `permission_sets`, `has_role()`, `can_view_all()`
- RLS: aplicado em todas as tabelas multi-tenant
- Approvals: `ai_agent_approval_queue`, `agent_guardrails`, `ai_agent_escalation_policies`, `ai_agent_execution_policies`
- UI: `ApprovalsPage`, `DecisionRulesPage`
**Gap menor:** essa lógica é específica de agentes IA. Não há um **approval router unificado** que sirva também para ações humanas críticas (ex: desconto > limite, cancelar contrato) com a mesma fila.

### ⚠️ 6. Audit & Memory Layer — FRAGMENTADO
**Existe (4 tabelas distintas):**
- `audit_log` — CRM/operacional
- `auth_audit_log` — login/sessão
- `security_audit_log` — eventos de segurança
- `mcp_audit_logs` — invocações de tools/agentes
- `ai_agent_audit` — execuções de agentes
- `ai_runs`, `ai_agent_execution_runs`, `ai_agent_run_outcomes` — runs de IA

**Gap:** Não há **view unificada** (`unified_audit_view`) com schema comum (`actor_type`, `actor_id`, `agent_id`, `action_key`, `before_state`, `after_state`, `approval_id`). Hoje, para investigar "quem fez o quê", precisa consultar 5+ tabelas.

### ⚠️ 7. Experience Layer — PARCIAL
**Existe:** Web (CRM completo), notificações (`notifications_v2`, push, email, daily digest), Slack (integração de notificações).
**Falta:** Slack/WhatsApp como **superfícies de execução** (não só de leitura). Hoje Slack notifica mas não permite "aprovar desconto da proposta 184" via botão. Humanoid Agent ainda não tem UI de execução cross-surface.

---

## Score consolidado

| Camada | Status | % |
|---|---|---|
| 1. Core Data | ✅ | 100% |
| 2. Business Logic | ✅ | 95% |
| 3. Action Registry | ⚠️ | 40% |
| 4. Tool Layer | ⚠️ | 50% |
| 5. Permission/Approval | ✅ | 90% |
| 6. Audit/Memory | ⚠️ | 60% (existe, mas fragmentado) |
| 7. Experience | ⚠️ | 55% |

**Média: ~70% pronto.**

---

## Recomendação de roadmap (3 sprints)

### Sprint A — Action Registry canônico (1 semana)
1. Criar tabela `action_registry` (action_key PK, required_role, risk_level, approval_required, input_schema jsonb, output_schema jsonb, executor_type [edge_function|rpc|service], executor_ref, available_surfaces text[], audit_enabled).
2. Seed inicial com **20 ações críticas** já existentes (ex: `proposal.apply_discount`, `opportunity.change_stage`, `contract.cancel`, `inventory.reserve`).
3. Criar RPC `execute_action(action_key, payload)` que valida role/approval/RLS antes de despachar para o executor real.
4. Frontend: hook `useAction(action_key)` que substitui chamadas diretas a edge functions.

### Sprint B — Audit unificado + Approval router (1 semana)
1. View `unified_audit_view` somando audit_log + ai_agent_audit + mcp_audit_logs + auth_audit_log com schema comum.
2. Estender `ai_agent_approval_queue` → `approval_queue` (genérica, com `actor_type` aceitando 'human' também).
3. UI única em `/approvals` para humanos + agentes.

### Sprint C — Tools CRM + Slack actions (1 semana)
1. Wrapping de 10 ações CRM como MCP tools (`noid_create_opportunity`, `noid_generate_proposal`, `noid_apply_discount`, etc.) chamando `execute_action()`.
2. Slack interactive buttons (Block Kit) para approvals.
3. Documentar header **HEADLESS HUMANOID REQUIREMENT** no AGENTS.md como checklist obrigatório.

---

## Arquivos principais já existentes (referência)

```text
DB:
- audit_log, ai_agent_audit, mcp_audit_logs (audit fragmentado)
- ai_agent_approval_queue, agent_guardrails (approval só agentes)
- mcp_tools, ai_agent_tools, ai_agent_execution_actions (tool registry parcial)
- user_roles, permission_sets, RLS em todas as tabelas

Edge functions: supabase/functions/* (50+)
Services: src/services/ai-agents/*, src/services/crm/*
Memories relevantes: tool-registry-catalog-and-risk-levels,
  agent-governance-and-publication-flow, comprehensive-audit-infrastructure
```

---

## Resposta direta

**Sim, a arquitetura existe na essência.** O que falta é:
1. **Catálogo único** de ações (Action Registry).
2. **Audit unificado** (view consolidando 5 tabelas).
3. **Approval router genérico** (humano + agente na mesma fila).
4. **Tools CRM operacionais** expostas via MCP.
5. **Superfícies executáveis** além do web (Slack/WhatsApp interativos).

Posso começar pelo **Sprint A (Action Registry)** que é o que destrava todo o resto, ou prefere outra ordem?
