
-- 1) api_keys: restrict SELECT to creator or org admin
DROP POLICY IF EXISTS "Users can view own org api keys" ON public.api_keys;
CREATE POLICY "Creators or admins view api keys"
ON public.api_keys FOR SELECT
USING (
  organization_id = public.get_user_organization_id()
  AND (
    created_by = auth.uid()
    OR public.user_is_org_admin(organization_id)
  )
);

-- 2) auth_audit_log: allow inserts (own events + service role)
CREATE POLICY "Users insert own auth audit events"
ON public.auth_audit_log FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role inserts auth audit events"
ON public.auth_audit_log FOR INSERT
TO service_role
WITH CHECK (true);

-- 3) billing_payment_methods: restrict SELECT to owner/admin only (drop finance)
DROP POLICY IF EXISTS "Organization admins can view payment methods" ON public.billing_payment_methods;
CREATE POLICY "Owner or admin view payment methods"
ON public.billing_payment_methods FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
      AND status = 'active'
      AND org_role IN ('owner'::org_role, 'admin'::org_role)
  )
);

-- 4) calendar_sync_config: revoke token columns from authenticated
REVOKE SELECT (access_token_encrypted, refresh_token_encrypted) ON public.calendar_sync_config FROM authenticated;
REVOKE UPDATE (access_token_encrypted, refresh_token_encrypted) ON public.calendar_sync_config FROM authenticated;

-- 5) email_sync_config: same treatment
REVOKE SELECT (access_token_encrypted, refresh_token_encrypted) ON public.email_sync_config FROM authenticated;
REVOKE UPDATE (access_token_encrypted, refresh_token_encrypted) ON public.email_sync_config FROM authenticated;

-- 6) cnpj_cache: explicit deny for authenticated (defense-in-depth; no policy = no access, but make intent explicit)
REVOKE ALL ON public.cnpj_cache FROM authenticated, anon;

-- 7) contacts: drop the redundant broad SELECT policies, keep the role/account-scoped one
DROP POLICY IF EXISTS "Users can view org contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users view org contacts" ON public.contacts;
-- "Users view contacts by role and account" remains as the only SELECT policy

-- 8) diagnostic_results: restrict SELECT to admins/managers or the opportunity owner
DROP POLICY IF EXISTS "Org members can view diagnostic results" ON public.diagnostic_results;
CREATE POLICY "Admins or opportunity owners view diagnostic results"
ON public.diagnostic_results FOR SELECT
USING (
  organization_id = public.get_user_organization_id()
  AND (
    public.can_view_all(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = diagnostic_results.opportunity_id
        AND o.owner_user_id = auth.uid()
    )
  )
);

-- 9) profiles: revoke CPF and birth_date from authenticated PostgREST reads
REVOKE SELECT (cpf, birth_date) ON public.profiles FROM authenticated;

-- Secure RPC so self or admin can still fetch them
CREATE OR REPLACE FUNCTION public.get_profile_sensitive_fields(_target_user_id uuid)
RETURNS TABLE(cpf text, birth_date date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.cpf, p.birth_date
  FROM public.profiles p
  WHERE p.user_id = _target_user_id
    AND (
      p.user_id = auth.uid()
      OR public.is_platform_admin_for_rls(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.organization_members me
        JOIN public.organization_members other
          ON other.organization_id = me.organization_id
        WHERE me.user_id = auth.uid()
          AND me.status = 'active'
          AND me.org_role IN ('owner'::org_role, 'admin'::org_role)
          AND other.user_id = _target_user_id
          AND other.status = 'active'
      )
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_profile_sensitive_fields(uuid) TO authenticated;

-- 10) proposals: revoke acceptor_document and acceptor_ip from authenticated
REVOKE SELECT (acceptor_document, acceptor_ip) ON public.proposals FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_proposal_acceptor_sensitive(_proposal_id uuid)
RETURNS TABLE(acceptor_document text, acceptor_ip text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.acceptor_document, p.acceptor_ip::text
  FROM public.proposals p
  WHERE p.id = _proposal_id
    AND p.organization_id = public.get_user_organization_id()
    AND public.can_view_all(auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.get_proposal_acceptor_sensitive(uuid) TO authenticated;

-- 11) scheduled_demos: restrict SELECT to admins/managers or opportunity owner
DROP POLICY IF EXISTS "Org members can view scheduled demos" ON public.scheduled_demos;
CREATE POLICY "Admins or opportunity owners view scheduled demos"
ON public.scheduled_demos FOR SELECT
USING (
  organization_id = public.get_user_organization_id()
  AND (
    public.can_view_all(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = scheduled_demos.opportunity_id
        AND o.owner_user_id = auth.uid()
    )
  )
);

-- 12) user_smtp_configs: remove smtp_password_encrypted from authenticated reads
REVOKE SELECT (smtp_password_encrypted) ON public.user_smtp_configs FROM authenticated;
REVOKE UPDATE (smtp_password_encrypted) ON public.user_smtp_configs FROM authenticated;
