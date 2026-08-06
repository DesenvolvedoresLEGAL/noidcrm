-- KAI.18.13 — Apollo Reveal Reliability Core

-- 1. enrichment_jobs: controle por campo
ALTER TABLE public.enrichment_jobs
  ADD COLUMN IF NOT EXISTS field TEXT,
  ADD COLUMN IF NOT EXISTS request_group_id UUID,
  ADD COLUMN IF NOT EXISTS provider_request_id TEXT,
  ADD COLUMN IF NOT EXISTS credits_confirmed INTEGER,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by TEXT,
  ADD COLUMN IF NOT EXISTS reconciliation_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_id_field_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_enrichment_jobs_active_field
  ON public.enrichment_jobs (workspace_id, contact_id, field, provider)
  WHERE contact_id IS NOT NULL
    AND field IS NOT NULL
    AND status IN ('queued', 'running', 'pending_provider');

CREATE UNIQUE INDEX IF NOT EXISTS ux_enrichment_jobs_provider_request
  ON public.enrichment_jobs (provider, provider_request_id)
  WHERE provider_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_reveal_sync
  ON public.enrichment_jobs (status, next_retry_at)
  WHERE status = 'pending_provider';

CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_group
  ON public.enrichment_jobs (request_group_id)
  WHERE request_group_id IS NOT NULL;

-- 2. Jobs antigos travados: apenas marcar para reconciliação (nunca consultar provider aqui)
UPDATE public.enrichment_jobs
SET reconciliation_required = true
WHERE provider IN ('apollo_reveal', 'apollo_phone_webhook')
  AND status IN ('queued', 'running')
  AND completed_at IS NULL
  AND created_at < now() - interval '15 minutes';

-- 3. Reparo: revealed sem valor persistido
UPDATE public.enriched_contact_profiles
SET phone_revealed = false,
    phone_reveal_status = 'failed',
    phone_quality_reason = 'revealed_without_persisted_value'
WHERE phone_revealed = true AND (phone IS NULL OR btrim(phone) = '');

UPDATE public.enriched_contact_profiles
SET email_revealed = false,
    email_reveal_status = 'failed'
WHERE email_revealed = true AND (email IS NULL OR btrim(email) = '');

-- 4. Trigger de preservação (sem bypass genérico do cliente)
CREATE OR REPLACE FUNCTION public.apollo_reveal_ctx_token()
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT md5(txid_current()::text || '::noid_apollo_reveal_v1') $$;

CREATE OR REPLACE FUNCTION public.protect_revealed_contact_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_authorized BOOLEAN;
BEGIN
  v_authorized := coalesce(current_setting('apollo.reveal_ctx', true), '') = public.apollo_reveal_ctx_token();
  IF v_authorized THEN
    RETURN NEW;
  END IF;

  -- Telefone revelado é imutável fora da RPC oficial
  IF OLD.phone_revealed IS TRUE AND OLD.phone IS NOT NULL AND btrim(OLD.phone) <> '' THEN
    NEW.phone := OLD.phone;
    NEW.phone_revealed := true;
    NEW.phone_reveal_status := OLD.phone_reveal_status;
    NEW.phone_revealed_at := OLD.phone_revealed_at;
    NEW.phone_source_type := OLD.phone_source_type;
    NEW.phone_source := OLD.phone_source;
    NEW.phone_type := OLD.phone_type;
    NEW.phone_match_quality := OLD.phone_match_quality;
    NEW.phone_confidence := OLD.phone_confidence;
    NEW.phone_verified_at := OLD.phone_verified_at;
    NEW.phone_credits_used := OLD.phone_credits_used;
  END IF;

  -- E-mail revelado é imutável fora da RPC oficial
  IF OLD.email_revealed IS TRUE AND OLD.email IS NOT NULL AND btrim(OLD.email) <> '' THEN
    NEW.email := OLD.email;
    NEW.email_revealed := true;
    NEW.email_reveal_status := OLD.email_reveal_status;
    NEW.email_revealed_at := OLD.email_revealed_at;
    NEW.email_credits_used := OLD.email_credits_used;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_revealed_contact_fields ON public.enriched_contact_profiles;
