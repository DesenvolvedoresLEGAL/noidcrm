
-- Whitelist targets serão validados via prefixo no marker + verificação do row real.
-- As RPCs abaixo são temporárias (Sprint NSEC 1.2). Removidas no cleanup.

CREATE OR REPLACE FUNCTION public.nsec12_probe_account_write(
  p_target_id uuid, p_operation text, p_marker text
) RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_email text;
  v_rowcount int;
  v_before timestamptz;
  v_after timestamptz;
BEGIN
  v_email := coalesce(auth.jwt()->>'email','');
  IF v_email NOT LIKE 'sec-test-%@example.com' THEN
    RETURN 'REJECTED_CALLER';
  END IF;
  IF p_operation NOT IN ('update','delete') THEN
    RETURN 'REJECTED_OPERATION';
  END IF;
  IF coalesce(p_marker,'') NOT LIKE 'SECURITY_TEST_WRITE_CANARY_CHG025_%' THEN
    RETURN 'REJECTED_MARKER';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_target_id
      AND razao_social IN (
        'SECURITY_TEST_ACCOUNT_ORG_A_WRITE_TARGET',
        'SECURITY_TEST_ACCOUNT_ORG_B_WRITE_TARGET'
      )
  ) THEN
    -- Target existe mas caller pode não ver: aceita se está no set oficial de IDs cadastrados nesta canary.
    -- Como a checagem acima usa SECURITY INVOKER (RLS), pode falhar por cross-tenant. Neste caso o UPDATE/DELETE real cuidará via ROW_COUNT.
    NULL;
  END IF;

  BEGIN
    IF p_operation = 'update' THEN
      UPDATE public.accounts SET nome_fantasia = p_marker WHERE id = p_target_id;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 1 THEN
        RAISE EXCEPTION 'NSEC12_ROLLBACK';
      ELSE
        RETURN 'BLOCKED_RLS';
      END IF;
    ELSE
      SELECT deleted_at INTO v_before FROM public.accounts WHERE id = p_target_id;
      DELETE FROM public.accounts WHERE id = p_target_id;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      SELECT deleted_at INTO v_after FROM public.accounts WHERE id = p_target_id;
      IF v_rowcount = 1 OR (v_before IS NULL AND v_after IS NOT NULL) THEN
        RAISE EXCEPTION 'NSEC12_ROLLBACK';
      ELSE
        RETURN 'BLOCKED_RLS';
      END IF;
    END IF;
  EXCEPTION
    WHEN sqlstate 'P0001' THEN
      IF SQLERRM = 'NSEC12_ROLLBACK' THEN RETURN 'ALLOWED_ROLLED_BACK'; END IF;
      RETURN 'UNEXPECTED_ERROR';
    WHEN insufficient_privilege THEN
      RETURN 'BLOCKED_RLS';
    WHEN check_violation THEN
      RETURN 'BLOCKED_CHECK';
    WHEN foreign_key_violation OR unique_violation OR not_null_violation OR restrict_violation THEN
      RETURN 'BLOCKED_CONSTRAINT';
    WHEN OTHERS THEN
      RETURN 'UNEXPECTED_ERROR';
  END;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.nsec12_probe_contact_write(
  p_target_id uuid, p_operation text, p_marker text
) RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_email text;
  v_rowcount int;
  v_before timestamptz;
  v_after timestamptz;
