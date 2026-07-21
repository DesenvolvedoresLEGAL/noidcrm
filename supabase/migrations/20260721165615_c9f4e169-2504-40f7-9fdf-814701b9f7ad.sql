CREATE OR REPLACE FUNCTION public.nsec12_probe_insert_opportunity_with_relations(
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
  v_synth_users uuid[] := ARRAY[
    '58c9eb37-4ae3-4612-bbfd-e873f49b329b'::uuid,
    '2fc41788-9b17-44c2-b90b-578f72f3e3f2'::uuid,
    '70f0f9de-677c-46ac-9fe9-12a93f74fee9'::uuid,
    'ec646ad0-b719-4464-be12-aaa5b139a60f'::uuid,
    '84cfb07e-6009-4a5e-a814-ab0d11a37daf'::uuid,
    '6da9ebee-770c-439c-9d18-5614fe952ac6'::uuid,
    '4ac56488-9128-4ff4-b236-56e1e06e9526'::uuid,
    'e29eef51-867a-4c78-b823-2543352611e9'::uuid,
    '13668a50-d30a-4346-993b-521a67a6d616'::uuid,
    '56eed1b0-542a-43b0-a01c-28a83371854f'::uuid,
    'ea6ca3ef-e18a-43dc-aaca-5da10a581331'::uuid,
    'c8a897f4-48c1-4823-a75b-d7f35cb284cc'::uuid
  ];
  v_synth_orgs uuid[] := ARRAY[
    'e1c4881f-0cd4-45fb-bc50-48314ce7bca0'::uuid,
    'bea090a6-4c6c-45b1-92e0-83678c687578'::uuid
  ];
  v_synth_pipelines text[] := ARRAY[
    'd1f1c882-6769-49d6-a9ca-9de75aeb30f5',
    '0526054f-d41d-485c-b669-6f6235b6f992'
  ];
  v_synth_stages text[] := ARRAY[
    '18208f58-29b3-4e34-99bb-613751659bc7',
    '7efae798-823e-4521-a9bc-959ba1551e48'
  ];
  v_synth_accounts uuid[] := ARRAY[
    '36085a30-06a1-491a-a079-a24fb42dd92b'::uuid,
    'b777baac-072a-4c1a-b481-306d0c899f41'::uuid
  ];
  v_synth_contacts uuid[] := ARRAY[
    '55d589fb-e680-455a-b9d9-987a7c2bbbf0'::uuid,
    '47ad14f0-3e17-4a6e-a268-bdd9f5dc8a27'::uuid
  ];
  v_orphan_contact uuid := 'b53de59c-c80d-451c-9a2b-d9423d50fcb3'::uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (v_uid = ANY (v_synth_users)) THEN
    RETURN 'REJECTED_CALLER_NOT_SYNTHETIC';
  END IF;
  IF NOT (p_organization_id = ANY (v_synth_orgs)) THEN
    RETURN 'REJECTED_ORG_NOT_SYNTHETIC';
  END IF;
  IF p_pipeline_id IS NULL OR NOT (p_pipeline_id = ANY (v_synth_pipelines)) THEN
    RETURN 'REJECTED_PIPELINE_NOT_SYNTHETIC';
  END IF;
  IF p_stage_id IS NULL OR NOT (p_stage_id = ANY (v_synth_stages)) THEN
    RETURN 'REJECTED_STAGE_NOT_SYNTHETIC';
  END IF;
  IF p_contact_id = v_orphan_contact THEN
    RETURN 'REJECTED_ORPHAN_CONTACT';
  END IF;
  IF p_account_id IS NOT NULL AND NOT (p_account_id = ANY (v_synth_accounts)) THEN
    RETURN 'REJECTED_ACCOUNT_NOT_SYNTHETIC';
  END IF;
  IF p_contact_id IS NOT NULL AND NOT (p_contact_id = ANY (v_synth_contacts)) THEN
    RETURN 'REJECTED_CONTACT_NOT_SYNTHETIC';
  END IF;
  IF p_title IS NULL OR position('SECURITY_TEST_OPPORTUNITY_REL_CANARY_' in p_title) <> 1 THEN
    RETURN 'REJECTED_TITLE_PREFIX';
  END IF;

  BEGIN
    INSERT INTO public.opportunities (
      title, organization_id, pipeline_id, stage_id,
      account_id, contact_id, owner_user_id, status, automation_enabled
    ) VALUES (
      p_title, p_organization_id, p_pipeline_id, p_stage_id,
      p_account_id, p_contact_id, v_uid, 'new', false
    );
    RAISE EXCEPTION 'NSEC12_ROLLBACK';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'NSEC12_ROLLBACK' THEN
        RETURN 'ALLOWED_ROLLED_BACK';
      ELSIF SQLSTATE = '42501' THEN
        RETURN 'BLOCKED_RLS';
      ELSIF SQLSTATE = '23514' THEN
        RETURN 'BLOCKED_CHECK';
      ELSIF SQLSTATE IN ('23503','23505','23502','23P01') THEN
        RETURN 'BLOCKED_CONSTRAINT';
      ELSE
        RETURN 'UNEXPECTED_ERROR';
      END IF;
  END;
END;
$fn$;

REVOKE ALL ON FUNCTION public.nsec12_probe_insert_opportunity_with_relations(uuid,text,text,uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nsec12_probe_insert_opportunity_with_relations(uuid,text,text,uuid,uuid,text) TO authenticated;