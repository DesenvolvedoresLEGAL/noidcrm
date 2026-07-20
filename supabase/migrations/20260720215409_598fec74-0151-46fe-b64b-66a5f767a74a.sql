CREATE OR REPLACE FUNCTION public.nsec12_probe_insert_contact(p_organization_id uuid, p_nome text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := current_setting('request.jwt.claim.role', true);
  v_synth_users uuid[] := ARRAY[
    '58c9eb37-4ae3-4612-bbfd-e873f49b329b','2fc41788-9b17-44c2-b90b-578f72f3e3f2',
    '70f0f9de-677c-46ac-9fe9-12a93f74fee9','ec646ad0-b719-4464-be12-aaa5b139a60f',
    '84cfb07e-6009-4a5e-a814-ab0d11a37daf','6da9ebee-770c-439c-9d18-5614fe952ac6',
    '4ac56488-9128-4ff4-b236-56e1e06e9526','e29eef51-867a-4c78-b823-2543352611e9',
    '13668a50-d30a-4346-993b-521a67a6d616','56eed1b0-542a-43b0-a01c-28a83371854f',
    'ea6ca3ef-e18a-43dc-aaca-5da10a581331','c8a897f4-48c1-4823-a75b-d7f35cb284cc'
  ]::uuid[];
  v_synth_orgs uuid[] := ARRAY[
    'e1c4881f-0cd4-45fb-bc50-48314ce7bca0'::uuid,
    'bea090a6-4c6c-45b1-92e0-83678c687578'::uuid
  ];
BEGIN
  IF v_uid IS NULL THEN RETURN 'REJECTED_CALLER_NOT_SYNTHETIC'; END IF;
  IF v_role IS NOT NULL AND v_role <> 'authenticated' THEN RETURN 'REJECTED_CALLER_NOT_SYNTHETIC'; END IF;
  IF NOT (v_uid = ANY(v_synth_users)) THEN RETURN 'REJECTED_CALLER_NOT_SYNTHETIC'; END IF;
  IF NOT (p_organization_id = ANY(v_synth_orgs)) THEN RETURN 'REJECTED_ORG_NOT_SYNTHETIC'; END IF;
  IF p_nome IS NULL OR position('SECURITY_TEST_CONTACT_' in p_nome) <> 1 THEN RETURN 'REJECTED_NAME_PREFIX'; END IF;

  BEGIN
    INSERT INTO public.contacts (organization_id, nome, account_id)
    VALUES (p_organization_id, p_nome, NULL);
    RAISE EXCEPTION 'NSEC12_PROBE_ROLLBACK' USING ERRCODE = 'P0001';
  EXCEPTION
    WHEN sqlstate 'P0001' THEN
      IF SQLERRM = 'NSEC12_PROBE_ROLLBACK' THEN RETURN 'ALLOWED_ROLLED_BACK';
      ELSE RETURN 'BLOCKED_CHECK'; END IF;
    WHEN insufficient_privilege THEN RETURN 'BLOCKED_RLS';
    WHEN sqlstate '42501' THEN RETURN 'BLOCKED_RLS';
    WHEN check_violation THEN RETURN 'BLOCKED_CHECK';
    WHEN not_null_violation THEN RETURN 'BLOCKED_CONSTRAINT';
    WHEN foreign_key_violation THEN RETURN 'BLOCKED_CONSTRAINT';
    WHEN unique_violation THEN RETURN 'BLOCKED_CONSTRAINT';
    WHEN OTHERS THEN
      IF SQLSTATE = '42501' THEN RETURN 'BLOCKED_RLS';
      ELSE RETURN 'UNEXPECTED_ERROR'; END IF;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.nsec12_probe_insert_contact(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nsec12_probe_insert_contact(uuid, text) TO authenticated;