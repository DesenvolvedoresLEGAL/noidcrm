
-- =====================================================
-- SPRINT 3: RLS SIMPLIFICATION - PHASE 1 & 2 (FIXED)
-- Preparation + Configuration Tables
-- =====================================================

-- =====================================================
-- PHASE 1: PREPARATION - Helper Function
-- =====================================================

-- Create unified helper function for organization record access
CREATE OR REPLACE FUNCTION public.can_access_org_record(record_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT record_org_id = get_user_organization_id()
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.can_access_org_record(uuid) TO authenticated;

-- =====================================================
-- PHASE 2: CONFIGURATION TABLES - Simplified RLS
-- =====================================================

-- =====================================================
-- Table: origins
-- =====================================================
DROP POLICY IF EXISTS "Admins can delete origins" ON public.origins;
DROP POLICY IF EXISTS "Admins can insert origins" ON public.origins;
DROP POLICY IF EXISTS "Admins can update origins" ON public.origins;
DROP POLICY IF EXISTS "Users can view org origins" ON public.origins;
DROP POLICY IF EXISTS "Managers can manage origins" ON public.origins;

CREATE POLICY "org_members_full_access" ON public.origins
  FOR ALL
  TO authenticated
  USING (can_access_org_record(organization_id))
  WITH CHECK (can_access_org_record(organization_id));

-- =====================================================
-- Table: origin_groups
-- =====================================================
DROP POLICY IF EXISTS "Admins can delete origin groups" ON public.origin_groups;
DROP POLICY IF EXISTS "Admins can insert origin groups" ON public.origin_groups;
DROP POLICY IF EXISTS "Admins can update origin groups" ON public.origin_groups;
DROP POLICY IF EXISTS "Users can view org origin groups" ON public.origin_groups;
DROP POLICY IF EXISTS "Managers can manage origin_groups" ON public.origin_groups;

CREATE POLICY "org_members_full_access" ON public.origin_groups
  FOR ALL
  TO authenticated
  USING (can_access_org_record(organization_id))
  WITH CHECK (can_access_org_record(organization_id));

-- =====================================================
-- Table: products
-- =====================================================
DROP POLICY IF EXISTS "Users can delete org products" ON public.products;
DROP POLICY IF EXISTS "Users can insert org products" ON public.products;
DROP POLICY IF EXISTS "Users can update org products" ON public.products;
DROP POLICY IF EXISTS "Users can view org products" ON public.products;
DROP POLICY IF EXISTS "Managers can manage products" ON public.products;

CREATE POLICY "org_members_full_access" ON public.products
  FOR ALL
  TO authenticated
  USING (can_access_org_record(organization_id))
  WITH CHECK (can_access_org_record(organization_id));

-- =====================================================
-- Table: product_categories
-- =====================================================
DROP POLICY IF EXISTS "Users can delete org product categories" ON public.product_categories;
DROP POLICY IF EXISTS "Users can insert org product categories" ON public.product_categories;
DROP POLICY IF EXISTS "Users can update org product categories" ON public.product_categories;
DROP POLICY IF EXISTS "Users can view org product categories" ON public.product_categories;

CREATE POLICY "org_members_full_access" ON public.product_categories
  FOR ALL
  TO authenticated
  USING (can_access_org_record(organization_id))
  WITH CHECK (can_access_org_record(organization_id));

-- =====================================================
-- Table: tags
-- =====================================================
DROP POLICY IF EXISTS "Users can delete org tags" ON public.tags;
DROP POLICY IF EXISTS "Users can insert org tags" ON public.tags;
DROP POLICY IF EXISTS "Users can update org tags" ON public.tags;
DROP POLICY IF EXISTS "Users can view org tags" ON public.tags;

CREATE POLICY "org_members_full_access" ON public.tags
  FOR ALL
  TO authenticated
  USING (can_access_org_record(organization_id))
  WITH CHECK (can_access_org_record(organization_id));

-- =====================================================
-- Table: industries
-- =====================================================
DROP POLICY IF EXISTS "Users can delete org industries" ON public.industries;
DROP POLICY IF EXISTS "Users can insert org industries" ON public.industries;
DROP POLICY IF EXISTS "Users can update org industries" ON public.industries;
DROP POLICY IF EXISTS "Users can view org industries" ON public.industries;

CREATE POLICY "org_members_full_access" ON public.industries
  FOR ALL
  TO authenticated
  USING (can_access_org_record(organization_id))
  WITH CHECK (can_access_org_record(organization_id));

-- =====================================================
-- Table: measurement_units
-- =====================================================
DROP POLICY IF EXISTS "Users can delete org measurement units" ON public.measurement_units;
DROP POLICY IF EXISTS "Users can insert org measurement units" ON public.measurement_units;
DROP POLICY IF EXISTS "Users can update org measurement units" ON public.measurement_units;
DROP POLICY IF EXISTS "Users can view org measurement units" ON public.measurement_units;

CREATE POLICY "org_members_full_access" ON public.measurement_units
  FOR ALL
  TO authenticated
  USING (can_access_org_record(organization_id))
  WITH CHECK (can_access_org_record(organization_id));

-- =====================================================
-- Table: pipelines
-- =====================================================
DROP POLICY IF EXISTS "Admins can delete pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Admins can insert pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Admins can update pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Users can view org pipelines" ON public.pipelines;

CREATE POLICY "org_members_full_access" ON public.pipelines
  FOR ALL
  TO authenticated
  USING (can_access_org_record(organization_id))
  WITH CHECK (can_access_org_record(organization_id));

-- =====================================================
-- Table: stages
-- =====================================================
DROP POLICY IF EXISTS "Admins can delete stages" ON public.stages;
DROP POLICY IF EXISTS "Admins can insert stages" ON public.stages;
DROP POLICY IF EXISTS "Admins can update stages" ON public.stages;
DROP POLICY IF EXISTS "Users can view org stages" ON public.stages;

CREATE POLICY "org_members_full_access" ON public.stages
  FOR ALL
  TO authenticated
  USING (can_access_org_record(organization_id))
  WITH CHECK (can_access_org_record(organization_id));

-- =====================================================
-- Table: loss_reasons
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage loss reasons" ON public.loss_reasons;
DROP POLICY IF EXISTS "Users can view org loss reasons" ON public.loss_reasons;

CREATE POLICY "org_members_full_access" ON public.loss_reasons
  FOR ALL
  TO authenticated
  USING (can_access_org_record(organization_id))
  WITH CHECK (can_access_org_record(organization_id));

-- =====================================================
-- Table: custom_fields
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage custom fields" ON public.custom_fields;
DROP POLICY IF EXISTS "Users can view org custom fields" ON public.custom_fields;

CREATE POLICY "org_members_full_access" ON public.custom_fields
  FOR ALL
  TO authenticated
  USING (can_access_org_record(organization_id))
  WITH CHECK (can_access_org_record(organization_id));

-- =====================================================
-- Table: custom_field_groups
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage custom field groups" ON public.custom_field_groups;
DROP POLICY IF EXISTS "Users can view org custom field groups" ON public.custom_field_groups;

CREATE POLICY "org_members_full_access" ON public.custom_field_groups
  FOR ALL
  TO authenticated
  USING (can_access_org_record(organization_id))
  WITH CHECK (can_access_org_record(organization_id));

-- =====================================================
-- Table: custom_forms
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage custom forms" ON public.custom_forms;
DROP POLICY IF EXISTS "Users can view org custom forms" ON public.custom_forms;

CREATE POLICY "org_members_full_access" ON public.custom_forms
  FOR ALL
  TO authenticated
  USING (can_access_org_record(organization_id))
  WITH CHECK (can_access_org_record(organization_id));

-- =====================================================
-- Table: email_templates
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can view org email templates" ON public.email_templates;

CREATE POLICY "org_members_full_access" ON public.email_templates
  FOR ALL
  TO authenticated
  USING (can_access_org_record(organization_id))
  WITH CHECK (can_access_org_record(organization_id));

-- =====================================================
-- Table: proposal_templates
-- =====================================================
DROP POLICY IF EXISTS "Users can create org proposal templates" ON public.proposal_templates;
DROP POLICY IF EXISTS "Users can delete org proposal templates" ON public.proposal_templates;
DROP POLICY IF EXISTS "Users can update org proposal templates" ON public.proposal_templates;
DROP POLICY IF EXISTS "Users can view org proposal templates" ON public.proposal_templates;

CREATE POLICY "org_members_full_access" ON public.proposal_templates
  FOR ALL
  TO authenticated
  USING (can_access_org_record(organization_id))
  WITH CHECK (can_access_org_record(organization_id));

-- =====================================================
-- Table: business_units
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage business units" ON public.business_units;
DROP POLICY IF EXISTS "Users can view org business units" ON public.business_units;

CREATE POLICY "org_members_full_access" ON public.business_units
  FOR ALL
  TO authenticated
  USING (can_access_org_record(organization_id))
  WITH CHECK (can_access_org_record(organization_id));

-- =====================================================
-- Table: dynamic_variables
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage org dynamic variables" ON public.dynamic_variables;
DROP POLICY IF EXISTS "Users can view system and org dynamic variables" ON public.dynamic_variables;

-- Dynamic variables has special case for system variables (no org_id)
CREATE POLICY "view_system_and_org_variables" ON public.dynamic_variables
  FOR SELECT
  TO authenticated
  USING (is_system = true OR can_access_org_record(organization_id));

CREATE POLICY "manage_org_variables" ON public.dynamic_variables
  FOR ALL
  TO authenticated
  USING (is_system = false AND can_access_org_record(organization_id))
  WITH CHECK (is_system = false AND can_access_org_record(organization_id));

-- =====================================================
-- Table: scoring_rules
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage scoring rules" ON public.scoring_rules;
DROP POLICY IF EXISTS "Users can view org scoring rules" ON public.scoring_rules;

CREATE POLICY "org_members_full_access" ON public.scoring_rules
  FOR ALL
  TO authenticated
  USING (can_access_org_record(organization_id))
  WITH CHECK (can_access_org_record(organization_id));

-- =====================================================
-- Table: icp_profiles
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage ICPs" ON public.icp_profiles;
DROP POLICY IF EXISTS "Users can view ICPs in their org" ON public.icp_profiles;

CREATE POLICY "org_members_full_access" ON public.icp_profiles
  FOR ALL
  TO authenticated
  USING (can_access_org_record(organization_id))
  WITH CHECK (can_access_org_record(organization_id));

-- =====================================================
-- VERIFICATION COMMENT
-- =====================================================
-- Sprint 3 Phase 1 & 2 Complete:
-- - Created can_access_org_record() helper function
-- - Simplified 18 configuration tables from ~54 policies to ~20 policies
-- - Standard pattern: FOR ALL TO authenticated USING/WITH CHECK can_access_org_record()
-- - Special handling for dynamic_variables (system vs org variables)
