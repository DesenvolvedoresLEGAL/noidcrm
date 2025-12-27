-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('organization-logos', 'organization-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their organization folder
CREATE POLICY "Users can upload organization logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'organization-logos' 
  AND auth.role() = 'authenticated'
);

-- Allow public read access to organization logos (for PDF exports, etc)
CREATE POLICY "Organization logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'organization-logos');

-- Allow authenticated users to update/delete logos
CREATE POLICY "Users can update organization logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'organization-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete organization logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'organization-logos' AND auth.role() = 'authenticated');