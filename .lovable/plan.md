
O usuário está certo: o agente roda (score 93, output preenchido), mas falta a camada de **governança de execução** que separa "simulador funcional" de "agente confiável em escala". Vou investigar o estado real antes de planejar.

Pontos a verificar no banco:
1. Existe tabela/coluna pra `cooldown_rules`? Já vi memória [Agent cadence engine](mem://architectural-decision/ai/agent-cadence-and-cooldown-engine) — então a infra existe.
2. Policy de envio: `ai_agent_escalation_policies` tem `confidence_threshold`, mas tem condicionais por deal_value/risk?
3. `send_email` tool no executor real (`execute-agent-action` ou similar) está mockado ou integrado com SMTP?
4. Outcome tracking: existe tabela ligando run → email → opened/replied/deal_progressed? [Agent metric attribution](mem://business-rules/ai/agent-metrics-and-influence-attribution) sugere que sim.

Vou investigar e propor Sprint 1.5 — Production Hardening.

---

# Sprint 1.5 — Production Hardening do Email Agent

## Diagnóstico

**O que já existe (confirmado nas memórias):**
- ✅ Cadence engine com cooldown por contact/opportunity ([Agent cadence](mem://architectural-decision/ai/agent-cadence-and-cooldown-engine))
- ✅ Outcome tracking com attribution 7-14 dias ([Agent metrics](mem://business-rules/ai/agent-metrics-and-influence-attribution))
- ✅ Live execution + approval queue ([Live execution](mem://architectural-decision/ai/agent-live-execution-and-approval-infrastructure))
- ✅ Email tracking pixels (open/click) ([Email analytics](mem://features/email/analytics-rastreamento-aberturas-cliques))
- ✅ Custom SMTP per user ([SMTP architecture](mem://features/email/custom-smtp-architecture))

**O que está desconectado / faltando:**
1. **Policy granular**: `ai_agent_escalation_policies` só tem `confidence_threshold` global. Falta condicionais por `deal_value`, `risk_score`, `last_contact_hours`.
2. **Cooldown não vinculado ao Email Agent**: existe a infra mas o agente não tem `cadence_profile` configurado.
3. **`send_email` no executor**: a tool está em `approval_required` mas o caminho real (após aprovação) precisa: enviar via SMTP do owner do deal → log na timeline → criar activity tipo "email" marcada como `done`.
4. **Outcome loop fechado**: o `simulation_run` não está vinculado ao `email_send` real → ao `email_event` (open/click/reply) → ao `opportunity_stage_change`. Precisa de uma tabela ponte `agent_run_outcomes`.

## Plano (5 fases, ~60 min)

### FASE 1 — Policy granular de envio
Migration adicionando colunas em `ai_agent_escalation_policies`:
- `auto_send_rules JSONB` → `{ confidence_min, deal_value_max, risk_max }`
- `require_approval_rules JSONB` → `{ deal_value_min, risk_min }`
- `block_rules JSONB` → `{ last_contact_hours_min, max_emails_window }`

UI: novo bloco "Regras de Decisão" no Builder com 3 cards (Auto-enviar / Exigir aprovação / Bloquear).

Edge function `execute-agent-action`: antes de enviar email, avalia as 3 regras em ordem (block → approval → auto). Se cair em approval, enfileira em `ai_agent_approval_queue`. Se block, registra skip com motivo.

### FASE 2 — Cooldown configurado no Email Agent
Migration: popular `ai_agent_cadence_profiles` para o Email Agent com:
- `per_contact_hours: 48`
- `per_opportunity_hours: 24`
- `max_per_window: 3 / 7 dias`
- `stop_on_reply: true`
- `respect_business_hours: true` (9h-18h BRT)

UI: card "Cooldown & Cadência" no Builder mostrando estas regras (read-only por enquanto, edit no Sprint 1.6).

### FASE 3 — Send_email real integrado (4 efeitos)
Edge function `execute-agent-action` no case `send_email`:
1. **Envio**: invoca `send-smtp-email` usando SMTP do owner ([SMTP fallback](mem://architectural-decision/email/smtp-delivery-fallback-strategy))
2. **Activity**: cria `activities` tipo `email`, status `done`, `created_by_agent_id`, `agent_run_id`
3. **Timeline**: insert em `opportunity_timeline` com payload do email + link de tracking
4. **Tracking**: registra `email_sends` com pixel + click tokens

### FASE 4 — Outcome tracking loop
Nova tabela `agent_run_outcomes`:
```
agent_run_id, email_send_id, opportunity_id,
opened_at, replied_at, deal_progressed_at, deal_won_at,
attribution_window_days, computed_at
```
Trigger em `email_events` (open/click) e em `opportunity_stage_change` → atualiza outcomes do run correspondente dentro da janela de 7-14 dias.

Cron diário `compute-agent-outcomes` consolida métricas em `ai_agent_metrics_daily`.

### FASE 5 — Memory de interação recente
Migration adicionando em `ai_agent_memory_profiles`:
- `recent_interactions_enabled BOOLEAN` (default true)
- `lookback_hours INT` (default 72)

No `run-agent-simulation` e `execute-agent-action`, antes de deliberar, query consolidada de:
- Últimos emails enviados (CRM + Gmail sync)
- Últimas mensagens WhatsApp (se integrado)
- Últimas activities completadas pelo vendedor
- Replies recebidos via Gmail sync

Inject no contexto do prompt como `recent_interactions[]`. Isso evita overcommunication mesmo quando o canal de resposta foi fora do CRM.

---

## Arquivos (~12)

1. **Migration** — colunas em `ai_agent_escalation_policies`, `ai_agent_memory_profiles`, nova tabela `agent_run_outcomes`, popular cadence do Email Agent.
2. **`supabase/functions/execute-agent-action/index.ts`** — avaliação de policy (block/approval/auto), envio real, activity, timeline, tracking.
3. **`supabase/functions/run-agent-simulation/index.ts`** — injetar `recent_interactions` no contexto.
4. **`supabase/functions/compute-agent-outcomes/index.ts`** (nova) — cron diário consolidando outcomes.
5. **Trigger DB** — `email_events` → `agent_run_outcomes`; `opportunity_stage_change` → `agent_run_outcomes`.
6. **`src/components/noid-intelligence/builder/EscalationPolicyBlock.tsx`** — UI das 3 regras.
7. **`src/components/noid-intelligence/builder/CadenceCooldownBlock.tsx`** (novo) — card read-only de cadência.
8. **`src/components/noid-intelligence/builder/MemoryProfileBlock.tsx`** — toggle `recent_interactions`.
9. **`src/components/noid-intelligence/simulator/SimulationResultsPanel.tsx`** — nova tab "Outcomes" mostrando opened/replied/progressed após N dias.
10. **`src/services/ai-agents/agentBuilderService.ts`** — tipos das novas regras.
11. **`src/types/ai-agents.ts`** — `AutoSendRules`, `ApprovalRules`, `BlockRules`, `AgentRunOutcome`.
12. **Memória** — atualizar [Agent cadence engine](mem://architectural-decision/ai/agent-cadence-and-cooldown-engine) com policy granular + outcome loop.

## Decisões antes de começar

**A) Threshold inicial de auto-envio** (depois você ajusta no UI):
- Conservador: confidence > 0.90 E deal_value < R$ 20k
- Balanceado: confidence > 0.85 E deal_value < R$ 50k *(recomendo)*
- Agressivo: confidence > 0.75 E deal_value < R$ 100k

**B) Janela de attribution para outcomes**:
- 7 dias *(recomendo — mais limpo, menos ruído cruzado)*
- 14 dias (mais inclusivo mas confunde com outras causas)

**C) Rollout do envio real**:
- Hoje: `auto_send` desligado globalmente — TUDO vai pra fila de aprovação por 7 dias. Depois de validar, libera auto-envio para deals < threshold.
- Hoje: já libera auto-envio respeitando policy.

Ao aprovar, eu confirmo no banco o estado atual de `ai_agent_escalation_policies` / `ai_agent_cadence_profiles` / `agent_run_outcomes` antes de migrar — pra não duplicar coluna nem quebrar trigger existente.

Tempo: ~60 min após decisões.
