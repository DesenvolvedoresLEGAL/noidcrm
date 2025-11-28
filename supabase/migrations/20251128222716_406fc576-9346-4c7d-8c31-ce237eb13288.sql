-- Sprint 1: Proposal Layouts (PDF Pages)
-- Criar tabelas para gerenciamento de layouts visuais de propostas

-- Tabela de layouts de proposta
CREATE TABLE IF NOT EXISTS public.proposal_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_default_per_org UNIQUE NULLS NOT DISTINCT (organization_id, is_default)
);

-- Tabela de páginas do layout
CREATE TABLE IF NOT EXISTS public.proposal_layout_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID NOT NULL REFERENCES public.proposal_layouts(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  page_type TEXT DEFAULT 'custom' CHECK (page_type IN ('cover', 'content', 'terms', 'custom')),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_page_per_layout UNIQUE (layout_id, page_number)
);

-- Adicionar coluna layout_id à tabela proposals (opcional - para usar layout específico)
ALTER TABLE public.proposals 
ADD COLUMN IF NOT EXISTS layout_id UUID REFERENCES public.proposal_layouts(id) ON DELETE SET NULL;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_proposal_layouts_org ON public.proposal_layouts(organization_id);
CREATE INDEX IF NOT EXISTS idx_proposal_layout_pages_layout ON public.proposal_layout_pages(layout_id);
CREATE INDEX IF NOT EXISTS idx_proposals_layout ON public.proposals(layout_id);

-- Enable RLS
ALTER TABLE public.proposal_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_layout_pages ENABLE ROW LEVEL SECURITY;

-- RLS Policies para proposal_layouts
CREATE POLICY "Users can view org layouts"
  ON public.proposal_layouts FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create org layouts"
  ON public.proposal_layouts FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org layouts"
  ON public.proposal_layouts FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can delete org layouts"
  ON public.proposal_layouts FOR DELETE
  USING (user_is_org_admin(organization_id));

-- RLS Policies para proposal_layout_pages
CREATE POLICY "Users can view pages of org layouts"
  ON public.proposal_layout_pages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proposal_layouts
      WHERE proposal_layouts.id = proposal_layout_pages.layout_id
      AND proposal_layouts.organization_id = get_user_organization_id()
    )
  );

CREATE POLICY "Users can manage pages of org layouts"
  ON public.proposal_layout_pages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.proposal_layouts
      WHERE proposal_layouts.id = proposal_layout_pages.layout_id
      AND proposal_layouts.organization_id = get_user_organization_id()
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_proposal_layouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_proposal_layouts_updated_at
  BEFORE UPDATE ON public.proposal_layouts
  FOR EACH ROW
  EXECUTE FUNCTION update_proposal_layouts_updated_at();

-- Storage bucket para layouts (será criado via Supabase UI ou SDK)
-- Bucket name: 'proposal-layouts'
-- Public: false
-- Allowed MIME types: application/pdf
-- Max file size: 10MB