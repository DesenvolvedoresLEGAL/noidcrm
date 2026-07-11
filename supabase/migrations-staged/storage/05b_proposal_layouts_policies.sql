-- STAGED — Policies para proposal-layouts após virar privado.

DROP POLICY IF EXISTS "Users can delete proposal layouts" ON storage.objects;
DROP POLICY IF EXISTS "Users can update proposal layouts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload proposal layouts" ON storage.objects;

CREATE POLICY "proposal_layouts_select_own_org"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'proposal-layouts'
  AND EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.organization_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "proposal_layouts_insert_own_org"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'proposal-layouts'
  AND EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.organization_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "proposal_layouts_update_own_org"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'proposal-layouts'
  AND EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.organization_id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'proposal-layouts'
  AND EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.organization_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "proposal_layouts_delete_own_org"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'proposal-layouts'
  AND EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.organization_id::text = (storage.foldername(name))[1]
  )
);
