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
