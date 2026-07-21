
CREATE OR REPLACE FUNCTION public.nsec12_probe_insert_opportunity(
  p_organization_id uuid,
  p_pipeline_id text,
  p_stage_id text,
  p_title text
) RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_role text := auth.role();
  v_synthetic_users uuid[] := ARRAY[
    '58c9eb37-4ae3-4612-bbfd-e873f49b329b','2fc41788-9b17-44c2-b90b-578f72f3e3f2',
    '70f0f9de-677c-46ac-9fe9-12a93f74fee9','ec646ad0-b719-4464-be12-aaa5b139a60f',
    '84cfb07e-6009-4a5e-a814-ab0d11a37daf','6da9ebee-770c-439c-9d18-5614fe952ac6',
    '4ac56488-9128-4ff4-b236-56e1e06e9526','e29eef51-867a-4c78-b823-2543352611e9',
    '13668a50-d30a-4346-993b-521a67a6d616','56eed1b0-542a-43b0-a01c-28a83371854f',
    'ea6ca3ef-e18a-43dc-aaca-5da10a581331','c8a897f4-48c1-4823-a75b-d7f35cb284cc'
  ]::uuid[];
  v_synthetic_orgs uuid[] := ARRAY[
    'e1c4881f-0cd4-45fb-bc50-48314ce7bca0'::uuid,
    'bea090a6-4c6c-45b1-92e0-83678c687578'::uuid
  ];
  v_synthetic_pipelines uuid[] := ARRAY[
    'd1f1c882-6769-49d6-a9ca-9de75aeb30f5'::uuid,
    '0526054f-d41d-485c-b669-6f6235b6f992'::uuid
  ];
  v_synthetic_stages uuid[] := ARRAY[
    '18208f58-29b3-4e34-99bb-613751659bc7'::uuid,
    '7efae798-823e-4521-a9bc-959ba1551e48'::uuid
  ];
  v_pid uuid;
  v_sid uuid;
BEGIN
  IF v_caller IS NULL THEN RETURN 'REJECTED_CALLER_NOT_SYNTHETIC'; END IF;
  IF v_role IS DISTINCT FROM 'authenticated' THEN RETURN 'REJECTED_CALLER_NOT_SYNTHETIC'; END IF;
  IF NOT (v_caller = ANY(v_synthetic_users)) THEN RETURN 'REJECTED_CALLER_NOT_SYNTHETIC'; END IF;
  IF NOT (p_organization_id = ANY(v_synthetic_orgs)) THEN RETURN 'REJECTED_ORG_NOT_SYNTHETIC'; END IF;
  IF p_title IS NULL OR position('SECURITY_TEST_OPPORTUNITY_CANARY_' in p_title) <> 1 THEN
    RETURN 'REJECTED_TITLE_PREFIX';
  END IF;

  IF p_pipeline_id IS NOT NULL THEN
    BEGIN v_pid := p_pipeline_id::uuid; EXCEPTION WHEN others THEN RETURN 'REJECTED_PIPELINE_NOT_SYNTHETIC'; END;
    IF NOT (v_pid = ANY(v_synthetic_pipelines)) THEN RETURN 'REJECTED_PIPELINE_NOT_SYNTHETIC'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.pipelines WHERE id = v_pid) THEN
      RETURN 'REJECTED_PIPELINE_NOT_SYNTHETIC';
    END IF;
  END IF;

  IF p_stage_id IS NOT NULL THEN
    BEGIN v_sid := p_stage_id::uuid; EXCEPTION WHEN others THEN RETURN 'REJECTED_STAGE_NOT_SYNTHETIC'; END;
    IF NOT (v_sid = ANY(v_synthetic_stages)) THEN RETURN 'REJECTED_STAGE_NOT_SYNTHETIC'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.stages WHERE id = v_sid) THEN
      RETURN 'REJECTED_STAGE_NOT_SYNTHETIC';
    END IF;
  END IF;

  -- Attempt INSERT inside sub-block; force rollback on success via controlled exception.
  BEGIN
    INSERT INTO public.opportunities (
      title, organization_id, pipeline_id, stage_id,
      status, automation_enabled,
      account_id, contact_id, source_opportunity_id,
      accepted_proposal_id, loss_reason_id, client_loss_reason_id,
      qualified_at, deleted_at
    ) VALUES (
      p_title, p_organization_id, v_pid, v_sid,
      'new', false,
      NULL, NULL, NULL,
      NULL, NULL, NULL,
      NULL, NULL
    );
    -- Force rollback of the INSERT and any trigger side effects.
    RAISE EXCEPTION 'NSEC12_ROLLBACK' USING ERRCODE = 'P0001';
  EXCEPTION
    WHEN sqlstate 'P0001' THEN
      IF SQLERRM = 'NSEC12_ROLLBACK' THEN RETURN 'ALLOWED_ROLLED_BACK'; END IF;
      RETURN 'BLOCKED_CHECK';
    WHEN insufficient_privilege THEN RETURN 'BLOCKED_RLS';
    WHEN check_violation THEN RETURN 'BLOCKED_CHECK';
    WHEN foreign_key_violation THEN RETURN 'BLOCKED_CONSTRAINT';
    WHEN not_null_violation THEN RETURN 'BLOCKED_CONSTRAINT';
    WHEN unique_violation THEN RETURN 'BLOCKED_CONSTRAINT';
    WHEN OTHERS THEN
      -- RLS violations in Postgres surface as sqlstate 42501 (insufficient_privilege)
      -- but WITH CHECK failures raise 'new row violates row-level security policy' (42501). Already covered.
      RETURN 'UNEXPECTED_ERROR';
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.nsec12_probe_insert_opportunity(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nsec12_probe_insert_opportunity(uuid, text, text, text) TO authenticated;
