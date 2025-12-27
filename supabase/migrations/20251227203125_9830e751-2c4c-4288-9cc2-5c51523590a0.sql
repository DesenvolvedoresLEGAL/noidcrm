-- Tabela para controlar formulários públicos por oportunidade
CREATE TABLE public.opportunity_public_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  form_id UUID NOT NULL REFERENCES public.custom_forms(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT FALSE,
  public_token TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(opportunity_id, form_id)
);

-- Enable RLS
ALTER TABLE public.opportunity_public_forms ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view opportunity public forms in their organization"
ON public.opportunity_public_forms
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can create opportunity public forms in their organization"
ON public.opportunity_public_forms
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update opportunity public forms in their organization"
ON public.opportunity_public_forms
FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete opportunity public forms in their organization"
ON public.opportunity_public_forms
FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Adicionar campos extras de personalização ao custom_forms
ALTER TABLE public.custom_forms 
ADD COLUMN IF NOT EXISTS intro_text TEXT,
ADD COLUMN IF NOT EXISTS thank_you_message TEXT;

-- Índice para busca por token público
CREATE INDEX idx_opportunity_public_forms_token ON public.opportunity_public_forms(public_token);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_opportunity_public_forms_updated_at
BEFORE UPDATE ON public.opportunity_public_forms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();