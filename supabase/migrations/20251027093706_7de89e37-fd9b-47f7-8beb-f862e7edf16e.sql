-- FASE 1: Fix RLS Policy for sellers table
-- Allow users to create their own seller profile
CREATE POLICY "Users can create own seller profile"
  ON public.sellers FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.organization_id = sellers.organization_id
    )
  );

-- FASE 2: Add roleplay settings to organization settings
-- Insert default training window settings for all organizations
INSERT INTO public.settings (section, key, value, organization_id)
SELECT 
  'roleplay',
  'training_window',
  '{"start": "08:30", "end": "09:00", "timezone": "America/Sao_Paulo"}'::jsonb,
  id
FROM public.organizations
WHERE NOT EXISTS (
  SELECT 1 FROM public.settings 
  WHERE section = 'roleplay' 
  AND key = 'training_window'
  AND organization_id = organizations.id
);

-- Insert default performance gate settings
INSERT INTO public.settings (section, key, value, organization_id)
SELECT 
  'roleplay',
  'performance_gate',
  '{"min_score": 8.0, "window_sessions": 5, "active": true}'::jsonb,
  id
FROM public.organizations
WHERE NOT EXISTS (
  SELECT 1 FROM public.settings 
  WHERE section = 'roleplay' 
  AND key = 'performance_gate'
  AND organization_id = organizations.id
);

-- Insert default ranking settings
INSERT INTO public.settings (section, key, value, organization_id)
SELECT 
  'roleplay',
  'ranking_settings',
  '{"show_public": true, "show_top_only": false, "top_count": 10, "update_period_days": 7}'::jsonb,
  id
FROM public.organizations
WHERE NOT EXISTS (
  SELECT 1 FROM public.settings 
  WHERE section = 'roleplay' 
  AND key = 'ranking_settings'
  AND organization_id = organizations.id
);

-- Update trigger to use dynamic training window from settings
CREATE OR REPLACE FUNCTION public.auto_record_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_training_start time;
  v_training_end time;
  v_session_hour int;
  v_session_minute int;
  v_session_time time;
BEGIN
  IF NEW.started_at IS NOT NULL THEN
    -- Get training window from settings
    SELECT 
      (value->>'start')::time,
      (value->>'end')::time
    INTO v_training_start, v_training_end
    FROM public.settings
    WHERE section = 'roleplay' 
      AND key = 'training_window'
      AND organization_id = NEW.organization_id
    LIMIT 1;
    
    -- Default to 08:30-09:00 if not configured
    v_training_start := COALESCE(v_training_start, '08:30'::time);
    v_training_end := COALESCE(v_training_end, '09:00'::time);
    
    -- Get session time in BRT timezone
    v_session_time := (NEW.started_at AT TIME ZONE 'America/Sao_Paulo')::time;
    
    -- Check if within training window
    IF v_session_time BETWEEN v_training_start AND v_training_end THEN
      INSERT INTO public.attendance (seller_id, date, present, organization_id)
      VALUES (
        NEW.seller_id, 
        (NEW.started_at AT TIME ZONE 'America/Sao_Paulo')::date, 
        true, 
        NEW.organization_id
      )
      ON CONFLICT (seller_id, date) DO UPDATE SET present = true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- FASE 5: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_roleplay_sessions_seller_started 
  ON public.roleplay_sessions(seller_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_roleplay_sessions_org 
  ON public.roleplay_sessions(organization_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_seller_stats_seller_period 
  ON public.seller_stats(seller_id, period);

CREATE INDEX IF NOT EXISTS idx_attendance_seller_date 
  ON public.attendance(seller_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_settings_section_key_org
  ON public.settings(section, key, organization_id);