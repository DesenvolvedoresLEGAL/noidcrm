
CREATE OR REPLACE FUNCTION public.nsec12_probe_insert_contact_with_account(
  p_organization_id uuid,
  p_account_id uuid,
  p_nome text
) RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_synth_orgs uuid[] := ARRAY[
    'e1c4881f-0cd4-45fb-bc50-48314ce7bca0'::uuid,
    'bea090a6-4c6c-45b1-92e0-83678c687578'::uuid
  ];
  v_synth_accounts uuid[] := ARRAY[
    '36085a30-06a1-491a-a079-a24fb42dd92b'::uuid,
    'b777baac-072a-4c1a-b481-306d0c899f41'::uuid
  ];
BEGIN
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF v_email NOT LIKE 'sec-test-%@example.com' THEN
    RETURN 'REJECTED_CALLER_NOT_SYNTHETIC';
  END IF;
  IF p_organization_id IS NULL OR NOT (p_organization_id = ANY(v_synth_orgs)) THEN
    RETURN 'REJECTED_ORG_NOT_SYNTHETIC';
  END IF;
  IF p_account_id IS NULL OR NOT (p_account_id = ANY(v_synth_accounts)) THEN
    RETURN 'REJECTED_ACCOUNT_NOT_SYNTHETIC';
  END IF;
  IF p_nome IS NULL OR p_nome NOT LIKE 'SECURITY_TEST_CONTACT_ACCOUNT_MATRIX_%' THEN
    RETURN 'REJECTED_NAME_PREFIX';
  END IF;

  BEGIN
    INSERT INTO public.contacts (organization_id, account_id, nome)
    VALUES (p_organization_id, p_account_id, p_nome);
    RAISE EXCEPTION 'NSEC12_ROLLBACK' USING ERRCODE = 'P0001';
  EXCEPTION
    WHEN sqlstate 'P0001' THEN
      IF SQLERRM = 'NSEC12_ROLLBACK' THEN
        RETURN 'ALLOWED_ROLLED_BACK';
      END IF;
      RETURN 'BLOCKED_CHECK';
    WHEN insufficient_privilege THEN
      RETURN 'BLOCKED_RLS';
    WHEN check_violation THEN
      RETURN 'BLOCKED_CHECK';
    WHEN foreign_key_violation THEN
      RETURN 'BLOCKED_CONSTRAINT';
    WHEN not_null_violation THEN
      RETURN 'BLOCKED_CONSTRAINT';
    WHEN unique_violation THEN
      RETURN 'BLOCKED_CONSTRAINT';
    WHEN OTHERS THEN
      RETURN 'UNEXPECTED_ERROR';
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.nsec12_probe_insert_contact_with_account(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nsec12_probe_insert_contact_with_account(uuid, uuid, text) TO authenticated;
