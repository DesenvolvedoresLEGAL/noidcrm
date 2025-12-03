-- Create tags table
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Create opportunity_tags junction table
CREATE TABLE public.opportunity_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(opportunity_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for tags
CREATE POLICY "Users can view org tags"
  ON public.tags FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create org tags"
  ON public.tags FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org tags"
  ON public.tags FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can delete org tags"
  ON public.tags FOR DELETE
  USING (user_is_org_admin(organization_id));

-- RLS policies for opportunity_tags
CREATE POLICY "Users can view org opportunity_tags"
  ON public.opportunity_tags FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create org opportunity_tags"
  ON public.opportunity_tags FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete org opportunity_tags"
  ON public.opportunity_tags FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Triggers for updated_at
CREATE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_tags_organization_id ON public.tags(organization_id);
CREATE INDEX idx_opportunity_tags_opportunity_id ON public.opportunity_tags(opportunity_id);
CREATE INDEX idx_opportunity_tags_tag_id ON public.opportunity_tags(tag_id);