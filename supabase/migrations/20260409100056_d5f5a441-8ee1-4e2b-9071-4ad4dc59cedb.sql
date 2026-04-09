
-- Create lead_searches table
CREATE TABLE public.lead_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  search_type TEXT NOT NULL DEFAULT 'geo',
  icp_id UUID REFERENCES public.icp_profiles(id) ON DELETE SET NULL,
  config JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  results_count INTEGER NOT NULL DEFAULT 0,
  approved_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.lead_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org lead searches"
  ON public.lead_searches FOR SELECT
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can create lead searches"
  ON public.lead_searches FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can update lead searches"
  ON public.lead_searches FOR UPDATE
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- Create lead_search_results table
CREATE TABLE public.lead_search_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  search_id UUID NOT NULL REFERENCES public.lead_searches(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  origin TEXT,
  city TEXT,
  state TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  signals JSONB NOT NULL DEFAULT '{}',
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_search_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org lead results"
  ON public.lead_search_results FOR SELECT
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can create lead results"
  ON public.lead_search_results FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can update lead results"
  ON public.lead_search_results FOR UPDATE
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can delete lead results"
  ON public.lead_search_results FOR DELETE
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- Indexes
CREATE INDEX idx_lead_searches_org ON public.lead_searches(organization_id);
CREATE INDEX idx_lead_searches_status ON public.lead_searches(status);
CREATE INDEX idx_lead_search_results_search ON public.lead_search_results(search_id);
CREATE INDEX idx_lead_search_results_org ON public.lead_search_results(organization_id);
CREATE INDEX idx_lead_search_results_status ON public.lead_search_results(status);
