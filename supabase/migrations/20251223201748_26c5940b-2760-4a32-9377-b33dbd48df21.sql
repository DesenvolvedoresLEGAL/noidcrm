-- Criar entitlements para plano Autonomous
INSERT INTO plan_entitlements (plan_id, key, value) VALUES
-- Features herdadas do Neural (todas ativas)
('autonomous', 'ai_enabled', 'true'),
('autonomous', 'advanced_reports', 'true'),
('autonomous', 'sequences_enabled', 'true'),
('autonomous', 'automations_enabled', 'true'),
('autonomous', 'api_access', 'true'),
('autonomous', 'priority_support', 'true'),
-- Limites ilimitados
('autonomous', 'max_users', '999999'),
('autonomous', 'max_accounts', '999999'),
('autonomous', 'max_opportunities', '999999'),
('autonomous', 'max_contacts', '999999'),
('autonomous', 'max_pipelines', '999999'),
-- Features EXCLUSIVAS do Autonomous
('autonomous', 'agents_enabled', 'true'),
('autonomous', 'autonomous_execution', 'true'),
('autonomous', 'memory_engine', 'true'),
('autonomous', 'volts_consumption', 'true'),
('autonomous', 'ai_mode', 'autonomous')
ON CONFLICT (plan_id, key) DO UPDATE SET value = EXCLUDED.value;

-- Atualizar Neural com ai_mode e features exclusivas desabilitadas
INSERT INTO plan_entitlements (plan_id, key, value) VALUES
('neural', 'ai_mode', 'assistive'),
('neural', 'agents_enabled', 'false'),
('neural', 'autonomous_execution', 'false'),
('neural', 'memory_engine', 'false'),
('neural', 'volts_consumption', 'false')
ON CONFLICT (plan_id, key) DO UPDATE SET value = EXCLUDED.value;

-- Criar tabela org_volts_balance para sistema de VOLTS
CREATE TABLE IF NOT EXISTS public.org_volts_balance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  included_volts INTEGER NOT NULL DEFAULT 1000,
  used_volts INTEGER NOT NULL DEFAULT 0,
  extra_volts INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ,
  period_start TIMESTAMPTZ DEFAULT date_trunc('month', now()),
  period_end TIMESTAMPTZ DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.org_volts_balance ENABLE ROW LEVEL SECURITY;

-- Policies para org_volts_balance
CREATE POLICY "Users can view their org volts balance"
ON public.org_volts_balance
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Admins can update their org volts balance"
ON public.org_volts_balance
FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() AND status = 'active' AND org_role IN ('owner', 'admin')
  )
);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION public.update_org_volts_balance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_org_volts_balance_updated_at ON public.org_volts_balance;
CREATE TRIGGER update_org_volts_balance_updated_at
BEFORE UPDATE ON public.org_volts_balance
FOR EACH ROW
EXECUTE FUNCTION public.update_org_volts_balance_updated_at();

-- Function to consume volts
CREATE OR REPLACE FUNCTION public.consume_volts(
  p_org_id UUID,
  p_amount INTEGER,
  p_action_type TEXT DEFAULT 'ai_action'
)
RETURNS JSONB AS $$
DECLARE
  v_balance RECORD;
  v_available INTEGER;
  v_consumed INTEGER;
BEGIN
  -- Get current balance
  SELECT * INTO v_balance FROM org_volts_balance WHERE organization_id = p_org_id FOR UPDATE;
  
  IF v_balance IS NULL THEN
    -- Create initial balance for org
    INSERT INTO org_volts_balance (organization_id, included_volts, used_volts, extra_volts)
    VALUES (p_org_id, 1000, 0, 0)
    RETURNING * INTO v_balance;
  END IF;
  
  -- Calculate available volts
  v_available := (v_balance.included_volts + v_balance.extra_volts) - v_balance.used_volts;
  
  IF v_available < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_volts',
      'available', v_available,
      'requested', p_amount
    );
  END IF;
  
  -- Consume volts
  UPDATE org_volts_balance 
  SET used_volts = used_volts + p_amount
  WHERE organization_id = p_org_id;
  
  v_consumed := v_balance.used_volts + p_amount;
  
  RETURN jsonb_build_object(
    'success', true,
    'consumed', p_amount,
    'used_total', v_consumed,
    'available', v_available - p_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to reset volts monthly
CREATE OR REPLACE FUNCTION public.reset_monthly_volts()
RETURNS void AS $$
BEGIN
  UPDATE org_volts_balance
  SET 
    used_volts = 0,
    period_start = date_trunc('month', now()),
    period_end = date_trunc('month', now()) + interval '1 month',
    reset_at = now()
  WHERE period_end < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;