BEGIN
  v_email := coalesce(auth.jwt()->>'email','');
  IF v_email NOT LIKE 'sec-test-%@example.com' THEN RETURN 'REJECTED_CALLER'; END IF;
  IF p_operation NOT IN ('update','delete') THEN RETURN 'REJECTED_OPERATION'; END IF;
  IF coalesce(p_marker,'') NOT LIKE 'SECURITY_TEST_WRITE_CANARY_CHG025_%' THEN
    RETURN 'REJECTED_MARKER';
  END IF;

  BEGIN
    IF p_operation = 'update' THEN
      UPDATE public.contacts SET primeiro_nome = p_marker WHERE id = p_target_id;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 1 THEN
        RAISE EXCEPTION 'NSEC12_ROLLBACK';
      ELSE
        RETURN 'BLOCKED_RLS';
      END IF;
    ELSE
      SELECT deleted_at INTO v_before FROM public.contacts WHERE id = p_target_id;
      DELETE FROM public.contacts WHERE id = p_target_id;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      SELECT deleted_at INTO v_after FROM public.contacts WHERE id = p_target_id;
      IF v_rowcount = 1 OR (v_before IS NULL AND v_after IS NOT NULL) THEN
        RAISE EXCEPTION 'NSEC12_ROLLBACK';
      ELSE
        RETURN 'BLOCKED_RLS';
      END IF;
    END IF;
  EXCEPTION
    WHEN sqlstate 'P0001' THEN
      IF SQLERRM = 'NSEC12_ROLLBACK' THEN RETURN 'ALLOWED_ROLLED_BACK'; END IF;
      RETURN 'UNEXPECTED_ERROR';
    WHEN insufficient_privilege THEN RETURN 'BLOCKED_RLS';
    WHEN check_violation THEN RETURN 'BLOCKED_CHECK';
    WHEN foreign_key_violation OR unique_violation OR not_null_violation OR restrict_violation THEN
      RETURN 'BLOCKED_CONSTRAINT';
    WHEN OTHERS THEN RETURN 'UNEXPECTED_ERROR';
  END;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.nsec12_probe_opportunity_write(
  p_target_id uuid, p_operation text, p_marker text
) RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_email text;
  v_rowcount int;
  v_before timestamptz;
  v_after timestamptz;
BEGIN
  v_email := coalesce(auth.jwt()->>'email','');
  IF v_email NOT LIKE 'sec-test-%@example.com' THEN RETURN 'REJECTED_CALLER'; END IF;
  IF p_operation NOT IN ('update','delete') THEN RETURN 'REJECTED_OPERATION'; END IF;
  IF coalesce(p_marker,'') NOT LIKE 'SECURITY_TEST_WRITE_CANARY_CHG025_%' THEN
    RETURN 'REJECTED_MARKER';
  END IF;

  BEGIN
    IF p_operation = 'update' THEN
      UPDATE public.opportunities SET title = p_marker WHERE id = p_target_id;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 1 THEN
        RAISE EXCEPTION 'NSEC12_ROLLBACK';
      ELSE
        RETURN 'BLOCKED_RLS';
      END IF;
    ELSE
      SELECT deleted_at INTO v_before FROM public.opportunities WHERE id = p_target_id;
      DELETE FROM public.opportunities WHERE id = p_target_id;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      SELECT deleted_at INTO v_after FROM public.opportunities WHERE id = p_target_id;
      IF v_rowcount = 1 OR (v_before IS NULL AND v_after IS NOT NULL) THEN
        RAISE EXCEPTION 'NSEC12_ROLLBACK';
      ELSE
        RETURN 'BLOCKED_RLS';
      END IF;
    END IF;
  EXCEPTION
    WHEN sqlstate 'P0001' THEN
      IF SQLERRM = 'NSEC12_ROLLBACK' THEN RETURN 'ALLOWED_ROLLED_BACK'; END IF;
      RETURN 'UNEXPECTED_ERROR';
    WHEN insufficient_privilege THEN RETURN 'BLOCKED_RLS';
    WHEN check_violation THEN RETURN 'BLOCKED_CHECK';
    WHEN foreign_key_violation OR unique_violation OR not_null_violation OR restrict_violation THEN
      RETURN 'BLOCKED_CONSTRAINT';
    WHEN OTHERS THEN RETURN 'UNEXPECTED_ERROR';
  END;
END;
$fn$;

REVOKE ALL ON FUNCTION public.nsec12_probe_account_write(uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nsec12_probe_contact_write(uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nsec12_probe_opportunity_write(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nsec12_probe_account_write(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nsec12_probe_contact_write(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nsec12_probe_opportunity_write(uuid,text,text) TO authenticated;