CREATE TRIGGER trg_protect_revealed_contact_fields
  BEFORE UPDATE ON public.enriched_contact_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_revealed_contact_fields();

-- 5. RPC oficial de finalização (atômica + read-back)
CREATE OR REPLACE FUNCTION public.fn_finalize_apollo_reveal(
  p_contact_id UUID,
  p_field TEXT,
  p_outcome TEXT,
  p_job_id UUID DEFAULT NULL,
  p_value TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_credits_used INTEGER DEFAULT NULL,
  p_credits_confirmed INTEGER DEFAULT NULL,
  p_provider_request_id TEXT DEFAULT NULL,
  p_audit_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact public.enriched_contact_profiles%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_value TEXT := nullif(btrim(coalesce(p_value, '')), '');
  v_persisted TEXT;
  v_status TEXT;
  v_revealed BOOLEAN;
  v_job_status TEXT;
BEGIN
  IF p_field NOT IN ('phone', 'email') THEN
    RAISE EXCEPTION 'invalid_field:%', p_field;
  END IF;
  IF p_outcome NOT IN ('revealed', 'not_found', 'rejected_company_phone', 'failed', 'pending_provider') THEN
    RAISE EXCEPTION 'invalid_outcome:%', p_outcome;
  END IF;

  SELECT * INTO v_contact FROM public.enriched_contact_profiles WHERE id = p_contact_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'contact_not_found');
  END IF;

  IF p_outcome = 'revealed' AND v_value IS NULL THEN
    p_outcome := 'failed';
    p_reason := coalesce(p_reason, 'revealed_without_value');
  END IF;

  PERFORM set_config('apollo.reveal_ctx', public.apollo_reveal_ctx_token(), true);

  IF p_field = 'phone' THEN
    IF p_outcome = 'revealed' THEN
      UPDATE public.enriched_contact_profiles SET
        phone = v_value,
        phone_revealed = true,
        phone_reveal_status = 'revealed',
        phone_revealed_at = v_now,
        phone_verified_at = v_now,
        phone_last_validation_at = v_now,
        phone_source = coalesce(p_metadata->>'phone_source', phone_source),
        phone_type = coalesce(p_metadata->>'phone_type', phone_type),
        phone_match_quality = coalesce(p_metadata->>'phone_match_quality', phone_match_quality),
        phone_confidence = coalesce((p_metadata->>'phone_confidence')::int, phone_confidence),
        phone_source_type = coalesce(p_metadata->>'phone_source_type', phone_source_type),
        phone_quality_reason = coalesce(p_metadata->>'phone_quality_reason', phone_quality_reason),
        phone_validation_status = coalesce(p_metadata->>'phone_validation_status', phone_validation_status),
        is_whatsapp_ready = coalesce((p_metadata->>'is_whatsapp_ready')::boolean, is_whatsapp_ready),
        phone_credits_used = coalesce(phone_credits_used, 0) + coalesce(p_credits_confirmed, p_credits_used, 0),
        last_reveal_attempt_at = v_now,
        last_reveal_job_id = coalesce(p_job_id, last_reveal_job_id),
        apollo_person_id = coalesce(p_metadata->>'apollo_person_id', apollo_person_id)
      WHERE id = p_contact_id;
    ELSE
      UPDATE public.enriched_contact_profiles SET
        phone_reveal_status = p_outcome,
        phone_revealed = coalesce(phone_revealed, false),
        is_whatsapp_ready = CASE WHEN phone_revealed IS TRUE THEN is_whatsapp_ready ELSE false END,
        phone_source_type = coalesce(p_metadata->>'phone_source_type', phone_source_type),
        phone_match_quality = coalesce(p_metadata->>'phone_match_quality', phone_match_quality),
        phone_quality_reason = coalesce(p_reason, p_metadata->>'phone_quality_reason', phone_quality_reason),
        phone_last_validation_at = v_now,
        last_reveal_attempt_at = v_now,
        last_reveal_job_id = coalesce(p_job_id, last_reveal_job_id),
        apollo_person_id = coalesce(p_metadata->>'apollo_person_id', apollo_person_id)
      WHERE id = p_contact_id;
    END IF;
  ELSE
    IF p_outcome = 'revealed' THEN
      UPDATE public.enriched_contact_profiles SET
        email = v_value,
        email_normalized = lower(v_value),
        email_revealed = true,
        email_reveal_status = 'revealed',
        email_revealed_at = v_now,
        email_status = coalesce(p_metadata->>'email_status', email_status),
        email_credits_used = coalesce(email_credits_used, 0) + coalesce(p_credits_confirmed, p_credits_used, 0),
        last_reveal_attempt_at = v_now,
        last_reveal_job_id = coalesce(p_job_id, last_reveal_job_id),
        apollo_person_id = coalesce(p_metadata->>'apollo_person_id', apollo_person_id)
      WHERE id = p_contact_id;
    ELSE
      UPDATE public.enriched_contact_profiles SET
        email_reveal_status = p_outcome,
        last_reveal_attempt_at = v_now,
        last_reveal_job_id = coalesce(p_job_id, last_reveal_job_id),
        apollo_person_id = coalesce(p_metadata->>'apollo_person_id', apollo_person_id)
      WHERE id = p_contact_id;
    END IF;
  END IF;

  PERFORM set_config('apollo.reveal_ctx', '', true);

  -- Read-back obrigatório
  SELECT * INTO v_contact FROM public.enriched_contact_profiles WHERE id = p_contact_id;
  IF p_field = 'phone' THEN
    v_persisted := v_contact.phone;
    v_status := v_contact.phone_reveal_status;
    v_revealed := coalesce(v_contact.phone_revealed, false);
  ELSE
    v_persisted := v_contact.email;
    v_status := v_contact.email_reveal_status;
    v_revealed := coalesce(v_contact.email_revealed, false);
  END IF;

  IF p_outcome = 'revealed' AND (v_persisted IS NULL OR btrim(v_persisted) = '' OR NOT v_revealed) THEN
    v_status := 'failed';
    p_reason := 'read_back_mismatch';
  END IF;

  v_job_status := CASE
    WHEN p_outcome = 'pending_provider' THEN 'pending_provider'
    WHEN v_status = 'revealed' THEN 'done'
    WHEN v_status = 'failed' THEN 'failed'
    ELSE 'no_data'
  END;

  IF p_job_id IS NOT NULL THEN
    UPDATE public.enrichment_jobs SET
      status = v_job_status,
      credits_used = coalesce(p_credits_used, credits_used),
      credits_confirmed = coalesce(p_credits_confirmed, credits_confirmed),
      provider_request_id = coalesce(p_provider_request_id, provider_request_id),
      reconciliation_required = false,
      locked_at = NULL,
      locked_by = NULL,
      error = CASE WHEN v_job_status = 'failed' THEN coalesce(p_reason, 'reveal_failed') ELSE error END,
      response_summary = coalesce(response_summary, '{}'::jsonb) || jsonb_build_object(
        'field', p_field, 'outcome', v_status, 'persisted', v_persisted IS NOT NULL
      ),
      completed_at = CASE WHEN v_job_status = 'pending_provider' THEN NULL ELSE v_now END
    WHERE id = p_job_id;
  END IF;

  IF p_audit_id IS NOT NULL THEN
    UPDATE public.apollo_reveal_audit SET
      status = v_status,
      credits_used = coalesce(p_credits_confirmed, p_credits_used, credits_used),
      reason = coalesce(p_reason, reason),
      phone_after = CASE WHEN p_field = 'phone' THEN v_contact.phone ELSE phone_after END,
      email_after = CASE WHEN p_field = 'email' THEN v_contact.email ELSE email_after END
    WHERE id = p_audit_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'field', p_field,
    'status', v_status,
    'revealed', v_status = 'revealed',
    'value', CASE WHEN v_status = 'revealed' THEN v_persisted ELSE NULL END,
    'reason', p_reason,
    'job_status', v_job_status,
    'credits_used', p_credits_used,
    'credits_confirmed', p_credits_confirmed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_finalize_apollo_reveal(UUID, TEXT, TEXT, UUID, TEXT, JSONB, INTEGER, INTEGER, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_finalize_apollo_reveal(UUID, TEXT, TEXT, UUID, TEXT, JSONB, INTEGER, INTEGER, TEXT, UUID, TEXT) TO service_role;

-- 6. RPC auditada de invalidação (admin)
CREATE OR REPLACE FUNCTION public.fn_invalidate_apollo_reveal(
  p_contact_id UUID,
  p_field TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact public.enriched_contact_profiles%ROWTYPE;
  v_org UUID;
BEGIN
  IF p_field NOT IN ('phone', 'email') THEN
    RAISE EXCEPTION 'invalid_field:%', p_field;
  END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  SELECT * INTO v_contact FROM public.enriched_contact_profiles WHERE id = p_contact_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'contact_not_found');
  END IF;

  SELECT organization_id INTO v_org FROM public.prospects WHERE id = v_contact.prospect_id;
  v_org := coalesce(v_org, v_contact.workspace_id);

  IF auth.uid() IS NOT NULL THEN
    IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_platform_admin_for_rls()) THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;
    IF v_org IS DISTINCT FROM public.get_user_organization_id() AND NOT public.is_platform_admin_for_rls() THEN
      RAISE EXCEPTION 'cross_tenant_denied';
    END IF;
  END IF;

  PERFORM set_config('apollo.reveal_ctx', public.apollo_reveal_ctx_token(), true);

  IF p_field = 'phone' THEN
    UPDATE public.enriched_contact_profiles SET
      phone = NULL, phone_revealed = false, phone_reveal_status = 'invalidated',
      is_whatsapp_ready = false, phone_quality_reason = p_reason, last_reveal_attempt_at = now()
    WHERE id = p_contact_id;
  ELSE
    UPDATE public.enriched_contact_profiles SET
      email = NULL, email_normalized = NULL, email_revealed = false,
      email_reveal_status = 'invalidated', last_reveal_attempt_at = now()
    WHERE id = p_contact_id;
  END IF;

  PERFORM set_config('apollo.reveal_ctx', '', true);

  INSERT INTO public.apollo_reveal_audit (
    organization_id, prospect_id, contact_id, requested_data_type, provider,
    status, reason, requested_by, source,
    phone_before, email_before
  ) VALUES (
    v_org, v_contact.prospect_id, p_contact_id, p_field, 'apollo',
    'invalidated', p_reason, auth.uid(), 'admin_invalidation',
    v_contact.phone, v_contact.email
  );

  RETURN jsonb_build_object('ok', true, 'field', p_field, 'status', 'invalidated');
