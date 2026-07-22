
-- POLICY 1: block viewer UPDATE on accounts
CREATE POLICY nsec12_accounts_update_block_viewer
  ON public.accounts
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = accounts.organization_id
        AND om.status = 'active'
        AND (
          om.org_role = 'viewer'::org_role
          OR (om.org_role IS NULL AND om.role = 'viewer')
        )
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = accounts.organization_id
        AND om.status = 'active'
        AND (
          om.org_role = 'viewer'::org_role
          OR (om.org_role IS NULL AND om.role = 'viewer')
        )
    )
  );

-- POLICY 2: block viewer UPDATE on contacts
CREATE POLICY nsec12_contacts_update_block_viewer
  ON public.contacts
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = contacts.organization_id
        AND om.status = 'active'
        AND (
          om.org_role = 'viewer'::org_role
          OR (om.org_role IS NULL AND om.role = 'viewer')
        )
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = contacts.organization_id
        AND om.status = 'active'
        AND (
          om.org_role = 'viewer'::org_role
          OR (om.org_role IS NULL AND om.role = 'viewer')
        )
    )
  );

-- Fix probe RPC for contacts DELETE detection (visibility-based)
CREATE OR REPLACE FUNCTION public.nsec12_probe_contact_write(p_target_id uuid, p_operation text, p_marker text)
  RETURNS text
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_rowcount int;
  v_visible_before boolean;
  v_visible_after boolean;
BEGIN
  v_email := coalesce(auth.jwt()->>'email','');
  IF v_email NOT LIKE 'sec-test-%@example.com' THEN RETURN 'REJECTED_CALLER'; END IF;
  IF p_operation NOT IN ('update','delete') THEN RETURN 'REJECTED_OPERATION'; END IF;
  IF coalesce(p_marker,'') NOT LIKE 'SECURITY_TEST_WRITE_CANARY_CHG02%' THEN
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
      SELECT EXISTS (
        SELECT 1 FROM public.contacts
        WHERE id = p_target_id AND deleted_at IS NULL
      ) INTO v_visible_before;

      DELETE FROM public.contacts WHERE id = p_target_id;

      SELECT EXISTS (
        SELECT 1 FROM public.contacts
        WHERE id = p_target_id AND deleted_at IS NULL
      ) INTO v_visible_after;

      IF v_visible_before AND NOT v_visible_after THEN
        RAISE EXCEPTION 'NSEC12_ROLLBACK';
      ELSIF v_visible_before AND v_visible_after THEN
        RETURN 'BLOCKED_RLS';
      ELSE
        RETURN 'BLOCKED_NO_VISIBLE_ROW';
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
$function$;
