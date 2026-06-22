
# KAI.19 — SDR Copilot

Camada operacional que entrega ao SDR um lead pronto para agir: contexto, canal, mensagem e próxima ação. **Nada é enviado automaticamente** — o agente prepara, o humano decide, o sistema registra.

## 1. Banco de dados (1 migration)

### Nova tabela `kairos_sdr_copilot_tasks`
Campos principais: `id`, `organization_id`, `queue_id` (FK `kairos_qualified_queue`), `prospect_id`, `account_id`, `contact_id`, `opportunity_id`, `assigned_to`, `status`, `priority_score`, `preferred_channel`, `next_best_action`, `reason`, `commercial_brief` (jsonb), `suggested_messages` (jsonb por canal — cache), `objections` (jsonb), `cta`, `created_at`, `updated_at`, `completed_at`.

- Unique parcial em `(queue_id)` onde `status NOT IN ('completed','dismissed','promoted_to_crm')` — evita duplicar task ativa.
- Enums (CHECK):
  - `status`: pending | in_review | approved | activity_created | promoted_to_crm | dismissed | completed
  - `preferred_channel`: whatsapp | email | linkedin | call
  - `next_best_action`: call | whatsapp | email | linkedin | create_activity | promote_to_crm | reactivate_customer | review_duplicate | discard
- Índices: `(organization_id, status, priority_score DESC)`, `(assigned_to, status)`, `(queue_id)`.
- GRANT SELECT/INSERT/UPDATE para `authenticated`, ALL para `service_role`.
- RLS:
  - SELECT: membros da org (Owner/Admin/Manager veem todos; SDR vê próprias via `assigned_to = auth.uid()` OR `assigned_to IS NULL`).
  - INSERT/UPDATE: org members; UPDATE de `assigned_to` só Owner/Admin/Manager (via `has_role`).
- Trigger `update_updated_at_column`.

Sem alteração em CRM, Forecast, OTE, Revenue.

## 2. Edge Functions (2 novas)

### `kairos-create-sdr-copilot-task`
Input `{ queue_id }`. Fluxo:
1. Validar JWT, resolver org do usuário.
2. Buscar queue item (deve ter `sdr_ready = true` ou status equivalente).
3. Verificar task ativa (unique constraint cobre, mas checa antes para retornar idempotente).
4. Carregar Smart Coverage (`kairos_coverage_analysis`), `commercial_briefs`, contato principal (`contacts` com `is_primary`), enriched profile.
5. Resolver `preferred_channel` (regra: phone→whatsapp; email→email; linkedin→linkedin; cliente antigo→call).
6. Resolver `next_best_action` (heurística por coverage_class + canal).
7. Calcular `sdr_priority_score` = queue.priority_score (40%) + coverage_gap (15%) + contact_score (15%) + event_importance (10%) + revenue_potential (15%) + recency (5%).
8. Insert task, emit `revenue_events: sdr_copilot_task_created`.

### `kairos-generate-sdr-message`
Input `{ task_id, channel }`. Usa OpenAI (wrapper `_shared/ai-client.ts`):
- Carrega task + brief + empresa + evento + dor + produto da org (organization_settings).
- Prompt por canal:
  - whatsapp: tom humano, ≤500 chars, sem textão.
  - email: assunto objetivo + corpo ≤120 palavras + CTA.
  - linkedin: ≤300 chars, conexão consultiva.
  - call: roteiro (abertura, pergunta principal, 2 objeções prováveis, fechamento).
- Persiste em `suggested_messages[channel]` na task (cache). Emit `sdr_message_generated`.
- Não envia nada.

## 3. Frontend

### Nova rota/aba no Kairós Hub
`src/pages/intelligence/KairosHub.tsx` — adicionar aba "SDR Copilot" 🤝 após Smart Coverage / GTM Performance.

