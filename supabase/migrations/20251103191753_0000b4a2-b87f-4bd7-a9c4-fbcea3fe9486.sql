-- Create opportunity_emails table
CREATE TABLE public.opportunity_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  from_email TEXT NOT NULL,
  to_emails TEXT[] NOT NULL DEFAULT '{}',
  cc_emails TEXT[] DEFAULT '{}',
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key to profiles
ALTER TABLE public.opportunity_emails
ADD CONSTRAINT opportunity_emails_sent_by_profiles_fkey
FOREIGN KEY (sent_by) REFERENCES public.profiles(user_id)
ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.opportunity_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view org opportunity emails"
ON public.opportunity_emails
FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert org opportunity emails"
ON public.opportunity_emails
FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update their own emails"
ON public.opportunity_emails
FOR UPDATE
USING (sent_by = auth.uid() OR user_is_org_admin(organization_id));

CREATE POLICY "Users can delete their own emails"
ON public.opportunity_emails
FOR DELETE
USING (sent_by = auth.uid() OR user_is_org_admin(organization_id));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_opportunity_emails_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_opportunity_emails_updated_at
BEFORE UPDATE ON public.opportunity_emails
FOR EACH ROW
EXECUTE FUNCTION public.update_opportunity_emails_updated_at();

-- Create index for better performance
CREATE INDEX idx_opportunity_emails_opportunity_id ON public.opportunity_emails(opportunity_id);
CREATE INDEX idx_opportunity_emails_organization_id ON public.opportunity_emails(organization_id);
CREATE INDEX idx_opportunity_emails_sent_at ON public.opportunity_emails(sent_at DESC);