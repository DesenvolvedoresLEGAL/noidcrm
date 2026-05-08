
-- 1) proposal_templates: novas colunas
ALTER TABLE public.proposal_templates
  ADD COLUMN IF NOT EXISTS revenue_type text,
  ADD COLUMN IF NOT EXISTS dynamic_pricing_applicability text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS dynamic_pricing_mode text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS validity_strategy text NOT NULL DEFAULT 'fixed_days_from_creation',
  ADD COLUMN IF NOT EXISTS default_validity_days integer,
  ADD COLUMN IF NOT EXISTS requires_valid_until boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_payment_mode text NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS show_dynamic_pricing_on_public_link boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_dynamic_pricing_on_pdf boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_pix_payment boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_complementary_charge boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS template_commercial_rules jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.proposal_templates
    ADD CONSTRAINT proposal_templates_revenue_type_chk CHECK (
      revenue_type IS NULL OR revenue_type IN (
        'one_time_event','one_time_non_event','recurring',
        'short_subscription','subscription_with_commitment','service'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.proposal_templates
    ADD CONSTRAINT proposal_templates_dynamic_pricing_applicability_chk CHECK (
      dynamic_pricing_applicability IN ('automatic','optional','none')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.proposal_templates
    ADD CONSTRAINT proposal_templates_dynamic_pricing_mode_chk CHECK (
      dynamic_pricing_mode IN ('none','automatic_by_valid_until','manual')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.proposal_templates
    ADD CONSTRAINT proposal_templates_validity_strategy_chk CHECK (
      validity_strategy IN ('fixed_days_from_creation','proposal_valid_until','manual','event_start_date')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.proposal_templates
    ADD CONSTRAINT proposal_templates_default_payment_mode_chk CHECK (
      default_payment_mode IN ('one_time','recurring','installment','mixed')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) proposals: espelhar campos
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS revenue_type text,
  ADD COLUMN IF NOT EXISTS dynamic_pricing_applicability text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS validity_strategy text,
  ADD COLUMN IF NOT EXISTS payment_mode text;

DO $$ BEGIN
  ALTER TABLE public.proposals
    ADD CONSTRAINT proposals_revenue_type_chk CHECK (
      revenue_type IS NULL OR revenue_type IN (
        'one_time_event','one_time_non_event','recurring',
        'short_subscription','subscription_with_commitment','service'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.proposals
    ADD CONSTRAINT proposals_dynamic_pricing_applicability_chk CHECK (
      dynamic_pricing_applicability IS NULL OR dynamic_pricing_applicability IN ('automatic','optional','none')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.proposals
    ADD CONSTRAINT proposals_validity_strategy_chk CHECK (
      validity_strategy IS NULL OR validity_strategy IN ('fixed_days_from_creation','proposal_valid_until','manual','event_start_date')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.proposals
    ADD CONSTRAINT proposals_payment_mode_chk CHECK (
      payment_mode IS NULL OR payment_mode IN ('one_time','recurring','installment','mixed')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Atualiza templates "1ª ALUGUE" existentes
UPDATE public.proposal_templates
SET
  revenue_type = 'one_time_event',
  dynamic_pricing_applicability = 'automatic',
  dynamic_pricing_mode = 'automatic_by_valid_until',
  validity_strategy = 'proposal_valid_until',
  requires_valid_until = true,
  allow_recurring = false,
  default_payment_mode = 'one_time',
  show_dynamic_pricing_on_public_link = true,
  show_dynamic_pricing_on_pdf = true,
  allow_pix_payment = true,
  allow_complementary_charge = true
WHERE name ILIKE '1ª ALUGUE' OR name ILIKE '1a ALUGUE';

-- 4) Função de seed dos 3 templates recomendados
CREATE OR REPLACE FUNCTION public.seed_recommended_proposal_templates(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ALUGUE Evento
  INSERT INTO public.proposal_templates (
    organization_id, name, description, currency, validity_days,
    revenue_type, dynamic_pricing_applicability, dynamic_pricing_mode,
    validity_strategy, default_validity_days, requires_valid_until,
    allow_recurring, default_payment_mode,
    show_dynamic_pricing_on_public_link, show_dynamic_pricing_on_pdf,
    allow_pix_payment, allow_complementary_charge
  )
  SELECT
    p_org_id, 'ALUGUE Evento', 'Locação avulsa para evento — tabela dinâmica automática por antecedência',
    'BRL', 15,
    'one_time_event', 'automatic', 'automatic_by_valid_until',
    'proposal_valid_until', 15, true,
    false, 'one_time',
    true, true,
    true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.proposal_templates
    WHERE organization_id = p_org_id AND name = 'ALUGUE Evento'
  );

  -- ASSINATURA Recorrente
  INSERT INTO public.proposal_templates (
    organization_id, name, description, currency, validity_days,
    revenue_type, dynamic_pricing_applicability, dynamic_pricing_mode,
    validity_strategy, default_validity_days, requires_valid_until,
    allow_recurring, default_payment_mode,
    show_dynamic_pricing_on_public_link, show_dynamic_pricing_on_pdf,
    allow_pix_payment, allow_complementary_charge
  )
  SELECT
    p_org_id, 'ASSINATURA Recorrente', 'Receita recorrente — sem tabela dinâmica',
    'BRL', 30,
    'recurring', 'none', 'none',
    'fixed_days_from_creation', 30, false,
    true, 'recurring',
    false, false,
    true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.proposal_templates
    WHERE organization_id = p_org_id AND name = 'ASSINATURA Recorrente'
  );

  -- ASSINATURA Curta Sem Fidelidade
  INSERT INTO public.proposal_templates (
    organization_id, name, description, currency, validity_days,
    revenue_type, dynamic_pricing_applicability, dynamic_pricing_mode,
    validity_strategy, default_validity_days, requires_valid_until,
    allow_recurring, default_payment_mode,
    show_dynamic_pricing_on_public_link, show_dynamic_pricing_on_pdf,
    allow_pix_payment, allow_complementary_charge
  )
  SELECT
    p_org_id, 'ASSINATURA Curta Sem Fidelidade', 'Assinatura curta sem fidelidade — sem tabela dinâmica',
    'BRL', 30,
    'short_subscription', 'none', 'none',
    'fixed_days_from_creation', 30, false,
    true, 'recurring',
    false, false,
    true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.proposal_templates
    WHERE organization_id = p_org_id AND name = 'ASSINATURA Curta Sem Fidelidade'
  );
END;
$$;

-- 5) Backfill em organizações existentes
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_recommended_proposal_templates(r.id);
  END LOOP;
END $$;

-- 6) Trigger para futuras organizações
CREATE OR REPLACE FUNCTION public.trg_seed_recommended_proposal_templates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_recommended_proposal_templates(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_recommended_proposal_templates ON public.organizations;
CREATE TRIGGER trg_seed_recommended_proposal_templates
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.trg_seed_recommended_proposal_templates();
