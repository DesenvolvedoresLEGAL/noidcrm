
-- Create industries table for configurable industry/segment options
CREATE TABLE public.industries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'Building2',
  is_active BOOLEAN DEFAULT true,
  is_system_default BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.industries ENABLE ROW LEVEL SECURITY;

-- System defaults are visible to everyone (organization_id IS NULL)
-- Organization-specific industries visible to org members
CREATE POLICY "Industries visible to org members or system defaults"
ON public.industries FOR SELECT
USING (
  organization_id IS NULL 
  OR organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Only admins can manage org-specific industries
CREATE POLICY "Admins can manage org industries"
ON public.industries FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() 
    AND status = 'active' 
    AND org_role IN ('owner', 'admin')
  )
);

-- Insert system default industries (available to all orgs during onboarding)
INSERT INTO public.industries (organization_id, name, icon, is_system_default, display_order) VALUES
(NULL, 'Tecnologia', 'Cpu', true, 1),
(NULL, 'Serviços Financeiros', 'Landmark', true, 2),
(NULL, 'Saúde', 'Heart', true, 3),
(NULL, 'Educação', 'GraduationCap', true, 4),
(NULL, 'Varejo', 'ShoppingCart', true, 5),
(NULL, 'Manufatura', 'Factory', true, 6),
(NULL, 'Imobiliário', 'Home', true, 7),
(NULL, 'Consultoria', 'Briefcase', true, 8),
(NULL, 'Marketing e Publicidade', 'Megaphone', true, 9),
(NULL, 'Logística e Transporte', 'Truck', true, 10),
(NULL, 'Alimentação e Bebidas', 'UtensilsCrossed', true, 11),
(NULL, 'Construção Civil', 'HardHat', true, 12),
(NULL, 'Energia', 'Zap', true, 13),
(NULL, 'Telecomunicações', 'Phone', true, 14),
(NULL, 'Agronegócio', 'Wheat', true, 15),
(NULL, 'Turismo e Hotelaria', 'Plane', true, 16),
(NULL, 'Automotivo', 'Car', true, 17),
(NULL, 'Jurídico', 'Scale', true, 18),
(NULL, 'Contabilidade', 'Calculator', true, 19),
(NULL, 'E-commerce', 'Globe', true, 20),
(NULL, 'SaaS / Software', 'Cloud', true, 21),
(NULL, 'Mídia e Entretenimento', 'Film', true, 22),
(NULL, 'Recursos Humanos', 'Users', true, 23),
(NULL, 'Segurança', 'Shield', true, 24),
(NULL, 'Outro', 'MoreHorizontal', true, 99);

-- Trigger for updated_at
CREATE TRIGGER update_industries_updated_at
BEFORE UPDATE ON public.industries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
