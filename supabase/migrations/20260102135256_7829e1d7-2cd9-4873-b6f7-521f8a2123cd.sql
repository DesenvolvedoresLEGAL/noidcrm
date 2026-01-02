-- Create diagnostic_results table
CREATE TABLE public.diagnostic_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  
  -- Lead data
  lead_name TEXT,
  lead_email TEXT,
  lead_whatsapp TEXT,
  lead_company TEXT,
  
  -- Diagnostic data
  answers JSONB NOT NULL,
  area_scores JSONB NOT NULL,
  total_score INTEGER NOT NULL,
  classification TEXT NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create demo_slots table
CREATE TABLE public.demo_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  slot_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  is_available BOOLEAN DEFAULT true,
  assigned_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create scheduled_demos table
CREATE TABLE public.scheduled_demos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  opportunity_id UUID REFERENCES public.opportunities(id),
  
  participant_name TEXT NOT NULL,
  participant_email TEXT NOT NULL,
  participant_whatsapp TEXT,
  participant_company TEXT,
  
  slot_id UUID REFERENCES public.demo_slots(id),
  scheduled_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  demo_type TEXT DEFAULT 'general',
  
  status TEXT DEFAULT 'scheduled',
  confirmation_sent BOOLEAN DEFAULT false,
  reminder_sent BOOLEAN DEFAULT false,
  
  diagnostic_result_id UUID REFERENCES public.diagnostic_results(id),
  source TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add diagnostic columns to opportunities
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS diagnostic_score INTEGER,
ADD COLUMN IF NOT EXISTS diagnostic_classification TEXT;

-- Enable RLS
ALTER TABLE public.diagnostic_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_demos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for diagnostic_results
CREATE POLICY "Org members can view diagnostic results"
  ON public.diagnostic_results FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Service role can insert diagnostic results"
  ON public.diagnostic_results FOR INSERT
  WITH CHECK (true);

-- RLS Policies for demo_slots
CREATE POLICY "Anyone can view available demo slots"
  ON public.demo_slots FOR SELECT
  USING (is_available = true);

CREATE POLICY "Org members can manage demo slots"
  ON public.demo_slots FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- RLS Policies for scheduled_demos
CREATE POLICY "Org members can view scheduled demos"
  ON public.scheduled_demos FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Anyone can schedule demos"
  ON public.scheduled_demos FOR INSERT
  WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_diagnostic_results_opportunity ON public.diagnostic_results(opportunity_id);
CREATE INDEX idx_diagnostic_results_org ON public.diagnostic_results(organization_id);
CREATE INDEX idx_demo_slots_datetime ON public.demo_slots(slot_datetime);
CREATE INDEX idx_scheduled_demos_datetime ON public.scheduled_demos(scheduled_datetime);