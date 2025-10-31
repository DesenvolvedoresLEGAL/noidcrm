-- Add missing columns to proposals table
ALTER TABLE public.proposals
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS content jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS client_email text,
ADD COLUMN IF NOT EXISTS client_name text,
ADD COLUMN IF NOT EXISTS value numeric;

-- Add missing columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS price numeric;

-- Create storage bucket for proposal PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposal-pdfs', 'proposal-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for proposal PDFs
CREATE POLICY "Users can upload proposal PDFs in their org"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'proposal-pdfs' AND
  auth.uid() IN (
    SELECT user_id FROM public.organization_members
    WHERE organization_id::text = (storage.foldername(name))[1]
    AND status = 'active'
  )
);

CREATE POLICY "Users can view proposal PDFs in their org"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'proposal-pdfs' AND
  auth.uid() IN (
    SELECT user_id FROM public.organization_members
    WHERE organization_id::text = (storage.foldername(name))[1]
    AND status = 'active'
  )
);

CREATE POLICY "Users can delete proposal PDFs in their org"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'proposal-pdfs' AND
  auth.uid() IN (
    SELECT user_id FROM public.organization_members
    WHERE organization_id::text = (storage.foldername(name))[1]
    AND status = 'active'
  )
);