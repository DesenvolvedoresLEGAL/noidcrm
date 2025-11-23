-- =====================================================
-- FASE 2: GARANTIR COLUNAS EXIST, CRIAR NOVAS TABELAS
-- =====================================================

-- 1. DEAL PARTICIPANTS (Nova Tabela)
-- =====================================================

DROP TABLE IF EXISTS deal_participants CASCADE;

CREATE TABLE deal_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'collaborator',
  share_percentage numeric DEFAULT 0 CHECK (share_percentage >= 0 AND share_percentage <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(opportunity_id, user_id)
);

ALTER TABLE deal_participants ENABLE ROW LEVEL SECURITY;

-- 2. TEAM MEMBERS (Nova Tabela) 
-- =====================================================

DROP TABLE IF EXISTS team_members CASCADE;

ALTER TABLE teams ADD COLUMN IF NOT EXISTS visibility_scope text DEFAULT 'team' 
  CHECK (visibility_scope IN ('private', 'team', 'department', 'company'));

CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- 3. EMAIL TRACKING (Expandir Tabela Existente)
-- =====================================================

ALTER TABLE opportunity_emails ADD COLUMN IF NOT EXISTS opened_at timestamptz;
ALTER TABLE opportunity_emails ADD COLUMN IF NOT EXISTS opened_count integer DEFAULT 0;
ALTER TABLE opportunity_emails ADD COLUMN IF NOT EXISTS clicked_at timestamptz;
ALTER TABLE opportunity_emails ADD COLUMN IF NOT EXISTS link_clicks jsonb DEFAULT '[]'::jsonb;

-- 4. EMAIL TEMPLATES (Nova Tabela)
-- =====================================================

DROP TABLE IF EXISTS email_templates CASCADE;

CREATE TABLE email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  category text CHECK (category IN ('follow_up', 'proposal', 'closing', 'introduction', 'other')),
  created_by uuid,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- 5. TERRITORIES (Nova Tabela)
-- =====================================================

DROP TABLE IF EXISTS territory_assignments CASCADE;
DROP TABLE IF EXISTS territories CASCADE;

CREATE TABLE territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text CHECK (type IN ('geographic', 'segment', 'product', 'industry')),
  criteria jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE territory_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id uuid REFERENCES territories(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'assigned' CHECK (role IN ('owner', 'assigned', 'collaborator')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(territory_id, user_id)
);

ALTER TABLE territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE territory_assignments ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES
-- =====================================================

-- Deal Participants
CREATE POLICY "dp_view" ON deal_participants FOR SELECT
USING (deal_participants.organization_id = get_user_organization_id());

CREATE POLICY "dp_admin" ON deal_participants FOR ALL
USING (user_is_org_admin(deal_participants.organization_id))
WITH CHECK (user_is_org_admin(deal_participants.organization_id));

CREATE POLICY "dp_owner" ON deal_participants FOR ALL
USING (
  EXISTS (SELECT 1 FROM opportunities o WHERE o.id = deal_participants.opportunity_id AND o.owner_user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM opportunities o WHERE o.id = deal_participants.opportunity_id AND o.owner_user_id = auth.uid())
);

-- Team Members
CREATE POLICY "tm_view" ON team_members FOR SELECT
USING (team_members.organization_id = get_user_organization_id());

CREATE POLICY "tm_admin" ON team_members FOR ALL
USING (user_is_org_admin(team_members.organization_id))
WITH CHECK (user_is_org_admin(team_members.organization_id));

-- Email Templates
CREATE POLICY "et_view" ON email_templates FOR SELECT
USING (email_templates.organization_id = get_user_organization_id() AND email_templates.is_active = true);

CREATE POLICY "et_admin" ON email_templates FOR ALL
USING (user_is_org_admin(email_templates.organization_id))
WITH CHECK (user_is_org_admin(email_templates.organization_id));

-- Territories
CREATE POLICY "ter_view" ON territories FOR SELECT
USING (territories.organization_id = get_user_organization_id());

CREATE POLICY "ter_admin" ON territories FOR ALL
USING (user_is_org_admin(territories.organization_id))
WITH CHECK (user_is_org_admin(territories.organization_id));

-- Territory Assignments
CREATE POLICY "ta_view" ON territory_assignments FOR SELECT
USING (territory_assignments.organization_id = get_user_organization_id());

CREATE POLICY "ta_admin" ON territory_assignments FOR ALL
USING (user_is_org_admin(territory_assignments.organization_id))
WITH CHECK (user_is_org_admin(territory_assignments.organization_id));

-- Update Opportunity Policy
DROP POLICY IF EXISTS "Users can view opportunities based on role" ON opportunities;
DROP POLICY IF EXISTS "Users view opportunities by role" ON opportunities;
DROP POLICY IF EXISTS "opp_view_role" ON opportunities;

CREATE POLICY "opp_shared_view" ON opportunities FOR SELECT
USING (
  opportunities.organization_id = get_user_organization_id() 
  AND (
    can_view_all(auth.uid())
    OR opportunities.owner_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM deal_participants dp WHERE dp.opportunity_id = opportunities.id AND dp.user_id = auth.uid())
  )
);

-- 7. FUNÇÕES
-- =====================================================

CREATE OR REPLACE FUNCTION can_view_by_team(_user_id uuid, _owner_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_members tm1
    INNER JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = _user_id AND tm2.user_id = _owner_user_id
  );
$$;

-- 8. TRIGGERS
-- =====================================================

CREATE TRIGGER update_deal_participants_updated_at
BEFORE UPDATE ON deal_participants
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at
BEFORE UPDATE ON team_members
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON email_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_territories_updated_at
BEFORE UPDATE ON territories
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_territory_assignments_updated_at
BEFORE UPDATE ON territory_assignments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();