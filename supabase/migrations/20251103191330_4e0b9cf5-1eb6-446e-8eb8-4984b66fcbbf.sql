-- Create opportunity_notes table
CREATE TABLE IF NOT EXISTS public.opportunity_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  created_by UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.opportunity_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for opportunity notes
CREATE POLICY "Users can view org opportunity notes"
ON public.opportunity_notes
FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert org opportunity notes"
ON public.opportunity_notes
FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update their own notes"
ON public.opportunity_notes
FOR UPDATE
USING (created_by = auth.uid() OR user_is_org_admin(organization_id));

CREATE POLICY "Users can delete their own notes"
ON public.opportunity_notes
FOR DELETE
USING (created_by = auth.uid() OR user_is_org_admin(organization_id));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_opportunity_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_opportunity_notes_updated_at
BEFORE UPDATE ON public.opportunity_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_opportunity_notes_updated_at();

-- Create index for better performance
CREATE INDEX idx_opportunity_notes_opportunity_id ON public.opportunity_notes(opportunity_id);
CREATE INDEX idx_opportunity_notes_organization_id ON public.opportunity_notes(organization_id);
CREATE INDEX idx_opportunity_notes_created_by ON public.opportunity_notes(created_by);