### Componentes (`src/components/intelligence/sdr-copilot/`)
- `SDRCopilotKpiBar.tsx` — KPIs: Prontos para ação, Com telefone, Com WhatsApp, Com brief, Promovidos hoje, Atividades criadas, Dismissed.
- `SDRCopilotTaskList.tsx` — colunas: Empresa, Evento, ICP, Prioridade, Contato, Canal (badge), Próxima ação, Status, Responsável. Filtros: Evento, ICP, Status, SDR, Canal, Com telefone, Com brief, Score mínimo, Coverage class.
- `SDRCopilotDrawer.tsx` — resumo empresa, `<CoverageBadge/>`, contato principal (phone/email/linkedin), brief, dores, objeções, mensagem sugerida (tabs por canal com geração on-demand), botões de ação.
- `SDRCopilotActions.tsx` — Copiar WhatsApp / Copiar e-mail / Copiar roteiro / Criar atividade / Promover CRM / Marcar como feito / Descartar.

### Serviços/Hooks
- `src/services/intelligence/sdrCopilot.ts` — CRUD da tabela + invoke das edges.
- `src/hooks/intelligence/useSDRCopilotTasks.ts` — lista + filtros + realtime.
- `src/hooks/intelligence/useSDRCopilotActions.ts` — gerar msg, criar activity, promover, dismiss.

### Ações
- **Copiar mensagem**: chama `kairos-generate-sdr-message` se não cacheada, copia para clipboard, emite `sdr_message_generated`.
- **Criar atividade**: reusa `activities` table (tipo/canal/responsável/data/observação com mensagem + link queue) — `activity_created` status, emit `sdr_activity_created`. Nada enviado.
- **Promover CRM**: reusa edge `kairos-promote-to-crm` existente. Status `promoted_to_crm`, emit `sdr_promoted_to_crm`.
- **Marcar feito**: `completed`, `completed_at = now()`, emit `sdr_task_completed`.
- **Descartar**: `dismissed`, emit `sdr_task_dismissed`.

### Geração automática de task
Botão "Criar tarefa SDR" na `QualifiedQueueTable` (linha) → invoca `kairos-create-sdr-copilot-task`. (Sem trigger DB automático nesta sprint — mantém controle humano.)

## 4. Learning Loop / Eventos
Todos eventos em `revenue_events` com `event_type` listado, payload contendo `queue_id`, `task_id`, `channel`, `next_best_action`.

## 5. Memória arquitetural
Criar `.lovable/memory/architectural-decision/intelligence/sdr-copilot.md` + entrada no índice:
- SDR Copilot é assistente, nunca executor automático.
- Mensagens são copiáveis; envio só via canais CRM existentes acionados manualmente.
- Tasks únicas por queue_id ativo.
- Score composto definido.

## 6. Riscos & não-objetivos
- **Não** envia WhatsApp/email/LinkedIn.
- **Não** cria oportunidade sem ação humana.
- **Não** altera owner, Forecast, OTE, Receita.
- LGPD: mensagens geradas usam apenas dados já presentes no CRM/enrichment.
- Custo OpenAI: mensagens cacheadas em `suggested_messages`; regeneração explícita.

## Arquivos

**Criar (~12):**
- 1 migration SQL
- 2 edge functions (`kairos-create-sdr-copilot-task`, `kairos-generate-sdr-message`)
- 4 componentes UI (`SDRCopilotKpiBar`, `SDRCopilotTaskList`, `SDRCopilotDrawer`, `SDRCopilotActions`)
- 1 service (`sdrCopilot.ts`)
- 2 hooks
- 1 doc memória

**Editar (~4):**
- `KairosHub.tsx` (nova aba)
- `QualifiedQueueTable.tsx` (botão criar task)
- `.lovable/memory/index.md`
- `src/integrations/supabase/types.ts` (auto após migration)

## Próximos passos
Aprovar plano → executo migration → ao confirmar, implemento edges + UI em paralelo.
