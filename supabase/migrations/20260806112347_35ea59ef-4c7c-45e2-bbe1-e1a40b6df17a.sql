-- KAI.18.15 — reparo de jobs zumbis de reveal Apollo
-- 1) Jobs não terminais SEM provider_request_id e parados > 2 min → falha definitiva
WITH zombies AS (
  UPDATE public.enrichment_jobs
  SET status = 'failed',
      error = coalesce(error, 'stale_job_without_provider_request_id'),
      skip_reason = 'stale_job_without_provider_request_id',
      reconciliation_required = false,
      completed_at = now(),
      locked_at = NULL,
      locked_by = NULL
  WHERE provider = 'apollo_reveal'
    AND status IN ('queued', 'running', 'pending_provider')
    AND (provider_request_id IS NULL OR btrim(provider_request_id) = '')
    AND created_at < now() - interval '2 minutes'
  RETURNING id, contact_id, field
)
UPDATE public.enriched_contact_profiles p
SET phone_reveal_status = CASE WHEN z.field = 'phone' AND coalesce(p.phone_revealed, false) = false
                               THEN 'failed' ELSE p.phone_reveal_status END,
    email_reveal_status = CASE WHEN z.field = 'email' AND coalesce(p.email_revealed, false) = false
                               THEN 'failed' ELSE p.email_reveal_status END
FROM zombies z
WHERE p.id = z.contact_id;

-- 2) Jobs expirados ou com tentativas esgotadas → timeout definitivo
WITH expired AS (
  UPDATE public.enrichment_jobs
  SET status = 'failed',
      error = coalesce(error, 'provider_timeout'),
      skip_reason = 'provider_timeout',
      reconciliation_required = false,
      completed_at = now(),
      locked_at = NULL,
      locked_by = NULL
  WHERE provider = 'apollo_reveal'
    AND status IN ('queued', 'running', 'pending_provider')
    AND (
      (expires_at IS NOT NULL AND expires_at < now())
      OR coalesce(attempt_count, 0) >= 12
      OR created_at < now() - interval '24 hours'
    )
  RETURNING id, contact_id, field
)
UPDATE public.enriched_contact_profiles p
SET phone_reveal_status = CASE WHEN e.field = 'phone' AND coalesce(p.phone_revealed, false) = false
                               THEN 'failed' ELSE p.phone_reveal_status END,
    email_reveal_status = CASE WHEN e.field = 'email' AND coalesce(p.email_revealed, false) = false
                               THEN 'failed' ELSE p.email_reveal_status END
FROM expired e
WHERE p.id = e.contact_id;

-- 3) Jobs válidos e rastreáveis → destravar para o polling gratuito
UPDATE public.enrichment_jobs
SET status = 'pending_provider',
    reconciliation_required = false,
    locked_at = NULL,
    locked_by = NULL,
    next_retry_at = now(),
    attempt_count = 0,
    expires_at = coalesce(expires_at, now() + interval '6 hours')
WHERE provider = 'apollo_reveal'
  AND status IN ('queued', 'running', 'pending_provider')
  AND provider_request_id IS NOT NULL
  AND btrim(provider_request_id) <> ''
  AND created_at >= now() - interval '24 hours';

-- 4) Contatos travados em "requested/pending_provider" sem job vivo → failed
UPDATE public.enriched_contact_profiles p
SET phone_reveal_status = 'failed'
WHERE coalesce(p.phone_revealed, false) = false
  AND p.phone_reveal_status IN ('requested', 'pending_provider')
  AND NOT EXISTS (
    SELECT 1 FROM public.enrichment_jobs j
    WHERE j.contact_id = p.id AND j.provider = 'apollo_reveal' AND j.field = 'phone'
      AND j.status IN ('queued', 'running', 'pending_provider')
  );

UPDATE public.enriched_contact_profiles p
SET email_reveal_status = 'failed'
WHERE coalesce(p.email_revealed, false) = false
  AND p.email_reveal_status IN ('requested', 'pending_provider')
  AND NOT EXISTS (
    SELECT 1 FROM public.enrichment_jobs j
    WHERE j.contact_id = p.id AND j.provider = 'apollo_reveal' AND j.field = 'email'
      AND j.status IN ('queued', 'running', 'pending_provider')
  );