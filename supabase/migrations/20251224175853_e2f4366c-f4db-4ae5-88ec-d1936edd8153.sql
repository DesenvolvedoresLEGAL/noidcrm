-- =============================================================================
-- PER-SEAT BILLING ENGINE - Complete Infrastructure
-- =============================================================================

-- 1. Add billing fields to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS active_seats INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS calculated_mrr DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS calculated_arr DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS last_mrr_calculated_at TIMESTAMPTZ;

-- 2. Create seat_events table for tracking all seat changes
CREATE TABLE IF NOT EXISTS public.seat_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('seat_added', 'seat_removed', 'plan_upgrade', 'plan_downgrade', 'reactivation')),
  
  -- State before/after
  previous_seats INTEGER NOT NULL DEFAULT 0,
  new_seats INTEGER NOT NULL DEFAULT 0,
  previous_plan_id TEXT,
  new_plan_id TEXT,
  
  -- Financial impact
  previous_mrr DECIMAL(12,2) NOT NULL DEFAULT 0,
  new_mrr DECIMAL(12,2) NOT NULL DEFAULT 0,
  delta_mrr DECIMAL(12,2) NOT NULL DEFAULT 0,
  price_per_seat DECIMAL(12,2) NOT NULL DEFAULT 0,
  
  -- Attribution
  user_id UUID,
  triggered_by UUID,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  effective_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on seat_events
ALTER TABLE public.seat_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for seat_events (admin only can view all, org members can view their own org)
CREATE POLICY "Users can view their own org seat events" ON public.seat_events
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage seat events" ON public.seat_events
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 3. Create org_billing_snapshots for monthly billing history
CREATE TABLE IF NOT EXISTS public.org_billing_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  
  -- Snapshot data
  plan_id TEXT NOT NULL,
  active_seats INTEGER NOT NULL DEFAULT 0,
  price_per_seat DECIMAL(12,2) NOT NULL DEFAULT 0,
  mrr DECIMAL(12,2) NOT NULL DEFAULT 0,
  arr DECIMAL(12,2) NOT NULL DEFAULT 0,
  
  -- Movement tracking (vs previous period)
  expansion_mrr DECIMAL(12,2) DEFAULT 0,
  contraction_mrr DECIMAL(12,2) DEFAULT 0,
  upgrade_mrr DECIMAL(12,2) DEFAULT 0,
  downgrade_mrr DECIMAL(12,2) DEFAULT 0,
  net_mrr_change DECIMAL(12,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(organization_id, period)
);

