---
name: Apollo phone reveal async contract
description: KAI.18.15 — telefone Apollo é sempre assíncrono; só webhook ou polling webhook_result produzem estado terminal.
type: architectural-decision
---

KAI.18.15 — contrato definitivo do reveal de telefone Apollo.

- `people/match` (pago) NUNCA conclui telefone. Se não vier número pessoal
  no retorno síncrono e houver `provider_request_id`, o campo fica
  `pending_provider` com `reason=awaiting_provider_async_phone`.
- Estado terminal de telefone só pode vir de:
  1. `apollo-phone-webhook` (callback do provider), ou
  2. `kairos-apollo-reveal-status-sync` → `GET /api/v1/webhook_result/{request_id}` (0 créditos).
- `extractProviderRequestId` lê o id por regex no texto bruto (64-bit,
  pode ser negativo) — nunca via `JSON.parse` direto.
- `extractProviderCredits`: créditos jamais inferidos. Sem valor confirmado
  pelo provider → `null`.
- `isTrackableJob(job)`: reaproveita job só se não terminal, não expirado e
  com evidência real (`provider_request_id`/payload) ou < 2 min de vida.
  Zumbi → `stale_job_without_provider_request_id` e novo job.
- `phoneKey` usa E.164 canônico completo (sem truncar em 9 dígitos).
- `phone_only_web` exige `PhoneOnlyWebEvidence` (`evidence_id`); nunca
  automático a partir de `has_direct_phone`.
- Webhook não converte `pending_provider` em `not_found`.
- Cron `kairos-apollo-reveal-status-sync` (*/2 min) autentica com header
  `x-internal-secret` (`CRON_INTERNAL_SECRET` ou `INTERNAL_WORKFLOW_SECRET`).
- Testes: `src/test/services/apolloRevealCore.test.ts` e
  `apolloPhoneCandidates.test.ts` — nenhum faz chamada paga.

## KAI.18.16 — request_id determinístico
- `isValidApolloAsyncRequestId`: request_id válido é signed 64-bit (`^-?\d{1,20}$`).
  Hex 24 (person/contact/account) e UUID nunca são request_id.
- `extractProviderRequestId` lê só `request_id`/`webhook_request_id`; nunca `parsed.id`.
- Sem request_id válido → job fica `pending_provider` com reason
  `awaiting_provider_webhook` e TTL `WEBHOOK_WAIT_TTL_MS` (10 min); o sync
  mantém pendente em vez de matar o job.
- Antes de qualquer terminal negativo, o sync tenta `recoverFromStoredPayload`
  (job.response + apollo_reveal_audit.raw_response) — 0 créditos.
- `cleanup_stale_phone_reveal_requests` nunca marca `not_found` quando existe
  payload com `sanitized_number`/`raw_number` ou job assíncrono vivo (30 min).
- `recompute_primary_contact` grava `revenue_events` com `channel='system'` e
  falha de evento nunca aborta a finalização do reveal.

## KAI.18.17 — webhook autossuficiente por nonce de job
- O webhook é o caminho PRIMÁRIO do telefone; polling é fallback não-destrutivo.
- Autenticação por JOB: nonce 256-bit gerado no core, SHA-256 salvo em
  `enrichment_jobs.request.webhook_nonce_hash`, nonce cru só na `webhook_url`
  (`?contact_id&job_id&nonce`). Não depende de `APOLLO_WEBHOOK_TOKEN` global
  (aceito apenas como legado).
- Se o nonce não puder ser persistido → job `failed/webhook_setup_failed` e
  NENHUMA chamada paga ao Apollo é feita.
- `WEBHOOK_WAIT_TTL_MS` = 15 min (janela oficial do callback).
- `POLL_ONLY_FAILURE_REASONS` + `canWebhookRecoverJob`: callback válido recupera
  job marcado `failed` por erro exclusivo de polling em até 30 min.
- Sync: erro 400/401/403/404/410 do `webhook_result` NÃO mata o job enquanto a
  janela do webhook estiver viva (`poll_unavailable_waiting_webhook:<reason>`).
- Webhook exige `job_id` + `nonce`; valida contato/field/provider e usa
  `constantTimeEqual` no hash.
- Canary KAI.18.17: Rodrigo (BRQ) revelado `person_mobile` +5511996113504.
