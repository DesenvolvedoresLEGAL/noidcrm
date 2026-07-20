-- NSEC-1.2-CHG-002-SAFE — RPC temporária de probe transacional (SECURITY INVOKER)
-- Rollback: DROP FUNCTION public.nsec12_probe_insert_account(uuid, text);

CREATE OR REPLACE FUNCTION public.nsec12_probe_insert_account(
  p_organization_id uuid,
  p_razao_social text
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed_users uuid[] := ARRAY[
    '58c9eb37-4ae3-4612-bbfd-e873f49b329b'::uuid,  -- sec-test-a-owner
    '2fc41788-9b17-44c2-b90b-578f72f3e3f2'::uuid,  -- sec-test-a-admin
    '70f0f9de-677c-46ac-9fe9-12a93f74fee9'::uuid,  -- sec-test-a-manager
    'ec646ad0-b719-4464-be12-aaa5b139a60f'::uuid,  -- sec-test-a-sales
    '84cfb07e-6009-4a5e-a814-ab0d11a37daf'::uuid,  -- sec-test-a-viewer
    '6da9ebee-770c-439c-9d18-5614fe952ac6'::uuid,  -- sec-test-a-cs
    '4ac56488-9128-4ff4-b236-56e1e06e9526'::uuid,  -- sec-test-b-owner
    'e29eef51-867a-4c78-b823-2543352611e9'::uuid,  -- sec-test-b-admin
    '13668a50-d30a-4346-993b-521a67a6d616'::uuid,  -- sec-test-b-manager
    '56eed1b0-542a-43b0-a01c-28a83371854f'::uuid,  -- sec-test-b-sales
    'ea6ca3ef-e18a-43dc-aaca-5da10a581331'::uuid,  -- sec-test-b-viewer
    'c8a897f4-48c1-4823-a75b-d7f35cb284cc'::uuid   -- sec-test-b-cs
  ];
  v_allowed_orgs uuid[] := ARRAY[
    'e1c4881f-0cd4-45fb-bc50-48314ce7bca0'::uuid,  -- NOID_SECURITY_ORG_A
    'bea090a6-4c6c-45b1-92e0-83678c687578'::uuid   -- NOID_SECURITY_ORG_B
  ];
  v_new_id uuid;
  v_code text;
BEGIN
  -- Guard 1: caller must be one of the 12 synthetic users
  IF v_uid IS NULL OR NOT (v_uid = ANY(v_allowed_users)) THEN
    RETURN 'REJECTED_CALLER_NOT_SYNTHETIC';
  END IF;

  -- Guard 2: organization must be a synthetic org (probe payload)
  IF p_organization_id IS NULL OR NOT (p_organization_id = ANY(v_allowed_orgs)) THEN
    RETURN 'REJECTED_ORG_NOT_SYNTHETIC';
  END IF;

  -- Guard 3: razao_social must carry the security prefix
  IF p_razao_social IS NULL OR position('SECURITY_TEST_WRITE_' in p_razao_social) <> 1 THEN
    RETURN 'REJECTED_NAME_PREFIX';
  END IF;

  -- Transactional probe: everything inside this sub-block (INSERT + trigger side-effects)
  -- is rolled back by the exception handler. No row can survive.
  BEGIN
    INSERT INTO public.accounts (organization_id, razao_social, tipo_pessoa)
    VALUES (p_organization_id, p_razao_social, 'PJ'::tipo_pessoa_type)
    RETURNING id INTO v_new_id;

    -- Force sub-transaction rollback; we NEVER commit a probe INSERT.
    RAISE EXCEPTION 'NSEC12_PROBE_ROLLBACK'
      USING ERRCODE = 'P0001';
  EXCEPTION
    WHEN sqlstate 'P0001' THEN
      IF SQLERRM = 'NSEC12_PROBE_ROLLBACK' THEN
        v_code := 'ALLOWED_ROLLED_BACK';
      ELSE
        v_code := 'UNEXPECTED_ERROR';
      END IF;
    WHEN insufficient_privilege THEN
      v_code := 'BLOCKED_RLS';
    WHEN check_violation THEN
      v_code := 'BLOCKED_CHECK';
    WHEN not_null_violation THEN
      v_code := 'BLOCKED_CONSTRAINT';
    WHEN foreign_key_violation THEN
      v_code := 'BLOCKED_CONSTRAINT';
    WHEN unique_violation THEN
      v_code := 'BLOCKED_CONSTRAINT';
    WHEN OTHERS THEN
      v_code := 'UNEXPECTED_ERROR';
  END;

  RETURN v_code;
END;
$fn$;

COMMENT ON FUNCTION public.nsec12_probe_insert_account(uuid, text) IS
  'NSEC-1.2 temporary probe RPC. SECURITY INVOKER. Always rolls back the INSERT. Rollback: DROP FUNCTION public.nsec12_probe_insert_account(uuid, text);';

REVOKE ALL ON FUNCTION public.nsec12_probe_insert_account(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nsec12_probe_insert_account(uuid, text) TO authenticated;