-- Enable RLS on org_billing_snapshots
ALTER TABLE public.org_billing_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own org snapshots" ON public.org_billing_snapshots
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage billing snapshots" ON public.org_billing_snapshots
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 4. Create function to recalculate org MRR
CREATE OR REPLACE FUNCTION public.recalculate_org_mrr(org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id TEXT;
  v_price_per_seat DECIMAL(12,2);
  v_active_seats INTEGER;
  v_mrr DECIMAL(12,2);
  v_arr DECIMAL(12,2);
  v_result JSONB;
BEGIN
  -- Get org's current plan
  SELECT current_plan_id INTO v_plan_id 
  FROM organizations 
  WHERE id = org_id;
  
  -- Handle internal_full and freemium plans (no billing)
  IF v_plan_id IN ('internal_full', 'freemium') OR v_plan_id IS NULL THEN
    UPDATE organizations SET
      active_seats = (SELECT COUNT(*) FROM organization_members WHERE organization_id = org_id AND status = 'active'),
      calculated_mrr = 0,
      calculated_arr = 0,
      last_mrr_calculated_at = now()
    WHERE id = org_id;
    
    SELECT jsonb_build_object(
      'plan_id', v_plan_id,
      'price_per_seat', 0,
      'active_seats', (SELECT COUNT(*) FROM organization_members WHERE organization_id = org_id AND status = 'active'),
      'mrr', 0,
      'arr', 0
    ) INTO v_result;
    
    RETURN v_result;
  END IF;
  
  -- Get plan price (per seat per month in cents, convert to BRL)
  SELECT COALESCE(price_month_cents, 0) / 100.0 INTO v_price_per_seat 
  FROM plans 
  WHERE id = v_plan_id;
  
  IF v_price_per_seat IS NULL THEN
    v_price_per_seat := 0;
  END IF;
  
  -- Count active members
  SELECT COUNT(*) INTO v_active_seats
  FROM organization_members
  WHERE organization_id = org_id AND status = 'active';
  
  -- Calculate MRR/ARR: price_per_seat × active_seats
  v_mrr := v_price_per_seat * v_active_seats;
  v_arr := v_mrr * 12;
  
  -- Update organization
  UPDATE organizations SET
    active_seats = v_active_seats,
    calculated_mrr = v_mrr,
    calculated_arr = v_arr,
    last_mrr_calculated_at = now()
  WHERE id = org_id;
  
  -- Build result
  SELECT jsonb_build_object(
    'plan_id', v_plan_id,
    'price_per_seat', v_price_per_seat,
    'active_seats', v_active_seats,
    'mrr', v_mrr,
    'arr', v_arr
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- 5. Create trigger function to handle seat changes
CREATE OR REPLACE FUNCTION public.handle_seat_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_prev_seats INTEGER;
  v_new_seats INTEGER;
  v_prev_mrr DECIMAL(12,2);
  v_new_mrr DECIMAL(12,2);
  v_price_per_seat DECIMAL(12,2);
  v_plan_id TEXT;
  v_event_type TEXT;
  v_reason TEXT;
  v_user_id UUID;
BEGIN
  -- Determine org_id based on operation
  v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  
  -- Skip if org_id is null
  IF v_org_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Get current state BEFORE recalculation
  SELECT 
    COALESCE(active_seats, 0),
    COALESCE(calculated_mrr, 0),
    current_plan_id
  INTO v_prev_seats, v_prev_mrr, v_plan_id
  FROM organizations 
  WHERE id = v_org_id;
  
  -- Get price per seat
  SELECT COALESCE(price_month_cents, 0) / 100.0 INTO v_price_per_seat
  FROM plans 
  WHERE id = v_plan_id;
  
  IF v_price_per_seat IS NULL THEN
    v_price_per_seat := 0;
  END IF;
  
  -- Recalculate MRR (this updates the org)
  PERFORM recalculate_org_mrr(v_org_id);
  
  -- Get new state AFTER recalculation
  SELECT 
    COALESCE(active_seats, 0),
    COALESCE(calculated_mrr, 0)
  INTO v_new_seats, v_new_mrr
  FROM organizations 
  WHERE id = v_org_id;
  
  -- Determine event type and reason based on operation and status changes
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'seat_added';
    v_reason := 'member_added';
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'seat_removed';
    v_reason := 'member_removed';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check status changes
    IF OLD.status = 'active' AND NEW.status IN ('suspended', 'inactive') THEN
      v_event_type := 'seat_removed';
      v_reason := 'member_suspended';
    ELSIF OLD.status IN ('suspended', 'inactive') AND NEW.status = 'active' THEN
      v_event_type := 'reactivation';
      v_reason := 'member_reactivated';
    ELSE
      -- No billing-relevant change
      RETURN NEW;
    END IF;
  END IF;
  
  -- Only log if there's an actual seat/MRR change
  IF v_prev_seats != v_new_seats OR v_prev_mrr != v_new_mrr THEN
    INSERT INTO seat_events (
      organization_id,
      event_type,
      previous_seats,
      new_seats,
      previous_plan_id,
      new_plan_id,
      previous_mrr,
      new_mrr,
      delta_mrr,
      price_per_seat,
      user_id,
      reason,
      metadata
    ) VALUES (
      v_org_id,
      v_event_type,
      v_prev_seats,
      v_new_seats,
      v_plan_id,
      v_plan_id,
      v_prev_mrr,
      v_new_mrr,
      v_new_mrr - v_prev_mrr,
      v_price_per_seat,
      v_user_id,
      v_reason,
      jsonb_build_object(
        'trigger_operation', TG_OP,
        'old_status', CASE WHEN TG_OP != 'INSERT' THEN OLD.status ELSE NULL END,
        'new_status', CASE WHEN TG_OP != 'DELETE' THEN NEW.status ELSE NULL END
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 6. Create trigger on organization_members
DROP TRIGGER IF EXISTS trg_organization_member_seat_change ON public.organization_members;
CREATE TRIGGER trg_organization_member_seat_change
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_seat_change();

-- 7. Create function to get seat metrics for an org
CREATE OR REPLACE FUNCTION public.get_org_seat_metrics(org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_plan_id TEXT;
  v_price_per_seat DECIMAL(12,2);
  v_active_seats INTEGER;
  v_mrr DECIMAL(12,2);
  v_max_users INTEGER;
  v_expansion_mrr DECIMAL(12,2);
  v_contraction_mrr DECIMAL(12,2);
BEGIN
  -- Get org data
  SELECT 
    current_plan_id,
    COALESCE(active_seats, 0),
    COALESCE(calculated_mrr, 0),
    max_users
  INTO v_plan_id, v_active_seats, v_mrr, v_max_users
  FROM organizations 
  WHERE id = org_id;
  
  -- Get price per seat
  SELECT COALESCE(price_month_cents, 0) / 100.0 INTO v_price_per_seat
  FROM plans WHERE id = v_plan_id;
  
  -- Calculate expansion/contraction this month
  SELECT 
    COALESCE(SUM(CASE WHEN delta_mrr > 0 THEN delta_mrr ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN delta_mrr < 0 THEN ABS(delta_mrr) ELSE 0 END), 0)
  INTO v_expansion_mrr, v_contraction_mrr
  FROM seat_events
  WHERE organization_id = org_id
    AND created_at >= date_trunc('month', CURRENT_DATE);
  
  SELECT jsonb_build_object(
    'plan_id', v_plan_id,
    'price_per_seat', COALESCE(v_price_per_seat, 0),
    'active_seats', v_active_seats,
    'max_users', v_max_users,
    'mrr', v_mrr,
    'arr', v_mrr * 12,
    'expansion_mrr_this_month', v_expansion_mrr,
    'contraction_mrr_this_month', v_contraction_mrr,
    'net_mrr_change_this_month', v_expansion_mrr - v_contraction_mrr,
    'seats_usage_percent', CASE WHEN v_max_users > 0 THEN ROUND((v_active_seats::DECIMAL / v_max_users) * 100, 1) ELSE NULL END
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- 8. Create function to get global seat metrics (for admin)
CREATE OR REPLACE FUNCTION public.get_global_seat_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_total_mrr DECIMAL(12,2);
  v_total_arr DECIMAL(12,2);
  v_total_seats INTEGER;
  v_paying_orgs INTEGER;
  v_avg_seats_per_org DECIMAL(10,2);
  v_revenue_per_seat DECIMAL(12,2);
  v_expansion_mrr DECIMAL(12,2);
  v_contraction_mrr DECIMAL(12,2);
BEGIN
  -- Get totals from paying organizations
  SELECT 
    COALESCE(SUM(calculated_mrr), 0),
    COALESCE(SUM(calculated_arr), 0),
    COALESCE(SUM(active_seats), 0),
    COUNT(*)
  INTO v_total_mrr, v_total_arr, v_total_seats, v_paying_orgs
  FROM organizations
  WHERE status = 'active'
    AND current_plan_id NOT IN ('internal_full', 'freemium')
    AND current_plan_id IS NOT NULL;
  
  -- Calculate averages
  v_avg_seats_per_org := CASE WHEN v_paying_orgs > 0 THEN v_total_seats::DECIMAL / v_paying_orgs ELSE 0 END;
  v_revenue_per_seat := CASE WHEN v_total_seats > 0 THEN v_total_mrr / v_total_seats ELSE 0 END;
  
  -- Get expansion/contraction this month
  SELECT 
    COALESCE(SUM(CASE WHEN delta_mrr > 0 THEN delta_mrr ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN delta_mrr < 0 THEN ABS(delta_mrr) ELSE 0 END), 0)
  INTO v_expansion_mrr, v_contraction_mrr
  FROM seat_events
  WHERE created_at >= date_trunc('month', CURRENT_DATE);
  
  SELECT jsonb_build_object(
    'total_mrr', v_total_mrr,
    'total_arr', v_total_arr,
    'total_seats', v_total_seats,
    'paying_orgs', v_paying_orgs,
    'avg_seats_per_org', ROUND(v_avg_seats_per_org, 1),
    'revenue_per_seat', ROUND(v_revenue_per_seat, 2),
    'expansion_mrr', v_expansion_mrr,
    'contraction_mrr', v_contraction_mrr,
    'net_mrr_change', v_expansion_mrr - v_contraction_mrr,
    'nrr_percent', CASE 
      WHEN v_total_mrr > 0 THEN 
        ROUND(((v_total_mrr + v_expansion_mrr - v_contraction_mrr) / v_total_mrr) * 100, 1)
      ELSE 100 
    END
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- 9. Initialize existing organizations with calculated MRR
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT id FROM organizations WHERE current_plan_id IS NOT NULL LOOP
    PERFORM recalculate_org_mrr(org_record.id);
  END LOOP;
END $$;

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_seat_events_org_id ON public.seat_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_seat_events_created_at ON public.seat_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seat_events_event_type ON public.seat_events(event_type);
CREATE INDEX IF NOT EXISTS idx_org_billing_snapshots_org_period ON public.org_billing_snapshots(organization_id, period);
CREATE INDEX IF NOT EXISTS idx_organizations_calculated_mrr ON public.organizations(calculated_mrr) WHERE calculated_mrr > 0;

-- Add realtime for seat_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.seat_events;