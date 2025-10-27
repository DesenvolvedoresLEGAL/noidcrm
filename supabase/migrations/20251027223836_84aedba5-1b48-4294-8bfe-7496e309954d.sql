-- Fix security issues identified in security scan

-- 1. DROP overly permissive sequences policy (allows any authenticated user to read ALL sequences)
DROP POLICY IF EXISTS "Users can view sequences" ON sequences;

-- 2. Fix automation_logs policies to restrict access to opportunity owner
DROP POLICY IF EXISTS "Users can view org automation logs" ON automation_logs;

CREATE POLICY "Users can view their own automation logs"
  ON automation_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM opportunities
    WHERE opportunities.id = automation_logs.opportunity_id
      AND opportunities.owner_user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all org automation logs"
  ON automation_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM opportunities
    WHERE opportunities.id = automation_logs.opportunity_id
      AND user_is_org_admin(opportunities.organization_id)
  ));

CREATE POLICY "Admins can manage automation logs"
  ON automation_logs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM opportunities o
    WHERE o.id = automation_logs.opportunity_id
      AND user_is_org_admin(o.organization_id)
  ));

-- 3. Fix handle_new_user function to sanitize input from raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
BEGIN
  -- Sanitize and validate user metadata (limit to 100 chars, no special chars)
  v_full_name := COALESCE(
    regexp_replace(
      substring(NEW.raw_user_meta_data->>'full_name', 1, 100),
      '[<>\"'';]',
      '',
      'g'
    ),
    split_part(NEW.email, '@', 1)
  );
  
  -- Create profile WITHOUT organization
  INSERT INTO public.profiles (user_id, full_name, organization_id)
  VALUES (
    NEW.id,
    v_full_name,
    NULL  -- No organization yet
  );
  
  -- Create admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');
  
  -- Create onboarding status
  INSERT INTO public.onboarding_status (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;