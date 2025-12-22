-- Add DELETE policy for organization users to permanently delete their own snapshots
CREATE POLICY "Users can delete own org snapshots" 
ON public.entity_snapshots 
FOR DELETE 
USING (organization_id IN (
  SELECT profiles.organization_id
  FROM profiles
  WHERE profiles.user_id = auth.uid()
));