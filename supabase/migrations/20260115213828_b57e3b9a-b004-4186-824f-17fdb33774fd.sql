-- Create admin function to delete an organization with all its data
-- This function bypasses RLS because it's SECURITY DEFINER
CREATE OR REPLACE FUNCTION admin_delete_organization(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete opportunities
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