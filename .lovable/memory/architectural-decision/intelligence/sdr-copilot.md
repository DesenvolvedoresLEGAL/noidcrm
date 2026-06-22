---
name: SDR Copilot (KAI.19)
description: Camada assistiva que transforma itens da Qualified Queue em tarefas SDR com brief, canal sugerido e mensagem por IA — sem nenhum envio automático.
type: feature
---

## Princípio
Agente prepara. Humano decide. Sistema registra.

## Regras invioláveis
- NUNCA envia WhatsApp, e-mail ou LinkedIn automaticamente.
- NUNCA cria oportunidade sem ação humana explícita.
- NUNCA altera owner, Forecast, OTE ou Receita.
- Mensagens são geradas sob demanda e cacheadas em `kairos_sdr_copilot_tasks.suggested_messages`.

## Modelo
- Tabela `kairos_sdr_copilot_tasks` é fonte única das tarefas.
- Único índice parcial em `queue_id` onde `status NOT IN ('completed','dismissed','promoted_to_crm')` garante 1 task ativa por queue item.
- Status: pending → in_review → approved → (activity_created | promoted_to_crm | completed | dismissed).
- Canais: whatsapp | email | linkedin | call.

## Score de prioridade
`priority_score = queueScore*0.4 + (100-coverage)*0.15 + (contato?15:0) + (brief?10:0) + recency(≤10)`

## Canal preferencial (ordem)
1. Cliente antigo + telefone → `call`
2. Celular BR → `whatsapp`
3. E-mail → `email`
4. LinkedIn → `linkedin`
5. Telefone fixo → `call`
6. Fallback → `email`

## Edge functions
- `kairos-create-sdr-copilot-task` — input `{queue_id, assigned_to?}`. Idempotente.
- `kairos-generate-sdr-message` — input `{task_id, channel, force_refresh?}`. Usa wrapper `_shared/ai-client.ts`. Cacheia no JSONB.

## Eventos (revenue_events)
`sdr_copilot_task_created`, `sdr_message_generated`, `sdr_activity_created`, `sdr_task_completed`, `sdr_task_dismissed`, `sdr_promoted_to_crm`.

## UI
- Aba `🤝 SDR Copilot` em `KairosHub` (entre GTM Performance e Sourcing).
- Botão "Criar tarefa SDR Copilot" em `QualifiedQueueRowActions` — habilitado para `sdr_ready` ou estados `human_review`/`approach_ready`/`contact_revealed`/`ready_for_sdr`.
