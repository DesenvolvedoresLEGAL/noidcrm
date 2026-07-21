
CREATE OR REPLACE FUNCTION public.nsec12_probe_insert_contact_with_account(
  p_organization_id uuid,
  p_account_id uuid,
  p_nome text
) RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_acc RECORD;
  v_new_id uuid;
  v_org_a constant uuid := 'e1c4881f-0cd4-45fb-bc50-48314ce7bca0';
  v_org_b constant uuid := 'bea090a6-4c6c-45b1-92e0-83678c687578';
  v_acc_a constant uuid := '36085a30-06a1-491a-a079-a24fb42dd92b';
  v_acc_b constant uuid := 'b777baac-072a-4c1a-b481-306d0c899f41';
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'REJECTED_CALLER_NOT_SYNTHETIC';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL OR v_email NOT LIKE 'sec-test-%@example.com' THEN
    RETURN 'REJECTED_CALLER_NOT_SYNTHETIC';
  END IF;

  IF p_organization_id NOT IN (v_org_a, v_org_b) THEN
    RETURN 'REJECTED_ORG_NOT_SYNTHETIC';
  END IF;

  IF p_account_id NOT IN (v_acc_a, v_acc_b) THEN
    RETURN 'REJECTED_ACCOUNT_NOT_SYNTHETIC';
  END IF;

  IF p_nome IS NULL OR position('SECURITY_TEST_CONTACT_ACCOUNT_' in p_nome) <> 1 THEN
    RETURN 'REJECTED_NAME_PREFIX';
  END IF;

  SELECT id, organization_id, razao_social, deleted_at
    INTO v_acc
    FROM public.accounts
   WHERE id = p_account_id;

  IF v_acc.id IS NULL OR v_acc.deleted_at IS NOT NULL THEN
    RETURN 'REJECTED_ACCOUNT_INACTIVE';
  END IF;

  IF v_acc.razao_social NOT IN (
       'SECURITY_TEST_ACCOUNT_ORG_A_BASE',
       'SECURITY_TEST_ACCOUNT_ORG_B_BASE') THEN
    RETURN 'REJECTED_ACCOUNT_NOT_SYNTHETIC';
  END IF;

  BEGIN
    INSERT INTO public.contacts (organization_id, account_id, nome)
    VALUES (p_organization_id, p_account_id, p_nome)
    RETURNING id INTO v_new_id;

    RAISE EXCEPTION 'NSEC12_ROLLBACK' USING ERRCODE = 'P0001';
  EXCEPTION
    WHEN sqlstate 'P0001' THEN
      IF SQLERRM = 'NSEC12_ROLLBACK' THEN
        RETURN 'ALLOWED_ROLLED_BACK';
      END IF;
      RETURN 'UNEXPECTED_ERROR';
    WHEN insufficient_privilege THEN
      RETURN 'BLOCKED_RLS';
    WHEN check_violation THEN
      RETURN 'BLOCKED_CHECK';
    WHEN foreign_key_violation THEN
      RETURN 'BLOCKED_CONSTRAINT';
    WHEN unique_violation THEN
      RETURN 'BLOCKED_CONSTRAINT';
    WHEN not_null_violation THEN
      RETURN 'BLOCKED_CONSTRAINT';
    WHEN OTHERS THEN
      RETURN 'UNEXPECTED_ERROR';
  END;
END
$fn$;
