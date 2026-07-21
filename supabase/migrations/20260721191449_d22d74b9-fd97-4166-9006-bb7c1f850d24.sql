
CREATE OR REPLACE FUNCTION public.nsec12_probe_insert_opportunity_account_contact_match(
  p_organization_id uuid,
  p_pipeline_id text,
  p_stage_id text,
  p_account_id uuid,
  p_contact_id uuid,
  p_title text
) RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_caller uuid := auth.uid();
  v_synthetic_orgs uuid[] := ARRAY[
    'e1c4881f-0cd4-45fb-bc50-48314ce7bca0'::uuid,
    'bea090a6-4c6c-45b1-92e0-83678c687578'::uuid
  ];
  v_synthetic_callers uuid[] := ARRAY[
    '58c9eb37-4ae3-4612-bbfd-e873f49b329b'::uuid, -- owner A
    '4ac56488-9128-4ff4-b236-56e1e06e9526'::uuid, -- owner B
    '84cfb07e-6009-4a5e-a814-ab0d11a37daf'::uuid, -- viewer A
    'ea6ca3ef-e18a-43dc-aaca-5da10a581331'::uuid  -- viewer B
  ];
  v_synthetic_pipelines text[] := ARRAY[
    'd1f1c882-6769-49d6-a9ca-9de75aeb30f5',
    '0526054f-d41d-485c-b669-6f6235b6f992'
  ];
  v_synthetic_stages text[] := ARRAY[
    '18208f58-29b3-4e34-99bb-613751659bc7',
    '7efae798-823e-4521-a9bc-959ba1551e48'
  ];
  v_official_accounts uuid[] := ARRAY[
    '36085a30-06a1-491a-a079-a24fb42dd92b'::uuid, -- A base
    '14127c66-7d33-43e5-8da4-f960469261af'::uuid, -- A alt
    'b777baac-072a-4c1a-b481-306d0c899f41'::uuid, -- B base
    '95585017-2d71-4cb2-a145-5ce5f08ada5e'::uuid  -- B alt
  ];
  v_official_contacts uuid[] := ARRAY[
    '55d589fb-e680-455a-b9d9-987a7c2bbbf0'::uuid, -- A base
    'b1ab7611-d0eb-4cc1-ae9c-2b00adb3d089'::uuid, -- A alt
    '47ad14f0-3e17-4a6e-a268-bdd9f5dc8a27'::uuid, -- B base
    'edfd34a3-2188-4767-80de-de3991c3e0e3'::uuid  -- B alt
  ];
  v_orphan_account uuid := '73dbf1e3-790e-4ad5-a389-22a400d37f77'::uuid;
  v_orphan_contact uuid := 'b53de59c-c80d-451c-9a2b-d9423d50fcb3'::uuid;
  v_new_id uuid;
BEGIN
  IF v_caller IS NULL OR NOT (v_caller = ANY(v_synthetic_callers)) THEN
    RETURN 'REJECTED_CALLER_NOT_SYNTHETIC';
  END IF;
  IF NOT (p_organization_id = ANY(v_synthetic_orgs)) THEN
    RETURN 'REJECTED_ORG_NOT_SYNTHETIC';
  END IF;
  IF NOT (p_pipeline_id = ANY(v_synthetic_pipelines)) THEN
    RETURN 'REJECTED_PIPELINE_NOT_SYNTHETIC';
  END IF;
  IF NOT (p_stage_id = ANY(v_synthetic_stages)) THEN
    RETURN 'REJECTED_STAGE_NOT_SYNTHETIC';
  END IF;
  IF p_account_id = v_orphan_account THEN
    RETURN 'REJECTED_ORPHAN_ACCOUNT';
  END IF;
  IF p_contact_id = v_orphan_contact THEN
    RETURN 'REJECTED_ORPHAN_CONTACT';
  END IF;
  IF NOT (p_account_id = ANY(v_official_accounts)) THEN
    RETURN 'REJECTED_ACCOUNT_NOT_OFFICIAL';
  END IF;
  IF NOT (p_contact_id = ANY(v_official_contacts)) THEN
    RETURN 'REJECTED_CONTACT_NOT_OFFICIAL';
  END IF;
  IF p_title IS NULL OR position('SECURITY_TEST_OPPORTUNITY_MATCH_CANARY_' in p_title) <> 1 THEN
    RETURN 'REJECTED_TITLE_PREFIX';
  END IF;

  BEGIN
    INSERT INTO public.opportunities (
      title, organization_id, pipeline_id, stage_id,
      account_id, contact_id, owner_user_id,
      status, automation_enabled
    ) VALUES (
      p_title, p_organization_id, p_pipeline_id, p_stage_id,
      p_account_id, p_contact_id, v_caller,
      'new', false
    ) RETURNING id INTO v_new_id;

    RAISE EXCEPTION 'NSEC12_ROLLBACK';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      RETURN 'BLOCKED_RLS';
    WHEN check_violation THEN
      RETURN 'BLOCKED_CHECK';
    WHEN foreign_key_violation THEN
      RETURN 'BLOCKED_CONSTRAINT';
    WHEN unique_violation THEN
      RETURN 'BLOCKED_CONSTRAINT';
    WHEN not_null_violation THEN
      RETURN 'BLOCKED_CONSTRAINT';
    WHEN exclusion_violation THEN
      RETURN 'BLOCKED_CONSTRAINT';
    WHEN raise_exception THEN
      IF SQLERRM = 'NSEC12_ROLLBACK' THEN
        RETURN 'ALLOWED_ROLLED_BACK';
      END IF;
      RETURN 'UNEXPECTED_ERROR';
    WHEN OTHERS THEN
      IF SQLERRM = 'NSEC12_ROLLBACK' THEN
        RETURN 'ALLOWED_ROLLED_BACK';
      END IF;
      RETURN 'UNEXPECTED_ERROR';
  END;
END;
$fn$;

REVOKE ALL ON FUNCTION public.nsec12_probe_insert_opportunity_account_contact_match(uuid,text,text,uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nsec12_probe_insert_opportunity_account_contact_match(uuid,text,text,uuid,uuid,text) TO authenticated;
