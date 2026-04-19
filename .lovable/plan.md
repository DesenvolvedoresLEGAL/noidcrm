
Sprint 1.5 entregou a infra de governança (policy granular, cooldown, outcome tracking, recent interactions) **no backend**. Mas a UI do Builder ainda não expõe esses controles — o usuário só consegue editar via SQL hoje. Sprint 1.6 fecha esse gap e adiciona observabilidade.

# Sprint 1.6 — Builder UI + Observabilidade de Outcomes

## Diagnóstico do que ficou pendente do 1.5

1. **Policy granular sem UI**: `auto_send_rules`, `require_approval_rules`, `block_rules` existem em `ai_agent_escalation_policies` mas o Builder só mostra `escalation_mode` + `confidence_threshold` (vide `BuilderEscalationTab.tsx`).
2. **Cooldown invisível**: `ai_email_cooldown_policies` foi populada mas não há tab no Builder mostrando regras.
3. **Memory recente sem toggle**: `recent_interactions_enabled` / `recent_interactions_lookback_hours` existem em `ai_agent_memory_profiles` mas o `BuilderMemoryTab` não expõe.
4. **Outcomes sem painel**: `ai_agent_run_outcomes` está coletando dados mas não há visualização — usuário não sabe se o agente está funcionando.
5. **Approval queue sem UI dedicada**: emails caem em `ai_agent_approval_queue` mas precisa de inbox para aprovar/rejeitar.

## Plano (5 fases, ~75 min)

### FASE 1 — Builder: Policy de Decisão granular (Auto/Approval/Block)
Refatorar `BuilderEscalationTab.tsx` adicionando 3 cards colapsáveis abaixo do "Modo de Escalonamento":

**Card "🟢 Auto-enviar quando"** (auto_send_rules):
- Confiança mínima (slider 0-1, default 0.85)
- Valor máx do deal (input R$, default 50000)
- Risco máx (select low/medium/high, default low)

**Card "🟡 Exigir aprovação quando"** (require_approval_rules):
- Valor mín do deal (input R$, default 50000)
- Risco mín (select, default high)
- Conta VIP (toggle)

**Card "🔴 Bloquear quando"** (block_rules):
- Último contato há menos de X horas (input, default 24)
- Mais de N emails na janela (input N + janela em dias, defaults 3/7)

Atualizar `agent-policy-engine.ts` (já lê esses campos) — sem mudança no backend.

Atualizar `agentBuilderService.ts` + `types/ai-agents.ts` com tipos `AutoSendRules`, `ApprovalRules`, `BlockRules`.

### FASE 2 — Builder: Tab "Cooldown & Cadência" (nova)
Nova tab `BuilderCadenceTab.tsx` lendo de `ai_email_cooldown_policies`:
- Card "Limites por contato/oportunidade" (per_contact_hours, per_opportunity_hours)
- Card "Janela de envio" (max_emails_per_window, window_days)
- Card "Comportamento" (stop_on_reply, respect_business_hours, business_hours_start/end, timezone)
- Salvar via novo edge `save-agent-cadence` (RPC simples upsert).

Adicionar tab no `AgentBuilderShell.tsx` entre "Escalonamento" e "Métricas".

### FASE 3 — Builder: Memory recente
Atualizar `BuilderMemoryTab.tsx` adicionando 4º card "Interações Recentes (anti over-communication)":
- Toggle `recent_interactions_enabled` (default on)
- Input `lookback_hours` (default 72) — visível só se toggle on
- Texto explicativo: "Considera emails, WhatsApp e atividades das últimas N horas para evitar contato duplicado mesmo fora do CRM"

### FASE 4 — Painel de Outcomes (observabilidade)
Nova página `src/pages/settings/noid-intelligence/AgentOutcomes.tsx` rota `/settings/noid-intelligence/agents/:agentId/outcomes`:

