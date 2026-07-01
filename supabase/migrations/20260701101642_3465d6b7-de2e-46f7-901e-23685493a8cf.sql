-- =====================================================================
-- Fix 1: automation_logs – add direct organization_id scoping
-- =====================================================================

ALTER TABLE public.automation_logs
  ADD COLUMN IF NOT EXISTS organization_id uuid;

-- Backfill from linked opportunity when possible
UPDATE public.automation_logs al
SET organization_id = o.organization_id
FROM public.opportunities o
WHERE al.opportunity_id = o.id
  AND al.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_automation_logs_organization_id
  ON public.automation_logs(organization_id);

-- Trigger to auto-populate organization_id on insert (defense in depth)
CREATE OR REPLACE FUNCTION public.automation_logs_set_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.opportunity_id IS NOT NULL THEN
    SELECT o.organization_id INTO NEW.organization_id
    FROM public.opportunities o
    WHERE o.id = NEW.opportunity_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_automation_logs_set_organization_id ON public.automation_logs;
CREATE TRIGGER trg_automation_logs_set_organization_id
BEFORE INSERT OR UPDATE OF opportunity_id, organization_id ON public.automation_logs
FOR EACH ROW EXECUTE FUNCTION public.automation_logs_set_organization_id();

-- Direct org-scoped RLS policies (covers rows with NULL opportunity_id)
DROP POLICY IF EXISTS "Org members view automation_logs by org" ON public.automation_logs;
CREATE POLICY "Org members view automation_logs by org"
ON public.automation_logs
FOR SELECT
TO authenticated
USING (
  organization_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = automation_logs.organization_id
      AND om.status = 'active'
  )
);

DROP POLICY IF EXISTS "Org admins manage automation_logs by org" ON public.automation_logs;
CREATE POLICY "Org admins manage automation_logs by org"
ON public.automation_logs
FOR ALL
TO authenticated
USING (
  organization_id IS NOT NULL
  AND public.user_is_org_admin(organization_id)
)
WITH CHECK (
  organization_id IS NOT NULL
  AND public.user_is_org_admin(organization_id)
);

-- =====================================================================
-- Fix 2: get_user_organization_id() – honor explicit JWT org claim
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  claim_org uuid;
BEGIN
  -- 1. Prefer explicit organization_id claim in the JWT, if the user is an
  --    active member of that organization. This lets multi-org users (platform
  --    admins, transferred users) select the correct tenant explicitly and
  --    prevents silent scoping to the "most recently joined" organization.
  BEGIN
    claim_org := NULLIF(current_setting('request.jwt.claim.organization_id', true), '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    claim_org := NULL;
  END;

  IF claim_org IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = claim_org
      AND status = 'active'
  ) THEN
    RETURN claim_org;
  END IF;

  -- 2. Fallback: most-recently-joined active organization (legacy behavior).
  RETURN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
      AND status = 'active'
    ORDER BY joined_at DESC NULLS LAST
    LIMIT 1
  );
END;
$function$;