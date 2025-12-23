-- =====================================================
-- PHASE 2 & 3: Trial Blocking + Anti-Fraud System
-- =====================================================

-- 1. Trial Blocks Table - Track blocked organizations
CREATE TABLE public.trial_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT DEFAULT 'trial_expired',
  grace_period_ends_at TIMESTAMPTZ, -- 7 days grace before data deletion
  data_deletion_scheduled_at TIMESTAMPTZ,
  unblocked_at TIMESTAMPTZ,
  unblocked_by UUID REFERENCES auth.users(id),
  unblocked_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);

-- 2. Trial Fingerprints Table - Anti-fraud detection
CREATE TABLE public.trial_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Device Fingerprint
  browser_hash TEXT NOT NULL,
  device_type TEXT,
  screen_resolution TEXT,
  timezone TEXT,
  language TEXT,
  canvas_hash TEXT,
  
  -- Network Info
  ip_address INET,
  ip_country TEXT,
  ip_city TEXT,
  ip_is_vpn BOOLEAN DEFAULT false,
  ip_is_datacenter BOOLEAN DEFAULT false,
  ip_is_tor BOOLEAN DEFAULT false,
  
  -- Email Risk
  email_domain TEXT,
  email_is_disposable BOOLEAN DEFAULT false,
  email_is_free_provider BOOLEAN DEFAULT false,
  email_domain_age_days INTEGER,
  
  -- Document Hashes (never store raw documents)
  cpf_hash TEXT,
  cnpj_hash TEXT,
  phone_hash TEXT,
  phone_verified BOOLEAN DEFAULT false,
  
  -- Risk Assessment
  fraud_score INTEGER DEFAULT 0 CHECK (fraud_score >= 0 AND fraud_score <= 100),
  risk_flags JSONB DEFAULT '[]'::jsonb,
  risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'blocked')),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent same device from multiple trials
  CONSTRAINT unique_browser_hash UNIQUE (browser_hash)
);

-- 3. Disposable Email Domains Table
CREATE TABLE public.disposable_email_domains (
  domain TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ DEFAULT now(),
  source TEXT DEFAULT 'manual'
);

-- Insert common disposable email domains
INSERT INTO public.disposable_email_domains (domain, source) VALUES
  ('mailinator.com', 'seed'),
  ('tempmail.com', 'seed'),
  ('guerrillamail.com', 'seed'),
  ('throwaway.email', 'seed'),
  ('temp-mail.org', 'seed'),
  ('fakeinbox.com', 'seed'),
  ('getnada.com', 'seed'),
  ('10minutemail.com', 'seed'),
  ('yopmail.com', 'seed'),
  ('trashmail.com', 'seed'),
  ('mohmal.com', 'seed'),
  ('dispostable.com', 'seed'),
  ('mailnesia.com', 'seed'),
  ('sharklasers.com', 'seed'),
  ('spamgourmet.com', 'seed'),
  ('maildrop.cc', 'seed'),
  ('getairmail.com', 'seed'),
  ('mytemp.email', 'seed'),
  ('tempail.com', 'seed'),
  ('burnermail.io', 'seed')
ON CONFLICT DO NOTHING;

-- 4. Trial Notifications Table - Progressive alerts
CREATE TABLE public.trial_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('day_7', 'day_5', 'day_3', 'day_1', 'expired', 'blocked')),
  channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'sms', 'push')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  clicked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent duplicate notifications
  UNIQUE(organization_id, notification_type, channel)
);

-- 5. IP Trial Attempts Table - Rate limiting by IP
CREATE TABLE public.ip_trial_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email_domain TEXT,
  was_blocked BOOLEAN DEFAULT false,
  block_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for IP lookups
CREATE INDEX idx_ip_trial_attempts_ip ON public.ip_trial_attempts(ip_address);
CREATE INDEX idx_ip_trial_attempts_time ON public.ip_trial_attempts(attempted_at);

-- 6. Enable RLS on all new tables
ALTER TABLE public.trial_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disposable_email_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_trial_attempts ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for trial_blocks
CREATE POLICY "Users can view their org trial blocks"
  ON public.trial_blocks FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- 8. RLS Policies for trial_fingerprints (only service role can insert/update)
CREATE POLICY "Users can view their own fingerprint"
  ON public.trial_fingerprints FOR SELECT
  USING (user_id = auth.uid());

