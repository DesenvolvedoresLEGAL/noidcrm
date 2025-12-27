-- Add public form columns to custom_forms table
ALTER TABLE public.custom_forms
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS public_settings JSONB DEFAULT '{}';

-- Create index on public_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_custom_forms_public_token ON public.custom_forms(public_token) WHERE public_token IS NOT NULL;

-- Create table to store public form submissions
CREATE TABLE IF NOT EXISTS public.public_form_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.custom_forms(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  values JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  created_entity_type TEXT,
  created_entity_id UUID
);

-- Enable RLS
ALTER TABLE public.public_form_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public form submissions)
CREATE POLICY "Anyone can submit public forms" 
ON public.public_form_submissions 
FOR INSERT 
WITH CHECK (true);

-- Only organization members can view submissions
CREATE POLICY "Organization members can view submissions" 
ON public.public_form_submissions 
FOR SELECT 
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Create function to generate unique token
CREATE OR REPLACE FUNCTION public.generate_public_form_token()
RETURNS TEXT AS $$
DECLARE
  token TEXT;
  exists_count INTEGER;
BEGIN
  LOOP
    token := encode(gen_random_bytes(16), 'hex');
    SELECT COUNT(*) INTO exists_count FROM public.custom_forms WHERE public_token = token;
    IF exists_count = 0 THEN
      RETURN token;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;