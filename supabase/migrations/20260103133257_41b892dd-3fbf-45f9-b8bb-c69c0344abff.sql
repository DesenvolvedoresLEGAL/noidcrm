-- Table to control billing status and non-payment blocks
CREATE TABLE public.organization_billing_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Payment status
  payment_status TEXT NOT NULL DEFAULT 'current' CHECK (payment_status IN ('current', 'pending', 'overdue', 'blocked')),
  
  -- Important dates
  billing_day INTEGER DEFAULT 10 CHECK (billing_day >= 1 AND billing_day <= 28),
  last_payment_date TIMESTAMP WITH TIME ZONE,
  last_payment_amount NUMERIC(12,2),
  next_due_date DATE,
  
  -- Non-payment tracking
  overdue_since DATE,
  days_overdue INTEGER DEFAULT 0,
  amount_due NUMERIC(12,2) DEFAULT 0,
  
  -- Block/unblock tracking
  blocked_at TIMESTAMP WITH TIME ZONE,
  blocked_by UUID,
  block_reason TEXT,
  unblocked_at TIMESTAMP WITH TIME ZONE,
  unblocked_by UUID,
  unblock_reason TEXT,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organization_billing_status ENABLE ROW LEVEL SECURITY;

-- RLS policies - Platform admins can manage
CREATE POLICY "Platform admins can manage billing status" ON public.organization_billing_status
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM platform_admins pa
    WHERE pa.user_id = auth.uid() AND pa.is_active = true
  )
);

-- Org members can view their billing status
CREATE POLICY "Org members can view their billing status" ON public.organization_billing_status
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_billing_status.organization_id
    AND om.user_id = auth.uid()
  )
);

-- Index for quick lookups
CREATE INDEX idx_billing_status_org ON organization_billing_status(organization_id);
CREATE INDEX idx_billing_status_payment ON organization_billing_status(payment_status);
CREATE INDEX idx_billing_status_blocked ON organization_billing_status(blocked_at) WHERE blocked_at IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_billing_status_updated_at
  BEFORE UPDATE ON organization_billing_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Payment history table
CREATE TABLE public.billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT,
  reference TEXT,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Platform admins can manage payments" ON public.billing_payments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM platform_admins pa
    WHERE pa.user_id = auth.uid() AND pa.is_active = true
  )
);

CREATE POLICY "Org members can view their payments" ON public.billing_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = billing_payments.organization_id
    AND om.user_id = auth.uid()
  )
);

-- Index
CREATE INDEX idx_billing_payments_org ON billing_payments(organization_id);
CREATE INDEX idx_billing_payments_date ON billing_payments(payment_date DESC);