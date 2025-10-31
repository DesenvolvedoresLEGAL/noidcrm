-- Create business_units table
CREATE TABLE IF NOT EXISTS public.business_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- Add business_unit_ids to pipelines
ALTER TABLE public.pipelines 
ADD COLUMN IF NOT EXISTS business_unit_ids UUID[] DEFAULT ARRAY[]::UUID[];

-- Create index for business_units
CREATE INDEX IF NOT EXISTS idx_business_units_org_id ON public.business_units(organization_id);
CREATE INDEX IF NOT EXISTS idx_business_units_active ON public.business_units(organization_id, is_active) WHERE is_active = true;

-- Enable RLS on business_units
ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;

-- RLS Policies for business_units
CREATE POLICY "Users can view org business units"
ON public.business_units
FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage business units"
ON public.business_units
FOR ALL
USING (user_is_org_admin(organization_id))
WITH CHECK (user_is_org_admin(organization_id));

-- Trigger for updated_at
CREATE TRIGGER update_business_units_updated_at
BEFORE UPDATE ON public.business_units
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing pipeline types to business_units
-- This will create default BUs for each organization that has pipelines
INSERT INTO public.business_units (organization_id, code, name, color, is_active)
SELECT DISTINCT 
  p.organization_id,
  UPPER(p.type) as code,
  CASE 
    WHEN UPPER(p.type) = 'ALUGUE' THEN 'Alugue'
    WHEN UPPER(p.type) = 'HUMANOID' THEN 'Humanoid'
    ELSE INITCAP(p.type)
  END as name,
  CASE 
    WHEN UPPER(p.type) = 'ALUGUE' THEN '#3b82f6'
    WHEN UPPER(p.type) = 'HUMANOID' THEN '#8b5cf6'
    ELSE '#6366f1'
  END as color,
  true as is_active
FROM public.pipelines p
WHERE NOT EXISTS (
  SELECT 1 FROM public.business_units bu 
  WHERE bu.organization_id = p.organization_id 
  AND bu.code = UPPER(p.type)
)
ON CONFLICT (organization_id, code) DO NOTHING;

-- Update existing pipelines to link with business_units
UPDATE public.pipelines p
SET business_unit_ids = ARRAY(
  SELECT bu.id 
  FROM public.business_units bu 
  WHERE bu.organization_id = p.organization_id 
  AND bu.code = UPPER(p.type)
)
WHERE business_unit_ids = ARRAY[]::UUID[];