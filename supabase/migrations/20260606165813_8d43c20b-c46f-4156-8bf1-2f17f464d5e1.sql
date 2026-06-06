
-- 1) Avatar bucket: scope writes to the owning user (filename must start with auth.uid()::text || '-')
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;

CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'avatars'
  AND split_part(regexp_replace(name, '^avatars/', ''), '-', 1) = auth.uid()::text
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'avatars'
  AND split_part(regexp_replace(name, '^avatars/', ''), '-', 1) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'avatars'
  AND split_part(regexp_replace(name, '^avatars/', ''), '-', 1) = auth.uid()::text
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'avatars'
  AND split_part(regexp_replace(name, '^avatars/', ''), '-', 1) = auth.uid()::text
);

-- 2) Realtime: enable RLS on realtime.messages and add deny-by-default.
-- postgres_changes subscriptions are NOT affected (those rely on table-level RLS).
-- Broadcast/Presence are currently unused in the app and remain blocked until
-- an explicit policy is added.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