END;
$$;

REVOKE ALL ON FUNCTION public.fn_invalidate_apollo_reveal(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_invalidate_apollo_reveal(UUID, TEXT, TEXT) TO authenticated, service_role;

-- 7. Claim de jobs para o sync (SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.fn_claim_apollo_reveal_jobs(
  p_limit INTEGER DEFAULT 20,
  p_worker TEXT DEFAULT 'reveal-status-sync'
)
RETURNS SETOF public.enrichment_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id FROM public.enrichment_jobs
    WHERE provider = 'apollo_reveal'
      AND (status = 'pending_provider' OR reconciliation_required = true)
      AND (next_retry_at IS NULL OR next_retry_at <= now())
      AND (locked_at IS NULL OR locked_at < now() - interval '5 minutes')
      AND coalesce(attempt_count, 0) < 12
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.enrichment_jobs j
  SET locked_at = now(),
      locked_by = p_worker,
      attempt_count = coalesce(j.attempt_count, 0) + 1,
      next_retry_at = now() + (least(coalesce(j.attempt_count, 0) + 1, 8) * interval '90 seconds')
  FROM claimed c
  WHERE j.id = c.id
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_claim_apollo_reveal_jobs(INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_claim_apollo_reveal_jobs(INTEGER, TEXT) TO service_role;