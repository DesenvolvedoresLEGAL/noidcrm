-- =============================================================================
-- SECURITY FIX: Proposals System Vulnerabilities
-- Issues: PUBLIC_PROPOSAL_DATA, PUBLIC_PROPOSAL_ITEMS, PUBLIC_PAYMENT_TERMS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ISSUE 1: PUBLIC_PROPOSAL_DATA - Add time-based expiration to public access
-- -----------------------------------------------------------------------------

-- Drop existing public access policy
DROP POLICY IF EXISTS "Public proposals are viewable via token" ON public.proposals;
DROP POLICY IF EXISTS "Public proposals are viewable via token with expiration" ON public.proposals;

-- Create new policy with expiration logic
CREATE POLICY "Public proposals are viewable via token with expiration"
ON public.proposals
FOR SELECT
USING (
  public_token IS NOT NULL 
  AND (
    -- Active proposals: 30 days from creation
    (status NOT IN ('accepted', 'rejected') AND created_at > NOW() - INTERVAL '30 days')
    OR
    -- Accepted/Rejected proposals: 90 days from last update
    (status IN ('accepted', 'rejected') AND updated_at > NOW() - INTERVAL '90 days')
  )
);

-- -----------------------------------------------------------------------------
-- ISSUE 2: PUBLIC_PROPOSAL_ITEMS - Create public-safe VIEW
-- -----------------------------------------------------------------------------

-- Drop existing view first to recreate
DROP VIEW IF EXISTS public.proposal_items_public;

-- Create public-safe view excluding sensitive cost data
CREATE VIEW public.proposal_items_public AS
SELECT 
  pi.id,
  pi.proposal_id,
  pi.product_id,
  pi.name,
  pi.description,
  pi.quantity,
  pi.unit_price,
  pi.discount_percent,
  pi.total,
  pi.order_index,
  pi.created_at
FROM public.proposal_items pi
INNER JOIN public.proposals p ON pi.proposal_id = p.id
WHERE 
  p.public_token IS NOT NULL
  AND (
    (p.status NOT IN ('accepted', 'rejected') AND p.created_at > NOW() - INTERVAL '30 days')
    OR
    (p.status IN ('accepted', 'rejected') AND p.updated_at > NOW() - INTERVAL '90 days')
  );

-- Grant SELECT on the public view
GRANT SELECT ON public.proposal_items_public TO anon;
GRANT SELECT ON public.proposal_items_public TO authenticated;

-- Update RLS on proposal_items to restrict direct access
DROP POLICY IF EXISTS "Public can view proposal items via token" ON public.proposal_items;

-- Ensure only authenticated users in same org can access directly
DROP POLICY IF EXISTS "Users can view proposal items in their organization" ON public.proposal_items;
CREATE POLICY "Users can view proposal items in their organization"
ON public.proposal_items
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM public.organization_members om 
    WHERE om.user_id = auth.uid()
  )
);

-- -----------------------------------------------------------------------------
-- ISSUE 3: PUBLIC_PAYMENT_TERMS - Restrict access with expiration
-- -----------------------------------------------------------------------------

-- Drop existing public access policy if exists
DROP POLICY IF EXISTS "Public can view payment terms via token" ON public.proposal_payment_terms;
DROP POLICY IF EXISTS "Anyone can view payment terms for public proposals" ON public.proposal_payment_terms;

-- Create policy for authenticated users in same organization
DROP POLICY IF EXISTS "Users can view payment terms in their organization" ON public.proposal_payment_terms;
CREATE POLICY "Users can view payment terms in their organization"
ON public.proposal_payment_terms
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM public.organization_members om 
    WHERE om.user_id = auth.uid()
  )
);

-- Drop existing view first to recreate
DROP VIEW IF EXISTS public.proposal_payment_terms_public;

-- Create public-safe view for payment terms
CREATE VIEW public.proposal_payment_terms_public AS
SELECT 
  ppt.id,
  ppt.proposal_id,
  ppt.payment_type,
  ppt.payment_method,
  ppt.installments,
  ppt.first_installment_date,
  ppt.installment_interval_days,
  ppt.due_day,
  ppt.first_payment_date,
  ppt.contract_start_date,
  ppt.contract_duration_months,
  ppt.billing_day,
  ppt.auto_renewal,
  ppt.created_at
FROM public.proposal_payment_terms ppt
INNER JOIN public.proposals p ON ppt.proposal_id = p.id
WHERE 
  p.public_token IS NOT NULL
  AND (
    (p.status NOT IN ('accepted', 'rejected') AND p.created_at > NOW() - INTERVAL '30 days')
    OR
    (p.status IN ('accepted', 'rejected') AND p.updated_at > NOW() - INTERVAL '90 days')
  );

-- Grant SELECT on the public view
GRANT SELECT ON public.proposal_payment_terms_public TO anon;
GRANT SELECT ON public.proposal_payment_terms_public TO authenticated;

-- -----------------------------------------------------------------------------
-- AUDIT LOGGING: Track public proposal views
-- -----------------------------------------------------------------------------

-- Create audit logging table
CREATE TABLE IF NOT EXISTS public.proposal_view_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  referer TEXT,
  viewer_user_id UUID,
  is_public_view BOOLEAN NOT NULL DEFAULT true,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_proposal_view_logs_proposal_id ON public.proposal_view_logs(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_view_logs_viewed_at ON public.proposal_view_logs(viewed_at);
CREATE INDEX IF NOT EXISTS idx_proposal_view_logs_organization_id ON public.proposal_view_logs(organization_id);

-- Enable RLS
ALTER TABLE public.proposal_view_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for view logs
DROP POLICY IF EXISTS "Users can view logs in their organization" ON public.proposal_view_logs;
CREATE POLICY "Users can view logs in their organization"
ON public.proposal_view_logs
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM public.organization_members om 
    WHERE om.user_id = auth.uid()
  )
);

-- Allow inserts from anyone (for logging public views)
DROP POLICY IF EXISTS "Anyone can insert view logs" ON public.proposal_view_logs;
CREATE POLICY "Anyone can insert view logs"
ON public.proposal_view_logs
FOR INSERT
WITH CHECK (true);

-- Create function to log proposal views
CREATE OR REPLACE FUNCTION public.log_proposal_view(
  p_proposal_id UUID,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referer TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_org_id UUID;
  v_viewer_id UUID;
BEGIN
  -- Get organization_id from proposal
  SELECT organization_id INTO v_org_id
  FROM public.proposals
  WHERE id = p_proposal_id;
  
  -- Get current user if authenticated
  v_viewer_id := auth.uid();
  
  -- Insert log entry
  INSERT INTO public.proposal_view_logs (
    proposal_id,
    ip_address,
    user_agent,
    referer,
    viewer_user_id,
    is_public_view,
    organization_id
  )
  VALUES (
    p_proposal_id,
    p_ip_address::INET,
    p_user_agent,
    p_referer,
    v_viewer_id,
    v_viewer_id IS NULL,
    v_org_id
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.log_proposal_view TO anon;
GRANT EXECUTE ON FUNCTION public.log_proposal_view TO authenticated;