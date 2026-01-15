-- Drop and recreate admin function that handles soft delete properly
DROP FUNCTION IF EXISTS admin_delete_organization(uuid);

CREATE OR REPLACE FUNCTION admin_delete_organization(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First, set stage_id to NULL for all opportunities in this org
  -- This breaks the FK relationship before we delete stages
  UPDATE opportunities 
  SET stage_id = NULL 
  WHERE organization_id = org_id;
  
  -- Also handle opportunities that reference stages from this org but belong to other orgs
  UPDATE opportunities 
  SET stage_id = NULL 
  WHERE stage_id IN (SELECT id FROM stages WHERE organization_id = org_id);
  
  -- Now delete opportunities (they might be soft-deleted by RLS trigger)
  -- So we need to truly delete them
  DELETE FROM opportunities WHERE organization_id = org_id;
  
  -- Delete activities  
  DELETE FROM activities WHERE organization_id = org_id;
  
  -- Delete contacts
  DELETE FROM contacts WHERE organization_id = org_id;
  
  -- Delete account_partners
  DELETE FROM account_partners WHERE organization_id = org_id;
  
  -- Delete accounts
  DELETE FROM accounts WHERE organization_id = org_id;
  
  -- Delete stages
  DELETE FROM stages WHERE organization_id = org_id;
  
  -- Delete pipelines
  DELETE FROM pipelines WHERE organization_id = org_id;
  
  -- Delete organization_members
  DELETE FROM organization_members WHERE organization_id = org_id;
  
  -- Update profiles to remove org reference
  UPDATE profiles SET organization_id = NULL WHERE organization_id = org_id;
  
  -- Delete sellers
  DELETE FROM sellers WHERE organization_id = org_id;
  
  -- Delete goals
  DELETE FROM goals WHERE organization_id = org_id;
  
  -- Delete activation_checklist
  DELETE FROM activation_checklist WHERE organization_id = org_id;
  
  -- Finally delete the organization
  DELETE FROM organizations WHERE id = org_id;
  
  RETURN true;
END;
$$;