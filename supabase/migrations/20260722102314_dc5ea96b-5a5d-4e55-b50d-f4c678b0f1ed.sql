
CREATE OR REPLACE FUNCTION public.nsec12_probe_activity_insert_smoke(
  p_organization_id uuid,
  p_opportunity_id uuid,
  p_marker text
) RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_new_id uuid;
BEGIN
  IF v_caller IS NULL OR v_caller NOT IN (
    '58c9eb37-4ae3-4612-bbfd-e873f49b329b'::uuid,
    '4ac56488-9128-4ff4-b236-56e1e06e9526'::uuid
  ) THEN
    RETURN 'REJECTED_CALLER';
  END IF;
  IF p_organization_id NOT IN (
    'e1c4881f-0cd4-45fb-bc50-48314ce7bca0'::uuid,
    'bea090a6-4c6c-45b1-92e0-83678c687578'::uuid
  ) THEN
    RETURN 'REJECTED_TARGET';
  END IF;
  IF p_opportunity_id NOT IN (
    'b86abbed-d591-4add-8442-609f2db6e195'::uuid,
    '750e4dc4-09c0-44ca-abe5-f4a9726e3837'::uuid
  ) THEN
    RETURN 'REJECTED_TARGET';
  END IF;
  IF p_marker IS NULL OR p_marker NOT LIKE 'SECURITY_TEST_ACTIVITY_CHG027_%' THEN
    RETURN 'REJECTED_PREFIX';
  END IF;

  BEGIN
    INSERT INTO public.activities (
      organization_id, opportunity_id, owner_user_id, type, title, status, is_automated
    ) VALUES (
      p_organization_id, p_opportunity_id, v_caller,
      'note', p_marker, 'pending', false
    ) RETURNING id INTO v_new_id;

    RAISE EXCEPTION 'NSEC12_ROLLBACK';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM LIKE '%NSEC12_ROLLBACK%' THEN
        RETURN 'ALLOWED_ROLLED_BACK';
      END IF;
      RETURN 'UNEXPECTED_ERROR:' || SQLSTATE;
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
      RETURN 'UNEXPECTED_ERROR:' || SQLSTATE;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.nsec12_probe_activity_insert_smoke(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nsec12_probe_activity_insert_smoke(uuid,uuid,text) TO authenticated;


CREATE OR REPLACE FUNCTION public.nsec12_probe_proposal_insert_smoke(
  p_organization_id uuid,
  p_opportunity_id uuid,
  p_marker text
) RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_new_id uuid;
BEGIN
  IF v_caller IS NULL OR v_caller NOT IN (
    '58c9eb37-4ae3-4612-bbfd-e873f49b329b'::uuid,
    '4ac56488-9128-4ff4-b236-56e1e06e9526'::uuid
  ) THEN
    RETURN 'REJECTED_CALLER';
  END IF;
  IF p_organization_id NOT IN (
    'e1c4881f-0cd4-45fb-bc50-48314ce7bca0'::uuid,
    'bea090a6-4c6c-45b1-92e0-83678c687578'::uuid
  ) THEN
    RETURN 'REJECTED_TARGET';
  END IF;
  IF p_opportunity_id NOT IN (
    'b86abbed-d591-4add-8442-609f2db6e195'::uuid,
    '750e4dc4-09c0-44ca-abe5-f4a9726e3837'::uuid
  ) THEN
    RETURN 'REJECTED_TARGET';
  END IF;
  IF p_marker IS NULL OR p_marker NOT LIKE 'SECURITY_TEST_PROPOSAL_CHG027_%' THEN
    RETURN 'REJECTED_PREFIX';
  END IF;

  BEGIN
    INSERT INTO public.proposals (
      organization_id, opportunity_id, status, content
    ) VALUES (
      p_organization_id, p_opportunity_id, 'draft',
      jsonb_build_object('marker', p_marker)
    ) RETURNING id INTO v_new_id;

    RAISE EXCEPTION 'NSEC12_ROLLBACK';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM LIKE '%NSEC12_ROLLBACK%' THEN
        RETURN 'ALLOWED_ROLLED_BACK';
      END IF;
      RETURN 'UNEXPECTED_ERROR:' || SQLSTATE;
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
      RETURN 'UNEXPECTED_ERROR:' || SQLSTATE;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.nsec12_probe_proposal_insert_smoke(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nsec12_probe_proposal_insert_smoke(uuid,uuid,text) TO authenticated;
