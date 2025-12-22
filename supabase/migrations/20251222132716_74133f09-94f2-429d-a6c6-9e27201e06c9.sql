-- Allow Super Admins to view all entity snapshots (for /admin/trash)
CREATE POLICY "Super admins can view all snapshots" 
ON public.entity_snapshots
FOR SELECT 
TO public
USING (public.is_platform_super_admin(auth.uid()));

-- Allow Super Admins to delete any snapshot (permanent delete from admin trash)
CREATE POLICY "Super admins can delete all snapshots" 
ON public.entity_snapshots
FOR DELETE 
TO public
USING (public.is_platform_super_admin(auth.uid()));