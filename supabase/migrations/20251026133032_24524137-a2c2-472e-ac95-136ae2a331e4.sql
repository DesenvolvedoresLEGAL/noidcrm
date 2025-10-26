-- Create onboarding_status table
CREATE TABLE public.onboarding_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  completed BOOLEAN DEFAULT FALSE NOT NULL,
  current_step INTEGER DEFAULT 1 NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.onboarding_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own onboarding status"
  ON public.onboarding_status FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding status"
  ON public.onboarding_status FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding status"
  ON public.onboarding_status FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add new columns to organizations table
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS team_size TEXT,
ADD COLUMN IF NOT EXISTS cnpj TEXT;

-- Modify handle_new_user to only create profile and roles (NO organization)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile WITHOUT organization
  INSERT INTO public.profiles (user_id, full_name, organization_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
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