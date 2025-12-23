-- Security Fix: Make proposal-pdfs bucket private
UPDATE storage.buckets SET public = false WHERE id = 'proposal-pdfs';

-- Drop overly permissive public read policy
DROP POLICY IF EXISTS "Public read access for proposal PDFs" ON storage.objects;

-- Create secure RLS policy: Only org members can access their proposal PDFs
CREATE POLICY "Org members can access proposal PDFs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'proposal-pdfs' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Security Fix: Create document masking function for LGPD compliance
CREATE OR REPLACE FUNCTION public.mask_document(doc text) 
RETURNS text AS $$
BEGIN
  IF doc IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Remove formatting to get just numbers
  DECLARE
    clean_doc text := regexp_replace(doc, '\D', '', 'g');
  BEGIN
    -- CPF: Show first 3 and last 2 digits (XXX.***.***-XX)
    IF length(clean_doc) = 11 THEN
      RETURN substring(clean_doc, 1, 3) || '.***.***-' || substring(clean_doc, 10, 2);
    -- CNPJ: Show first 2 and last 2 digits (XX.***.***/****-XX)  
    ELSIF length(clean_doc) = 14 THEN
      RETURN substring(clean_doc, 1, 2) || '.***.***/****-' || substring(clean_doc, 13, 2);
    ELSE
      -- Unknown format, mask most of it
      IF length(doc) <= 4 THEN
        RETURN '***';
      ELSE
        RETURN substring(doc, 1, 2) || repeat('*', length(doc) - 4) || substring(doc, length(doc) - 1, 2);
      END IF;
    END IF;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Security Fix: Add masked document column to proposals (for public views)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS acceptor_document_masked text 
  GENERATED ALWAYS AS (public.mask_document(acceptor_document)) STORED;

-- Security Fix: Enforce token expiration in RLS policy
-- Drop old public token policy and recreate with expiration check
DROP POLICY IF EXISTS "Public token proposal access" ON proposals;

CREATE POLICY "Public token proposal access with expiration" 
ON proposals FOR SELECT
USING (
  public_token IS NOT NULL 
  AND status = ANY (ARRAY['sent'::text, 'viewed'::text, 'accepted'::text, 'rejected'::text])
  AND (expires_at IS NULL OR expires_at > now())
);

-- Grant execute permission on mask_document function
GRANT EXECUTE ON FUNCTION public.mask_document(text) TO anon, authenticated;