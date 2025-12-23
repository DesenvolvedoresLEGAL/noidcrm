-- Fix function search paths for security
CREATE OR REPLACE FUNCTION public.is_trial_expired(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  trial_end TIMESTAMPTZ;
  org_status TEXT;
BEGIN
  SELECT trial_ends_at, status INTO trial_end, org_status
  FROM public.organizations
  WHERE id = org_id;
  
  IF org_status != 'trial' THEN
    RETURN false;
  END IF;
  
  RETURN trial_end IS NOT NULL AND trial_end < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.block_expired_trial(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.trial_blocks WHERE organization_id = org_id AND unblocked_at IS NULL) THEN
    RETURN false;
  END IF;
  
  INSERT INTO public.trial_blocks (organization_id, reason, grace_period_ends_at, data_deletion_scheduled_at)
  VALUES (
    org_id,
    'trial_expired',
    now() + INTERVAL '7 days',
    now() + INTERVAL '30 days'
  );
  
  UPDATE public.organizations
  SET status = 'blocked'
  WHERE id = org_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.unblock_trial(org_id UUID, by_user_id UUID, reason TEXT DEFAULT 'upgrade')
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.trial_blocks
  SET unblocked_at = now(),
      unblocked_by = by_user_id,
      unblocked_reason = reason
  WHERE organization_id = org_id AND unblocked_at IS NULL;
  
  UPDATE public.organizations
  SET status = 'active'
  WHERE id = org_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
  IF EXISTS (SELECT 1 FROM public.disposable_email_domains WHERE domain = p_email_domain) THEN
    score := score + 40;
  END IF;
  
  SELECT COUNT(*) INTO existing_count FROM public.trial_fingerprints WHERE browser_hash = p_browser_hash;
  IF existing_count > 0 THEN
    score := score + 50;
  END IF;
  
  SELECT COUNT(*) INTO existing_count FROM public.ip_trial_attempts 
  WHERE ip_address = p_ip_address AND attempted_at > now() - INTERVAL '24 hours';
  IF existing_count >= 2 THEN
    score := score + 30;
  END IF;
  
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
  
  RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add RLS policy for ip_trial_attempts (missing)
CREATE POLICY "Service role only for ip_trial_attempts"
  ON public.ip_trial_attempts FOR ALL
  USING (false);