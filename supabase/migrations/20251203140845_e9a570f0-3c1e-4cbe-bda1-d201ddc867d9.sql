-- Create bucket for proposal layout PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposal-layouts', 'proposal-layouts', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to proposal-layouts bucket
CREATE POLICY "Users can upload proposal layouts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'proposal-layouts');

-- Allow authenticated users to view proposal layouts
CREATE POLICY "Users can view proposal layouts"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'proposal-layouts');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Users can delete proposal layouts"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'proposal-layouts');

-- Allow public access to view proposal layouts (for PDF viewing)
CREATE POLICY "Public can view proposal layouts"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'proposal-layouts');