-- 9. RLS Policies for disposable_email_domains (public read)
CREATE POLICY "Anyone can read disposable domains"
  ON public.disposable_email_domains FOR SELECT
  USING (true);

-- 10. RLS Policies for trial_notifications
CREATE POLICY "Users can view their org notifications"
  ON public.trial_notifications FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- 11. Function to check if trial is expired
CREATE OR REPLACE FUNCTION public.is_trial_expired(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  trial_end TIMESTAMPTZ;
  org_status TEXT;
BEGIN
  SELECT trial_ends_at, status INTO trial_end, org_status
  FROM public.organizations
  WHERE id = org_id;
  
  -- If not in trial, not expired
  IF org_status != 'trial' THEN
    RETURN false;
  END IF;
  
  -- Check if trial has ended
  RETURN trial_end IS NOT NULL AND trial_end < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Function to block expired trial
CREATE OR REPLACE FUNCTION public.block_expired_trial(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if already blocked
  IF EXISTS (SELECT 1 FROM public.trial_blocks WHERE organization_id = org_id AND unblocked_at IS NULL) THEN
    RETURN false;
  END IF;
  
  -- Insert block record
  INSERT INTO public.trial_blocks (organization_id, reason, grace_period_ends_at, data_deletion_scheduled_at)
  VALUES (
    org_id,
    'trial_expired',
    now() + INTERVAL '7 days',
    now() + INTERVAL '30 days'
  );
  
  -- Update organization status
  UPDATE public.organizations
  SET status = 'blocked'
  WHERE id = org_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Function to unblock trial (after upgrade)
CREATE OR REPLACE FUNCTION public.unblock_trial(org_id UUID, by_user_id UUID, reason TEXT DEFAULT 'upgrade')
RETURNS BOOLEAN AS $$
BEGIN
  -- Update block record
  UPDATE public.trial_blocks
  SET unblocked_at = now(),
      unblocked_by = by_user_id,
      unblocked_reason = reason
  WHERE organization_id = org_id AND unblocked_at IS NULL;
  
  -- Update organization status
  UPDATE public.organizations
  SET status = 'active'
  WHERE id = org_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Function to calculate fraud score
CREATE OR REPLACE FUNCTION public.calculate_fraud_score(
  p_email_domain TEXT,
  p_browser_hash TEXT,
  p_ip_address INET,
  p_cpf_hash TEXT DEFAULT NULL,
  p_cnpj_hash TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  existing_count INTEGER;
BEGIN
  -- Check disposable email (+40)
  IF EXISTS (SELECT 1 FROM public.disposable_email_domains WHERE domain = p_email_domain) THEN
    score := score + 40;
  END IF;
  
  -- Check if browser hash already exists (+50)
  SELECT COUNT(*) INTO existing_count FROM public.trial_fingerprints WHERE browser_hash = p_browser_hash;
  IF existing_count > 0 THEN
    score := score + 50;
  END IF;
  
  -- Check if IP has too many recent attempts (+30)
  SELECT COUNT(*) INTO existing_count FROM public.ip_trial_attempts 
  WHERE ip_address = p_ip_address AND attempted_at > now() - INTERVAL '24 hours';
  IF existing_count >= 2 THEN
    score := score + 30;
  END IF;
  
  -- Check if CPF/CNPJ already used (+60)
  IF p_cpf_hash IS NOT NULL THEN
    SELECT COUNT(*) INTO existing_count FROM public.trial_fingerprints WHERE cpf_hash = p_cpf_hash;
    IF existing_count > 0 THEN
      score := score + 60;
    END IF;
  END IF;
  
  IF p_cnpj_hash IS NOT NULL THEN
    SELECT COUNT(*) INTO existing_count FROM public.trial_fingerprints WHERE cnpj_hash = p_cnpj_hash;
    IF existing_count > 0 THEN
      score := score + 60;
    END IF;
  END IF;
  
  -- Cap at 100
  RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Create indexes for performance
CREATE INDEX idx_trial_blocks_org ON public.trial_blocks(organization_id);
CREATE INDEX idx_trial_blocks_blocked_at ON public.trial_blocks(blocked_at);
CREATE INDEX idx_trial_fingerprints_browser ON public.trial_fingerprints(browser_hash);
CREATE INDEX idx_trial_fingerprints_user ON public.trial_fingerprints(user_id);
CREATE INDEX idx_trial_fingerprints_email ON public.trial_fingerprints(email_domain);
CREATE INDEX idx_trial_notifications_org ON public.trial_notifications(organization_id);