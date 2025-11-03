-- Create opportunity_files table
CREATE TABLE public.opportunity_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key to profiles
ALTER TABLE public.opportunity_files
ADD CONSTRAINT opportunity_files_uploaded_by_profiles_fkey
FOREIGN KEY (uploaded_by) REFERENCES public.profiles(user_id)
ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.opportunity_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view org opportunity files"
ON public.opportunity_files
FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert org opportunity files"
ON public.opportunity_files
FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete their own files"
ON public.opportunity_files
FOR DELETE
USING (uploaded_by = auth.uid() OR user_is_org_admin(organization_id));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_opportunity_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_opportunity_files_updated_at
BEFORE UPDATE ON public.opportunity_files
FOR EACH ROW
EXECUTE FUNCTION public.update_opportunity_files_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_opportunity_files_opportunity_id ON public.opportunity_files(opportunity_id);
CREATE INDEX idx_opportunity_files_organization_id ON public.opportunity_files(organization_id);

-- Create storage bucket for opportunity files
INSERT INTO storage.buckets (id, name, public)
VALUES ('opportunity-files', 'opportunity-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for opportunity files
CREATE POLICY "Users can view org files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'opportunity-files' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text 
    FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Users can upload org files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'opportunity-files' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text 
    FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Users can delete their org files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'opportunity-files' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text 
    FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);