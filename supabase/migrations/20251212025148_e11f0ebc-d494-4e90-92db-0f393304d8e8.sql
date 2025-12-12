
-- =====================================================
-- PHASE 1: Fix can_view_all function (exclude manager)
-- =====================================================

CREATE OR REPLACE FUNCTION public.can_view_all(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = _user_id
      AND status = 'active'
      AND org_role IN ('owner', 'admin', 'finance')
  );
$$;

-- =====================================================
-- PHASE 2: Update get_visible_user_ids function
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_visible_user_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      -- Owner/Admin/Finance see everything (NULL = no filter)
      WHEN can_view_all(_user_id) THEN NULL
      -- Team managers see their team members + themselves
      WHEN is_team_manager(_user_id) THEN 
        COALESCE(get_team_member_ids(_user_id), ARRAY[]::uuid[]) || ARRAY[_user_id]::uuid[]
      -- Everyone else sees only themselves
      ELSE ARRAY[_user_id]::uuid[]
    END;
$$;

-- =====================================================
-- PHASE 3: Update RLS Policies
-- =====================================================

-- 3.1 OPPORTUNITIES - Granular visibility policy
DROP POLICY IF EXISTS "opportunities_select_org_members" ON opportunities;
DROP POLICY IF EXISTS "opportunities_select_by_visibility" ON opportunities;

CREATE POLICY "opportunities_select_by_visibility" 
ON opportunities FOR SELECT
USING (
  organization_id = get_user_organization_id() 
  AND (
    -- Owner/Admin/Finance see all
    can_view_all(auth.uid())
    -- Salesperson sees their own
    OR owner_user_id = auth.uid()
    -- Manager sees their team members' opportunities
    OR (is_team_manager(auth.uid()) AND owner_user_id = ANY(get_team_member_ids(auth.uid())))
  )
);

-- 3.2 ACTIVITIES - Same visibility logic
DROP POLICY IF EXISTS "Users can view activities based on role" ON activities;
DROP POLICY IF EXISTS "activities_select_by_visibility" ON activities;

CREATE POLICY "activities_select_by_visibility" 
ON activities FOR SELECT
USING (
  organization_id = get_user_organization_id() 
  AND (
    -- Owner/Admin/Finance see all
    can_view_all(auth.uid())
    -- User sees their own activities
    OR owner_user_id = auth.uid()
    -- Manager sees their team members' activities
    OR (is_team_manager(auth.uid()) AND owner_user_id = ANY(get_team_member_ids(auth.uid())))
  )
);

-- 3.3 PROPOSALS - Via opportunity ownership
DROP POLICY IF EXISTS "Org members view their proposals" ON proposals;
DROP POLICY IF EXISTS "Users can view org proposals" ON proposals;
DROP POLICY IF EXISTS "proposals_select_by_visibility" ON proposals;

CREATE POLICY "proposals_select_by_visibility" 
ON proposals FOR SELECT
USING (
  -- Anonymous access with public token (for clients viewing proposals)
  (public_token IS NOT NULL AND auth.uid() IS NULL)
  OR (
    organization_id = get_user_organization_id() 
    AND (
      -- Owner/Admin/Finance see all
      can_view_all(auth.uid())
      -- User sees proposals for their opportunities
      OR EXISTS (
        SELECT 1 FROM opportunities o 
        WHERE o.id = proposals.opportunity_id
        AND o.owner_user_id = auth.uid()
      )
      -- Manager sees proposals for their team's opportunities
      OR (is_team_manager(auth.uid()) AND EXISTS (
        SELECT 1 FROM opportunities o 
        WHERE o.id = proposals.opportunity_id
        AND o.owner_user_id = ANY(get_team_member_ids(auth.uid()))
      ))
    )
  )
);
