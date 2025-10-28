-- PLANS TABLE
CREATE TABLE IF NOT EXISTS public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_month_cents integer DEFAULT 0,
  price_year_cents integer DEFAULT 0,
  is_public boolean DEFAULT true,
  visible_in_ui boolean DEFAULT true,
  display_order integer DEFAULT 0,
  features jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- PLAN ENTITLEMENTS
CREATE TABLE IF NOT EXISTS public.plan_entitlements (
  plan_id text REFERENCES public.plans(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  PRIMARY KEY (plan_id, key)
);

-- SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id text REFERENCES public.plans(id),
  status text CHECK (status IN ('trialing','active','past_due','canceled')),
  interval text CHECK (interval IN ('month','year')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  provider_subscription_id text,
  created_at timestamptz DEFAULT now()
);

-- USAGE COUNTERS
CREATE TABLE IF NOT EXISTS public.usage_counters (
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric text NOT NULL,
  period text NOT NULL,
  value integer DEFAULT 0,
  PRIMARY KEY (organization_id, metric, period)
);

-- AUDIT LOG
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id uuid,
  action text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add columns to organizations
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS current_plan_id text REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS is_plan_locked boolean DEFAULT false;

-- RLS Policies
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans are publicly readable" ON public.plans FOR SELECT USING (true);
CREATE POLICY "Entitlements are publicly readable" ON public.plan_entitlements FOR SELECT USING (true);

CREATE POLICY "Users can view org subscriptions" ON public.subscriptions 
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can view org usage" ON public.usage_counters 
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "System can manage usage" ON public.usage_counters 
  FOR ALL USING (true);

CREATE POLICY "Users can view org audit logs" ON public.audit_log 
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "System can insert audit logs" ON public.audit_log 
  FOR INSERT WITH CHECK (true);

-- RPC for idempotent usage increment
CREATE OR REPLACE FUNCTION public.increment_usage(
  p_org_id uuid,
  p_metric text,
  p_period text,
  p_inc int DEFAULT 1
) RETURNS void AS $$
BEGIN
  INSERT INTO public.usage_counters(organization_id, metric, period, value)
  VALUES (p_org_id, p_metric, p_period, p_inc)
  ON CONFLICT (organization_id, metric, period) 
  DO UPDATE SET value = public.usage_counters.value + p_inc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SEED PLANS
INSERT INTO public.plans (id, name, price_month_cents, price_year_cents, is_public, visible_in_ui, display_order, features)
VALUES
  ('free', 'Free', 0, 0, true, true, 1, 
   '["Pipeline básico", "500 contatos", "100 oportunidades", "1 usuário"]'::jsonb),
  ('starter', 'Starter', 6900, 66000, true, true, 2, 
   '["Cadências manuais", "10.000 contatos", "5.000 oportunidades", "10 usuários", "2.000 emails/mês"]'::jsonb),
  ('pro', 'Pro', 18900, 178800, true, true, 3, 
   '["IA e Insights", "BI Avançado", "Cadências automáticas", "Automação completa", "100.000 contatos", "Oportunidades ilimitadas", "Usuários ilimitados", "5.000 emails/mês"]'::jsonb),
  ('enterprise', 'Enterprise', 32900, 0, true, true, 4, 
   '["Tudo do Pro", "Objetos customizados", "SSO/SAML", "API Sandbox", "Contatos ilimitados", "SLA Premium"]'::jsonb),
  ('trial', 'Trial', 0, 0, false, false, 0, '[]'::jsonb),
  ('internal_full', 'Internal Full Access', 0, 0, false, false, 999, 
   '["Acesso completo", "Sem limites", "Modo desenvolvedor"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- FREE ENTITLEMENTS
INSERT INTO public.plan_entitlements(plan_id, key, value) VALUES
('free', 'insights_enabled', 'false'),
('free', 'bi_enabled', 'false'),
('free', 'cadences_mode', 'none'),
('free', 'automations_enabled', 'false'),
('free', 'automations_actions_month', '0'),
('free', 'seats_limit', '1'),
('free', 'pipelines_limit', '1'),
('free', 'contacts_limit', '500'),
('free', 'opportunities_limit', '100'),
('free', 'emails_month', '200')
ON CONFLICT DO NOTHING;

-- STARTER ENTITLEMENTS
INSERT INTO public.plan_entitlements(plan_id, key, value) VALUES
('starter', 'insights_enabled', 'false'),
('starter', 'bi_enabled', 'false'),
('starter', 'cadences_mode', 'manual'),
('starter', 'automations_enabled', 'false'),
('starter', 'automations_actions_month', '0'),
('starter', 'seats_limit', '10'),
('starter', 'pipelines_limit', '999'),
('starter', 'contacts_limit', '10000'),
('starter', 'opportunities_limit', '5000'),
('starter', 'emails_month', '2000')
ON CONFLICT DO NOTHING;

-- PRO ENTITLEMENTS
INSERT INTO public.plan_entitlements(plan_id, key, value) VALUES
('pro', 'insights_enabled', 'true'),
('pro', 'bi_enabled', 'true'),
('pro', 'cadences_mode', 'auto'),
('pro', 'automations_enabled', 'true'),
('pro', 'automations_actions_month', '5000'),
('pro', 'seats_limit', '999'),
('pro', 'pipelines_limit', '999'),
('pro', 'contacts_limit', '100000'),
('pro', 'opportunities_limit', '999999'),
('pro', 'emails_month', '5000')
ON CONFLICT DO NOTHING;

-- ENTERPRISE ENTITLEMENTS
INSERT INTO public.plan_entitlements(plan_id, key, value) VALUES
('enterprise', 'insights_enabled', 'true'),
('enterprise', 'bi_enabled', 'true'),
('enterprise', 'cadences_mode', 'auto'),
('enterprise', 'automations_enabled', 'true'),
('enterprise', 'automations_actions_month', '999999'),
('enterprise', 'seats_limit', '999'),
('enterprise', 'pipelines_limit', '999'),
('enterprise', 'contacts_limit', '999999'),
('enterprise', 'opportunities_limit', '999999'),
('enterprise', 'emails_month', '999999'),
('enterprise', 'objects_custom', 'true'),
('enterprise', 'validation_rules', 'true'),
('enterprise', 'sso_saml', 'true'),
('enterprise', 'audit_log', 'true'),
('enterprise', 'api_sandbox', 'true')
ON CONFLICT DO NOTHING;

-- INTERNAL FULL
INSERT INTO public.plan_entitlements(plan_id, key, value) VALUES
('internal_full', 'insights_enabled', 'true'),
('internal_full', 'bi_enabled', 'true'),
('internal_full', 'cadences_mode', 'auto'),
('internal_full', 'automations_enabled', 'true'),
('internal_full', 'automations_actions_month', '999999'),
('internal_full', 'seats_limit', '999'),
('internal_full', 'pipelines_limit', '999'),
('internal_full', 'contacts_limit', '999999'),
('internal_full', 'opportunities_limit', '999999'),
('internal_full', 'emails_month', '999999'),
('internal_full', 'objects_custom', 'true'),
('internal_full', 'validation_rules', 'true'),
('internal_full', 'sso_saml', 'true'),
('internal_full', 'audit_log', 'true'),
('internal_full', 'api_sandbox', 'true'),
('internal_full', 'price_overwrite_allowed', 'true')
ON CONFLICT DO NOTHING;

-- Migrate existing orgs to plans
UPDATE public.organizations
SET current_plan_id = CASE 
  WHEN status = 'trial' THEN 'trial'
  WHEN status = 'active' THEN 'pro'
  ELSE 'free'
END
WHERE current_plan_id IS NULL;

-- Assign internal_full to LEGAL orgs
UPDATE public.organizations
SET current_plan_id = 'internal_full',
    is_plan_locked = true
WHERE slug IN ('legal', 'operadoralegal', 'operadora-legal', 'operadora-legal-teste', 'legaloperadora')
   OR name ILIKE '%legal%'
   OR name ILIKE '%humanoid%';