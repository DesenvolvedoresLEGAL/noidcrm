
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Organization logos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public can view proposal layouts" ON storage.objects;
DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;

-- Fallback: se existirem outras policies public SELECT amplas nesses buckets, dropamos por qual
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND cmd='SELECT'
      AND 'public' = ANY(roles)
      AND qual IN (
        '(bucket_id = ''avatars''::text)',
        '(bucket_id = ''organization-logos''::text)',
        '(bucket_id = ''product-images''::text)',
        '(bucket_id = ''proposal-layouts''::text)'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', r.policyname);
  END LOOP;
END $$;
