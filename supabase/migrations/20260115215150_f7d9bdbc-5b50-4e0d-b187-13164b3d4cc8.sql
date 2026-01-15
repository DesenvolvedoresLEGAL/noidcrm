-- Drop and recreate admin function with simplified delete - just the tables that exist
DROP FUNCTION IF EXISTS admin_delete_organization(uuid);

CREATE OR REPLACE FUNCTION admin_delete_organization(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First, nullify all FKs in opportunities table to break relationships
  UPDATE opportunities 
  SET stage_id = NULL, pipeline_id = NULL, account_id = NULL 
  WHERE organization_id = org_id;
  
  -- Also handle opportunities that reference resources from this org
  UPDATE opportunities 
  SET stage_id = NULL 
  WHERE stage_id IN (SELECT id FROM stages WHERE organization_id = org_id);
  
  UPDATE opportunities 
  SET pipeline_id = NULL 
  WHERE pipeline_id IN (SELECT id FROM pipelines WHERE organization_id = org_id);
  
  UPDATE opportunities 
  SET account_id = NULL 
  WHERE account_id IN (SELECT id FROM accounts WHERE organization_id = org_id);

  -- Delete all opportunities from this org
  DELETE FROM opportunities WHERE organization_id = org_id;
  
  -- Delete activities  
  DELETE FROM activities WHERE organization_id = org_id;
  
  -- Delete contacts (may have FK to accounts)
  UPDATE contacts SET account_id = NULL WHERE organization_id = org_id;
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
  
  -- Delete activation_checklist
  DELETE FROM activation_checklist WHERE organization_id = org_id;
  
  -- Finally delete the organization
  DELETE FROM organizations WHERE id = org_id;
  
  RETURN true;
END;
$$;