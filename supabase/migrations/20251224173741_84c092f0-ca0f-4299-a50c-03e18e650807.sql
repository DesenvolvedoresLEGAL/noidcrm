-- Table to track SLG (Sales Led Growth) conversions
-- This enables separate tracking of PLG vs SLG revenue and metrics
CREATE TABLE public.slg_conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  plg_opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  
  -- Revenue tracking
  mrr_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  arr_value DECIMAL(12,2) GENERATED ALWAYS AS (mrr_value * 12) STORED,
  total_contract_value DECIMAL(12,2),
  
  -- Sales attribution
  sales_user_id UUID,
  pipeline_id TEXT REFERENCES public.pipelines(id) ON DELETE SET NULL,
  
  -- Conversion metadata
  converted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provisioned_at TIMESTAMPTZ,
  onboarding_completed_at TIMESTAMPTZ,
  
  -- Client credentials (encrypted reference)
  client_email TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent duplicate conversions for same proposal
  CONSTRAINT unique_proposal_conversion UNIQUE (proposal_id)
);

-- Create index for efficient querying
CREATE INDEX idx_slg_conversions_organization_id ON public.slg_conversions(organization_id);
CREATE INDEX idx_slg_conversions_converted_at ON public.slg_conversions(converted_at);
CREATE INDEX idx_slg_conversions_sales_user_id ON public.slg_conversions(sales_user_id);

-- Enable RLS
ALTER TABLE public.slg_conversions ENABLE ROW LEVEL SECURITY;

-- RLS policies - admin only (this is internal sales tracking data)
CREATE POLICY "Platform admins can view all SLG conversions"
  ON public.slg_conversions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM platform_admins 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage SLG conversions"
  ON public.slg_conversions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_slg_conversions_updated_at
  BEFORE UPDATE ON public.slg_conversions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE public.slg_conversions IS 'Tracks Sales Led Growth (SLG) conversions from proposal acceptance to organization provisioning';