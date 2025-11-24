-- Fix RLS policies for proposals table to allow creation

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view proposals in their organization" ON proposals;
DROP POLICY IF EXISTS "Users can create proposals" ON proposals;
DROP POLICY IF EXISTS "Users can update proposals" ON proposals;
DROP POLICY IF EXISTS "Users can delete proposals" ON proposals;

-- Create proper RLS policies for proposals table

-- SELECT: Users can view proposals in their organization
CREATE POLICY "Users can view proposals in their organization"
ON proposals
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id());

-- INSERT: Users can create proposals (organization_id set automatically)
CREATE POLICY "Users can create proposals"
ON proposals
FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization_id());

-- UPDATE: Users can update proposals in their organization
CREATE POLICY "Users can update proposals"
ON proposals
FOR UPDATE
TO authenticated
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());

-- DELETE: Users can delete proposals in their organization
CREATE POLICY "Users can delete proposals"
ON proposals
FOR DELETE
TO authenticated
USING (organization_id = get_user_organization_id());