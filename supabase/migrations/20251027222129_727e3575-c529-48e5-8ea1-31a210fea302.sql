-- ========================================
-- ENTERPRISE PERMISSION SYSTEM (Fixed)
-- ========================================

-- 1. Create enum for organization roles
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'manager', 'sales', 'viewer');

-- 2. Create permission_sets table for granular permissions
CREATE TABLE public.permission_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- 3. Create teams table for hierarchical structure
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  monthly_goal NUMERIC(12, 2) DEFAULT 0,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- 4. Create team_members junction table
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- 5. Add new columns to organization_members
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS permission_set_id UUID REFERENCES public.permission_sets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS org_role org_role DEFAULT 'sales';

-- Update existing roles: owner -> owner, admin -> admin, anything else -> sales
UPDATE public.organization_members 
SET org_role = CASE 
  WHEN role = 'owner' THEN 'owner'::org_role
  WHEN role = 'admin' THEN 'admin'::org_role
  ELSE 'sales'::org_role
END;

-- 6. Enable RLS on new tables
ALTER TABLE public.permission_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies for permission_sets
CREATE POLICY "Users can view permission sets in their org"
  ON public.permission_sets FOR SELECT
  USING (user_is_org_member(organization_id));

CREATE POLICY "Admins can manage permission sets"
  ON public.permission_sets FOR ALL
  USING (user_is_org_admin(organization_id))
  WITH CHECK (user_is_org_admin(organization_id));

-- 8. RLS policies for teams
CREATE POLICY "Users can view teams in their org"
  ON public.teams FOR SELECT
  USING (user_is_org_member(organization_id));

CREATE POLICY "Admins can manage teams"
  ON public.teams FOR ALL
  USING (user_is_org_admin(organization_id))
  WITH CHECK (user_is_org_admin(organization_id));

-- 9. RLS policies for team_members
CREATE POLICY "Users can view team members in their org"
  ON public.team_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id
    AND user_is_org_member(t.organization_id)
  ));

CREATE POLICY "Admins can manage team members"
  ON public.team_members FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id
    AND user_is_org_admin(t.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id
    AND user_is_org_admin(t.organization_id)
  ));

-- 10. Create indexes
CREATE INDEX idx_permission_sets_org ON public.permission_sets(organization_id);
CREATE INDEX idx_teams_org ON public.teams(organization_id);
CREATE INDEX idx_teams_parent ON public.teams(parent_team_id);
CREATE INDEX idx_team_members_team ON public.team_members(team_id);
CREATE INDEX idx_team_members_user ON public.team_members(user_id);
CREATE INDEX idx_org_members_permission_set ON public.organization_members(permission_set_id);
CREATE INDEX idx_org_members_org_role ON public.organization_members(org_role);

-- 11. Create function to get user permissions
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ps.permissions, '{}'::jsonb)
  FROM public.organization_members om
  LEFT JOIN public.permission_sets ps ON ps.id = om.permission_set_id
  WHERE om.user_id = _user_id
    AND om.status = 'active'
  LIMIT 1;
$$;

COMMENT ON TABLE public.permission_sets IS 'Granular permission definitions for organization roles';
COMMENT ON TABLE public.teams IS 'Hierarchical team structure within organizations';
COMMENT ON TABLE public.team_members IS 'Users assigned to teams';