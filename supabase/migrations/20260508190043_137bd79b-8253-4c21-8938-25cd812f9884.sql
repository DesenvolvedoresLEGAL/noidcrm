-- ============================================================
-- Sprint INV 1.4 — Inventory Occupancy as Pricing Factor
-- ============================================================

-- 1) Pricing rules table
CREATE TABLE IF NOT EXISTS public.inventory_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES public.inventory_categories(id) ON DELETE CASCADE,
  family_id uuid REFERENCES public.inventory_families(id) ON DELETE CASCADE,
  min_occupancy_rate numeric NOT NULL DEFAULT 0,
  max_occupancy_rate numeric,
  price_adjustment_type text NOT NULL DEFAULT 'percent',
  price_adjustment_value numeric NOT NULL DEFAULT 0,
  max_discount_percent numeric,
  requires_approval boolean NOT NULL DEFAULT false,
  risk_level text NOT NULL DEFAULT 'low',
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_pricing_rules_status_check
    CHECK (status IN ('active', 'inactive')),
  CONSTRAINT inventory_pricing_rules_adjustment_type_check
    CHECK (price_adjustment_type IN ('percent', 'fixed')),
  CONSTRAINT inventory_pricing_rules_risk_level_check
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT inventory_pricing_rules_rate_check
    CHECK (
      min_occupancy_rate >= 0
      AND (max_occupancy_rate IS NULL OR max_occupancy_rate >= min_occupancy_rate)
    )
);

CREATE INDEX IF NOT EXISTS idx_inv_pricing_rules_org_status
  ON public.inventory_pricing_rules (organization_id, status, min_occupancy_rate);
CREATE INDEX IF NOT EXISTS idx_inv_pricing_rules_scope
  ON public.inventory_pricing_rules (organization_id, category_id, family_id);

ALTER TABLE public.inventory_pricing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inv_pricing_rules_select_org" ON public.inventory_pricing_rules;
CREATE POLICY "inv_pricing_rules_select_org"
  ON public.inventory_pricing_rules FOR SELECT
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "inv_pricing_rules_insert_admin" ON public.inventory_pricing_rules;
CREATE POLICY "inv_pricing_rules_insert_admin"
  ON public.inventory_pricing_rules FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'owner'::app_role)
    )
  );

DROP POLICY IF EXISTS "inv_pricing_rules_update_admin" ON public.inventory_pricing_rules;
CREATE POLICY "inv_pricing_rules_update_admin"
  ON public.inventory_pricing_rules FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'owner'::app_role)
    )
  );

DROP POLICY IF EXISTS "inv_pricing_rules_delete_admin" ON public.inventory_pricing_rules;
CREATE POLICY "inv_pricing_rules_delete_admin"
  ON public.inventory_pricing_rules FOR DELETE
  USING (
    organization_id = public.get_user_organization_id()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'owner'::app_role)
    )
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_inv_pricing_rules_updated_at ON public.inventory_pricing_rules;
CREATE TRIGGER trg_inv_pricing_rules_updated_at
  BEFORE UPDATE ON public.inventory_pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Snapshot columns on proposal_items
ALTER TABLE public.proposal_items
  ADD COLUMN IF NOT EXISTS inventory_occupancy_rate numeric,
  ADD COLUMN IF NOT EXISTS inventory_pricing_factor numeric,
  ADD COLUMN IF NOT EXISTS inventory_adjustment_amount numeric,
  ADD COLUMN IF NOT EXISTS inventory_adjusted_unit_price numeric,
  ADD COLUMN IF NOT EXISTS inventory_risk_level text,
  ADD COLUMN IF NOT EXISTS inventory_pricing_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3) Seed function and trigger
CREATE OR REPLACE FUNCTION public.seed_inventory_pricing_rules(p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.inventory_pricing_rules WHERE organization_id = p_org) THEN
    RETURN;
  END IF;

  INSERT INTO public.inventory_pricing_rules
    (organization_id, name, description, min_occupancy_rate, max_occupancy_rate,
     price_adjustment_type, price_adjustment_value, max_discount_percent,
     requires_approval, risk_level, status)
  VALUES
    (p_org, 'Baixa ocupação', 'Estoque livre — sem ajuste comercial.',
     0, 49.99, 'percent', 0, NULL, false, 'low', 'active'),
    (p_org, 'Ocupação moderada', 'Estoque com pressão moderada — ajuste leve e desconto controlado.',
     50, 75, 'percent', 10, 10, false, 'medium', 'active'),
    (p_org, 'Ocupação alta', 'Estoque pressionado — ajuste relevante e aprovação para descontos.',
     75.01, 90, 'percent', 20, 5, true, 'high', 'active'),
    (p_org, 'Ocupação crítica', 'Estoque saturado — ajuste máximo e descontos bloqueados.',
     90.01, NULL, 'percent', 30, 0, true, 'critical', 'active');
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_inventory_pricing_rules(uuid) TO authenticated;

