-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can insert opportunities" ON opportunities;

-- Create new PERMISSIVE INSERT policy (default behavior, not restrictive)
CREATE POLICY "Users can insert opportunities" 
ON opportunities 
FOR INSERT 
TO authenticated
WITH CHECK (
  organization_id IS NOT NULL 
  AND organization_id = get_user_organization_id()
);