-- STAGED — Endurece policies de opportunity-files.
-- Bloqueia INSERT/UPDATE/DELETE com path que não pertence à organização ativa do usuário.

DROP POLICY IF EXISTS "Users can upload org files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view org files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their org files" ON storage.objects;

CREATE POLICY "opportunity_files_select_own_org"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'opportunity-files'
  AND EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.organization_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "opportunity_files_insert_own_org"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'opportunity-files'
  AND EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.organization_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "opportunity_files_delete_own_org"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'opportunity-files'
  AND EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.organization_id::text = (storage.foldername(name))[1]
  )
);

-- UPDATE (rename/move) bloqueado para authenticated; qualquer relocação passa por service_role
