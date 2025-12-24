-- Narrativas por vibe_state
CREATE TABLE public.vibe_narratives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vibe_state TEXT NOT NULL,
  
  title TEXT NOT NULL,
  narrative_template TEXT NOT NULL,
  key_messages TEXT[],
  proof_points TEXT[],
  objection_handlers JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(organization_id, vibe_state)
);

-- Índices
CREATE INDEX idx_vibe_narratives_org ON public.vibe_narratives(organization_id);
CREATE INDEX idx_vibe_narratives_state ON public.vibe_narratives(vibe_state);

-- RLS
ALTER TABLE public.vibe_narratives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view narratives from their organization"
  ON public.vibe_narratives FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert narratives in their organization"
  ON public.vibe_narratives FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update narratives in their organization"
  ON public.vibe_narratives FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete narratives in their organization"
  ON public.vibe_narratives FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Trigger para updated_at
CREATE TRIGGER update_vibe_narratives_updated_at
  BEFORE UPDATE ON public.vibe_narratives
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();