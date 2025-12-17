-- Billing Subscriptions Table
CREATE TABLE public.billing_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  abacatepay_subscription_id TEXT,
  abacatepay_customer_id TEXT,
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'paused')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  interval TEXT NOT NULL DEFAULT 'month' CHECK (interval IN ('month', 'year')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Billing Invoices Table
CREATE TABLE public.billing_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  abacatepay_invoice_id TEXT,
  abacatepay_payment_id TEXT,
  invoice_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'canceled')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  description TEXT,
  invoice_pdf_url TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Billing Payment Methods Table
CREATE TABLE public.billing_payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  abacatepay_payment_method_id TEXT,
  type TEXT NOT NULL DEFAULT 'card' CHECK (type IN ('card', 'pix', 'boleto')),
  is_default BOOLEAN DEFAULT false,
  card_brand TEXT,
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  billing_name TEXT,
  billing_email TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payment_methods ENABLE ROW LEVEL SECURITY;

-- RLS Policies for billing_subscriptions
CREATE POLICY "Organization members can view subscriptions"
  ON public.billing_subscriptions FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Only admins can manage subscriptions"
  ON public.billing_subscriptions FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND status = 'active' AND org_role IN ('owner', 'admin', 'finance')
    )
  );

-- RLS Policies for billing_invoices
CREATE POLICY "Organization members can view invoices"
  ON public.billing_invoices FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Only admins can manage invoices"
  ON public.billing_invoices FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND status = 'active' AND org_role IN ('owner', 'admin', 'finance')
    )
  );

-- RLS Policies for billing_payment_methods
CREATE POLICY "Organization admins can view payment methods"
  ON public.billing_payment_methods FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND status = 'active' AND org_role IN ('owner', 'admin', 'finance')
  ));

CREATE POLICY "Only admins can manage payment methods"
  ON public.billing_payment_methods FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND status = 'active' AND org_role IN ('owner', 'admin', 'finance')
    )
  );

-- Indexes
CREATE INDEX idx_billing_subscriptions_org ON public.billing_subscriptions(organization_id);
CREATE INDEX idx_billing_subscriptions_status ON public.billing_subscriptions(status);
CREATE INDEX idx_billing_invoices_org ON public.billing_invoices(organization_id);
CREATE INDEX idx_billing_invoices_status ON public.billing_invoices(status);
CREATE INDEX idx_billing_payment_methods_org ON public.billing_payment_methods(organization_id);

-- Updated at triggers
CREATE TRIGGER update_billing_subscriptions_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_billing_invoices_updated_at
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_billing_payment_methods_updated_at
  BEFORE UPDATE ON public.billing_payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();