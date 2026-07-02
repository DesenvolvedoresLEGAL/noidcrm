
-- product-images UPDATE/DELETE org-scoped
DROP POLICY IF EXISTS "Users can update their org product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their org product images" ON storage.objects;

CREATE POLICY "Users can update their org product images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Users can delete their org product images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- proposal-layouts UPDATE/DELETE org-scoped
DROP POLICY IF EXISTS "Users can update proposal layouts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete proposal layouts" ON storage.objects;

CREATE POLICY "Users can update proposal layouts"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'proposal-layouts'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
)
WITH CHECK (
  bucket_id = 'proposal-layouts'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Users can delete proposal layouts"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'proposal-layouts'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- organization-logos UPDATE/DELETE org-scoped
DROP POLICY IF EXISTS "Users can update organization logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete organization logos" ON storage.objects;

CREATE POLICY "Users can update organization logos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
)
WITH CHECK (
  bucket_id = 'organization-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Users can delete organization logos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
