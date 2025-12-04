-- Make proposal-pdfs bucket public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'proposal-pdfs';

-- Drop existing policies if they exist (ignore errors)
DROP POLICY IF EXISTS "Public read access for proposal PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload proposal PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update proposal PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete proposal PDFs" ON storage.objects;

-- Add RLS policy for public read access
CREATE POLICY "Public read access for proposal PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'proposal-pdfs');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload proposal PDFs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'proposal-pdfs');

-- Allow authenticated users to update
CREATE POLICY "Authenticated users can update proposal PDFs"
ON storage.objects FOR UPDATE
USING (bucket_id = 'proposal-pdfs');

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete proposal PDFs"
ON storage.objects FOR DELETE
USING (bucket_id = 'proposal-pdfs');