**KPIs do topo (últimos 30 dias):**
- Emails enviados
- Taxa de abertura
- Taxa de resposta
- Deals progrediram (attribution 7d)
- Deals ganhos (attribution 7d)
- Receita influenciada (R$)

**Tabela de runs recentes:**
- Run ID curto, deal, ação tomada, status (sent/blocked/queued), opened, replied, progressed, won, valor

**Filtros:** período, status, opportunity_id

Hook `useAgentOutcomes(agentId, range)` consultando `ai_agent_run_outcomes` + `ai_agent_execution_runs`.

Botão "Ver Outcomes" no `AgentDetailHeader`.

### FASE 5 — Approval Inbox dedicado
Nova página `src/pages/settings/noid-intelligence/ApprovalInbox.tsx`:
- Lista de itens em `ai_agent_approval_queue` status `pending`
- Card por item: agente, deal, ação proposta (preview do email com subject + body), motivo (campo `approval_reason`), valor do deal, criado há X
- Botões "Aprovar e Enviar" / "Rejeitar com motivo" / "Editar antes"
- Ao aprovar: chama `execute-approved-agent-action` (já existe? se não, criar) que executa o `send_email` e marca queue como `approved`
- Badge de pendências no menu lateral NOID Intelligence

## Arquivos (~15)

1. `src/types/ai-agents.ts` — tipos das rules + `AgentRunOutcome`, `ApprovalQueueItem`
2. `src/components/noid-intelligence/builder/BuilderEscalationTab.tsx` — 3 cards de policy
3. `src/components/noid-intelligence/builder/BuilderMemoryTab.tsx` — card recent_interactions
4. `src/components/noid-intelligence/builder/BuilderCadenceTab.tsx` (novo)
5. `src/components/noid-intelligence/builder/AgentBuilderShell.tsx` — nova tab
6. `src/services/ai-agents/agentBuilderService.ts` — saveBuilderCadence
7. `supabase/functions/save-agent-cadence/index.ts` (novo)
8. `src/pages/settings/noid-intelligence/AgentOutcomes.tsx` (novo)
9. `src/hooks/useAgentOutcomes.ts` (novo)
10. `src/components/noid-intelligence/outcomes/OutcomeKPIs.tsx` (novo)
11. `src/components/noid-intelligence/outcomes/RunsTable.tsx` (novo)
12. `src/pages/settings/noid-intelligence/ApprovalInbox.tsx` (novo)
13. `src/hooks/useApprovalQueue.ts` (novo)
14. `supabase/functions/execute-approved-agent-action/index.ts` (novo ou estender existente)
15. `src/App.tsx` — registrar rotas
16. Memória — atualizar [Builder Studio modular](mem://architectural-decision/ai/agent-builder-studio-modular-architecture) com tab Cadência + observabilidade.

## Decisões antes de começar

**A) Onde colocar o Approval Inbox no menu?**
- Sub-item de NOID Intelligence: "Aprovações Pendentes" *(recomendo — fica perto dos agentes)*
- Item top-level no sidebar com badge: "Aprovações"
- Dentro de cada agente, na tab Outcomes

**B) Comportamento ao aprovar com edição:**
- Editar abre modal full com subject + body editáveis, depois envia *(recomendo — controle real)*
- Editar inline na lista (campos pequenos) — mais rápido mas trunca emails longos

**C) Realtime na fila de aprovação:**
- Sim, subscribe via Supabase Realtime — badge atualiza ao vivo *(recomendo — UX premium)*
- Não, polling a cada 30s — simples mas atrasado

**D) Permissões para aprovar:**
- Qualquer usuário com role `admin` ou `manager` *(recomendo — alinhado com governance atual)*
- Apenas o owner do deal
- Configurável por agente (mais complexo, fica pra 1.7)

Ao aprovar, valido no banco se `execute-approved-agent-action` já existe (vi referência em `ai_agent_approval_queue.action_id`) antes de criar duplicado.

Tempo: ~75 min após decisões.
