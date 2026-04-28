
-- ============================================================
-- Sprint 3: Audit log for manual user-context changes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.crm_user_context_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  change_type text NOT NULL,
  previous_permission_key text,
  new_permission_key text,
  previous_department_key text,
  new_department_key text,
  previous_business_function_key text,
  new_business_function_key text,
  previous_status text,
  new_status text,
  review_note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_user_context_change_logs_change_type_valid
    CHECK (change_type IN ('manual_context_update', 'manual_review_completed', 'context_created_from_ui'))
);

CREATE INDEX IF NOT EXISTS idx_crm_user_context_change_logs_tenant_user
  ON public.crm_user_context_change_logs (tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_crm_user_context_change_logs_tenant_created
  ON public.crm_user_context_change_logs (tenant_id, created_at DESC);

ALTER TABLE public.crm_user_context_change_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins and owners can read crm user context change logs"
  ON public.crm_user_context_change_logs;
CREATE POLICY "admins and owners can read crm user context change logs"
  ON public.crm_user_context_change_logs
  FOR SELECT
  USING (public.is_tenant_admin_or_owner(tenant_id));

DROP POLICY IF EXISTS "admins and owners can insert crm user context change logs"
  ON public.crm_user_context_change_logs;
CREATE POLICY "admins and owners can insert crm user context change logs"
  ON public.crm_user_context_change_logs
  FOR INSERT
  WITH CHECK (
    public.is_tenant_admin_or_owner(tenant_id)
    AND changed_by = auth.uid()
  );

-- No UPDATE / DELETE policies: append-only.

-- ============================================================
-- RPC: crm_save_user_context
-- Atomically upserts crm_user_contexts and writes audit log.
-- ============================================================

CREATE OR REPLACE FUNCTION public.crm_save_user_context(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _user_id uuid;
  _permission_role_id uuid;
  _department_id uuid;
  _business_function_id uuid;
  _manager_user_id uuid;
  _status text;
  _mark_reviewed boolean;
  _review_note text;

  _bf_dept_id uuid;

  _prev RECORD;
  _prev_perm_key text;
  _prev_dept_key text;
  _prev_func_key text;
  _prev_status text;
  _prev_metadata jsonb;
  _prev_requires_review boolean;

  _new_perm_key text;
  _new_dept_key text;
  _new_func_key text;

  _existed boolean;
  _changed_core boolean;
  _change_type text;

  _merged_metadata jsonb;
  _new_meta_overlay jsonb;
  _previous_context jsonb;

  _final_requires_review boolean;
  _context_id uuid;
BEGIN
  -- Extract & validate payload
  _tenant_id := (payload->>'tenant_id')::uuid;
  _user_id := (payload->>'user_id')::uuid;
  _permission_role_id := NULLIF(payload->>'permission_role_id','')::uuid;
  _department_id := NULLIF(payload->>'department_id','')::uuid;
  _business_function_id := NULLIF(payload->>'business_function_id','')::uuid;
  _manager_user_id := NULLIF(payload->>'manager_user_id','')::uuid;
  _status := COALESCE(NULLIF(payload->>'status',''), 'active');
  _mark_reviewed := COALESCE((payload->>'mark_as_reviewed')::boolean, false);
  _review_note := NULLIF(payload->>'review_note','');

  IF _tenant_id IS NULL OR _user_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id and user_id are required';
  END IF;

  IF _permission_role_id IS NULL OR _department_id IS NULL OR _business_function_id IS NULL THEN
    RAISE EXCEPTION 'permission_role_id, department_id and business_function_id are required';
  END IF;

  -- Tenant authorization
  IF NOT public.is_tenant_admin_or_owner(_tenant_id) THEN
    RAISE EXCEPTION 'forbidden: only owners/admins can edit user context';
  END IF;

  -- Validate that selected business_function belongs to the selected department
  -- and that all three records belong to the same tenant.
  SELECT department_id INTO _bf_dept_id
  FROM public.crm_business_functions
  WHERE id = _business_function_id AND tenant_id = _tenant_id AND is_active = true;

  IF _bf_dept_id IS NULL THEN
    RAISE EXCEPTION 'business_function not found or inactive for this tenant';
  END IF;

  IF _bf_dept_id <> _department_id THEN
    RAISE EXCEPTION 'business_function does not belong to the selected department';
  END IF;

  -- Validate department & permission belong to tenant
  PERFORM 1 FROM public.crm_departments
    WHERE id = _department_id AND tenant_id = _tenant_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'department not found or inactive for this tenant';
  END IF;

  PERFORM 1 FROM public.crm_permission_roles
    WHERE id = _permission_role_id AND tenant_id = _tenant_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'permission_role not found or inactive for this tenant';
  END IF;

  -- Validate status
  IF _status NOT IN ('active','inactive','pending','blocked') THEN
    RAISE EXCEPTION 'invalid status: %', _status;
  END IF;

  -- Resolve new keys (for log)
  SELECT key INTO _new_perm_key FROM public.crm_permission_roles WHERE id = _permission_role_id;
  SELECT key INTO _new_dept_key FROM public.crm_departments WHERE id = _department_id;
  SELECT key INTO _new_func_key FROM public.crm_business_functions WHERE id = _business_function_id;

  -- Read previous context
  SELECT
    c.id,
    c.permission_role_id,
    c.department_id,
    c.business_function_id,
    c.status,
    c.metadata,
    pr.key AS perm_key,
    d.key AS dept_key,
    bf.key AS func_key
  INTO _prev
  FROM public.crm_user_contexts c
  LEFT JOIN public.crm_permission_roles pr ON pr.id = c.permission_role_id
  LEFT JOIN public.crm_departments d ON d.id = c.department_id
  LEFT JOIN public.crm_business_functions bf ON bf.id = c.business_function_id
  WHERE c.tenant_id = _tenant_id AND c.user_id = _user_id;

  _existed := _prev.id IS NOT NULL;
  _prev_perm_key := _prev.perm_key;
  _prev_dept_key := _prev.dept_key;
  _prev_func_key := _prev.func_key;
  _prev_status := _prev.status;
  _prev_metadata := COALESCE(_prev.metadata, '{}'::jsonb);
  _prev_requires_review := COALESCE((_prev_metadata->>'requires_review')::boolean, false);

  _changed_core := (
    _existed
    AND (
      _prev.permission_role_id IS DISTINCT FROM _permission_role_id
      OR _prev.department_id IS DISTINCT FROM _department_id
      OR _prev.business_function_id IS DISTINCT FROM _business_function_id
    )
  );

  -- Build metadata overlay (non-destructive merge with previous metadata)
  _new_meta_overlay := jsonb_build_object(
    'last_manual_review_at', to_jsonb(now()),
    'last_manual_review_by', to_jsonb(auth.uid()),
    'review_source', 'user_context_sprint_3_ui'
  );

  IF _review_note IS NOT NULL THEN
    _new_meta_overlay := _new_meta_overlay || jsonb_build_object('review_note', _review_note);
  END IF;

  IF _mark_reviewed THEN
    _new_meta_overlay := _new_meta_overlay || jsonb_build_object('requires_review', false);
    _final_requires_review := false;
  ELSE
    _final_requires_review := _prev_requires_review;
  END IF;

  IF _changed_core THEN
    _previous_context := jsonb_build_object(
      'permission_key', _prev_perm_key,
      'department_key', _prev_dept_key,
      'business_function_key', _prev_func_key,
      'status', _prev_status,
      'recorded_at', to_jsonb(now())
    );
    _new_meta_overlay := _new_meta_overlay || jsonb_build_object('previous_context', _previous_context);
  END IF;

  IF NOT _existed THEN
    _new_meta_overlay := _new_meta_overlay || jsonb_build_object('created_by_sprint', 'user_context_sprint_3_ui');
  END IF;

  _merged_metadata := _prev_metadata || _new_meta_overlay;

  -- Upsert
  IF _existed THEN
    UPDATE public.crm_user_contexts SET
      permission_role_id = _permission_role_id,
      department_id = _department_id,
      business_function_id = _business_function_id,
      manager_user_id = COALESCE(_manager_user_id, manager_user_id),
      status = _status,
      metadata = _merged_metadata,
      updated_at = now()
    WHERE id = _prev.id
    RETURNING id INTO _context_id;
  ELSE
    INSERT INTO public.crm_user_contexts (
      tenant_id, user_id, permission_role_id, department_id, business_function_id,
      manager_user_id, status, is_dashboard_dynamic_enabled, is_automation_dynamic_enabled,
      metadata
    ) VALUES (
      _tenant_id, _user_id, _permission_role_id, _department_id, _business_function_id,
      _manager_user_id, _status, false, false,
      _merged_metadata
    )
    RETURNING id INTO _context_id;
  END IF;

  -- Determine change_type
  IF NOT _existed THEN
    _change_type := 'context_created_from_ui';
  ELSIF _changed_core OR _prev_status IS DISTINCT FROM _status THEN
    _change_type := 'manual_context_update';
  ELSIF _mark_reviewed AND _prev_requires_review THEN
    _change_type := 'manual_review_completed';
  ELSE
    _change_type := 'manual_context_update';
  END IF;

  -- Insert audit log
  INSERT INTO public.crm_user_context_change_logs (
    tenant_id, user_id, changed_by, change_type,
    previous_permission_key, new_permission_key,
    previous_department_key, new_department_key,
    previous_business_function_key, new_business_function_key,
    previous_status, new_status,
    review_note,
    metadata
  ) VALUES (
    _tenant_id, _user_id, auth.uid(), _change_type,
    _prev_perm_key, _new_perm_key,
    _prev_dept_key, _new_dept_key,
    _prev_func_key, _new_func_key,
    _prev_status, _status,
    _review_note,
    jsonb_build_object(
      'created_by_sprint', 'user_context_sprint_3',
      'mark_as_reviewed', _mark_reviewed,
      'changed_core', _changed_core
    )
  );

  RETURN jsonb_build_object(
    'context_id', _context_id,
    'change_type', _change_type,
    'requires_review', _final_requires_review,
    'created', NOT _existed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.crm_save_user_context(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_save_user_context(jsonb) TO authenticated;