-- backfill all existing organizations
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_inventory_pricing_rules(r.id);
  END LOOP;
END $$;

-- trigger for new organizations
CREATE OR REPLACE FUNCTION public.trg_seed_inventory_pricing_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_inventory_pricing_rules(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organizations_seed_inv_pricing ON public.organizations;
CREATE TRIGGER trg_organizations_seed_inv_pricing
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_inventory_pricing_rules();

-- 4) Pricing factor RPC
CREATE OR REPLACE FUNCTION public.calculate_inventory_pricing_factor(
  p_start_date date,
  p_end_date date,
  p_category_id uuid DEFAULT NULL,
  p_family_id uuid DEFAULT NULL,
  p_requested_quantity numeric DEFAULT 1,
  p_base_amount numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_org uuid := public.get_user_organization_id();
  v_snapshot jsonb;
  v_capacity record;
  v_occupancy numeric := 0;
  v_total numeric := 0;
  v_used numeric := 0;
  v_rule public.inventory_pricing_rules%ROWTYPE;
  v_adjustment numeric := 0;
  v_adjusted_amount numeric := 0;
  v_risk text := 'low';
  v_available numeric := 0;
  v_can_fulfill boolean := true;
  v_message text;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Sem organização ativa';
  END IF;

  -- 1. availability snapshot (already RLS-scoped)
  v_snapshot := public.get_inventory_availability_snapshot(
    p_start_date, p_end_date, p_category_id, p_family_id, p_requested_quantity
  );

  v_available := COALESCE((v_snapshot->>'available_quantity')::numeric, 0);
  v_can_fulfill := COALESCE((v_snapshot->>'can_fulfill')::boolean, true);

  -- 2. aggregate occupancy across the period for the scope
  SELECT
    COALESCE(SUM(c.total_units), 0) AS total_units,
    COALESCE(SUM(
      c.pre_reserved_units + c.reserved_units + c.in_preparation_units +
      c.dispatched_units + c.in_operation_units + c.maintenance_units +
      c.damaged_units + c.lost_units
    ), 0) AS used_units
  INTO v_capacity
  FROM public.get_inventory_capacity_by_period(
    p_start_date, p_end_date, p_category_id, p_family_id
  ) c;

  v_total := COALESCE(v_capacity.total_units, 0);
  v_used := COALESCE(v_capacity.used_units, 0);
  IF v_total > 0 THEN
    v_occupancy := ROUND((v_used / v_total) * 100, 2);
  ELSE
    v_occupancy := 0;
  END IF;

  -- 3. risk tier
  v_risk := CASE
    WHEN v_occupancy < 50 THEN 'low'
    WHEN v_occupancy <= 75 THEN 'medium'
    WHEN v_occupancy <= 90 THEN 'high'
    ELSE 'critical'
  END;

  -- 4. find rule (priority: category+family > category > family > global)
  SELECT * INTO v_rule
  FROM public.inventory_pricing_rules r
  WHERE r.organization_id = v_org
    AND r.status = 'active'
    AND v_occupancy >= r.min_occupancy_rate
    AND (r.max_occupancy_rate IS NULL OR v_occupancy <= r.max_occupancy_rate)
    AND (
      (r.category_id = p_category_id AND r.family_id = p_family_id)
      OR (r.category_id = p_category_id AND r.family_id IS NULL AND p_family_id IS NOT NULL)
      OR (r.family_id = p_family_id AND r.category_id IS NULL AND p_category_id IS NOT NULL)
      OR (r.category_id IS NULL AND r.family_id IS NULL)
    )
  ORDER BY
    CASE
      WHEN r.category_id IS NOT NULL AND r.family_id IS NOT NULL THEN 1
      WHEN r.category_id IS NOT NULL THEN 2
      WHEN r.family_id IS NOT NULL THEN 3
      ELSE 4
    END,
    r.min_occupancy_rate DESC
  LIMIT 1;

  IF v_rule.id IS NOT NULL THEN
    IF v_rule.price_adjustment_type = 'percent' THEN
      v_adjustment := ROUND(COALESCE(p_base_amount, 0) * COALESCE(v_rule.price_adjustment_value, 0) / 100.0, 2);
    ELSE
      v_adjustment := COALESCE(v_rule.price_adjustment_value, 0);
    END IF;
    v_adjusted_amount := ROUND(COALESCE(p_base_amount, 0) + v_adjustment, 2);
  ELSE
    v_adjustment := 0;
    v_adjusted_amount := ROUND(COALESCE(p_base_amount, 0), 2);
  END IF;

  v_message := CASE v_risk
    WHEN 'low' THEN 'Ocupação baixa no período — preço normal.'
    WHEN 'medium' THEN 'Ocupação moderada no período — pequeno ajuste aplicado.'
    WHEN 'high' THEN 'Ocupação alta no período — ajuste relevante e aprovação para descontos.'
    ELSE 'Ocupação crítica no período — ajuste máximo aplicado, descontos bloqueados.'
  END;

  RETURN jsonb_build_object(
    'occupancy_rate', v_occupancy,
    'available_quantity', v_available,
    'requested_quantity', COALESCE(p_requested_quantity, 0),
    'can_fulfill', v_can_fulfill,
    'risk_level', v_risk,
    'pricing_rule_id', v_rule.id,
    'pricing_rule_name', v_rule.name,
    'price_adjustment_type', COALESCE(v_rule.price_adjustment_type, 'percent'),
    'price_adjustment_value', COALESCE(v_rule.price_adjustment_value, 0),
    'adjustment_amount', v_adjustment,
    'base_amount', COALESCE(p_base_amount, 0),
    'adjusted_amount', v_adjusted_amount,
    'max_discount_percent', v_rule.max_discount_percent,
    'requires_approval', COALESCE(v_rule.requires_approval, false),
    'message', v_message,
    'period_start', p_start_date,
    'period_end', p_end_date,
    'computed_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_inventory_pricing_factor(date,date,uuid,uuid,numeric,numeric) TO authenticated;

-- 5) Commercial pressure RPC for overview
CREATE OR REPLACE FUNCTION public.get_inventory_pricing_pressure(
  p_window_days int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_org uuid := public.get_user_organization_id();
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_avg_7 numeric := 0;
  v_avg_30 numeric := 0;
  v_categories_with_factor int := 0;
  v_protected_revenue numeric := 0;
  v_critical_discount_proposals int := 0;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Sem organização ativa';
  END IF;

  -- average occupancy 7d / 30d
  SELECT COALESCE(AVG(occupancy_rate), 0) INTO v_avg_7
  FROM public.get_inventory_capacity_by_period(v_today, v_today + 7, NULL, NULL);

  SELECT COALESCE(AVG(occupancy_rate), 0) INTO v_avg_30
  FROM public.get_inventory_capacity_by_period(v_today, v_today + GREATEST(p_window_days, 1), NULL, NULL);

  -- categories currently in medium/high/critical risk
  SELECT COUNT(DISTINCT category_id) INTO v_categories_with_factor
  FROM public.get_inventory_capacity_by_period(v_today, v_today + GREATEST(p_window_days, 1), NULL, NULL)
  WHERE risk_level IN ('medio', 'alto', 'critico', 'medium', 'high', 'critical');

  -- protected revenue (sum of adjustment over last p_window_days proposals)
  SELECT COALESCE(SUM(pi.inventory_adjustment_amount), 0) INTO v_protected_revenue
  FROM public.proposal_items pi
  JOIN public.proposals p ON p.id = pi.proposal_id
  WHERE pi.organization_id = v_org
    AND COALESCE(pi.inventory_adjustment_amount, 0) > 0
    AND p.deleted_at IS NULL
    AND p.created_at >= (now() - (GREATEST(p_window_days, 1) || ' days')::interval);

  -- proposals with discount under critical occupancy
  SELECT COUNT(DISTINCT pi.proposal_id) INTO v_critical_discount_proposals
  FROM public.proposal_items pi
  JOIN public.proposals p ON p.id = pi.proposal_id
  WHERE pi.organization_id = v_org
    AND pi.inventory_risk_level = 'critical'
    AND COALESCE(pi.discount_percent, 0) > 0
    AND p.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'avg_occupancy_next_7_days', ROUND(v_avg_7, 2),
    'avg_occupancy_window_days', ROUND(v_avg_30, 2),
    'window_days', p_window_days,
    'categories_with_factor', v_categories_with_factor,
    'protected_revenue', ROUND(v_protected_revenue, 2),
    'proposals_with_critical_discount', v_critical_discount_proposals,
    'computed_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_inventory_pricing_pressure(int) TO authenticated;