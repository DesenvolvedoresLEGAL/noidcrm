
-- Phase 1: Link fala@humanoid-os.ai to Humanoid organization

-- 1. Update profile to set organization_id
UPDATE public.profiles 
SET organization_id = '774d7d78-8257-4891-aac7-718039b80049'
WHERE user_id = '6d3df423-f210-4857-82d5-b068abdce96d';

-- 2. Add as organization member with owner role
INSERT INTO public.organization_members (
  user_id, 
  organization_id, 
  org_role, 
  role, 
  status, 
  joined_at
)
VALUES (
  '6d3df423-f210-4857-82d5-b068abdce96d',
  '774d7d78-8257-4891-aac7-718039b80049',
  'owner',
  'owner',
  'active',
  now()
)
ON CONFLICT (user_id, organization_id) DO UPDATE SET
  org_role = 'owner',
  role = 'owner',
  status = 'active';

-- 3. Mark onboarding as completed
UPDATE public.onboarding_status 
SET completed = true, completed_at = now()
WHERE user_id = '6d3df423-f210-4857-82d5-b068abdce96d';

-- If no onboarding_status exists, create one as completed
INSERT INTO public.onboarding_status (user_id, completed, completed_at, current_step)
SELECT 
  '6d3df423-f210-4857-82d5-b068abdce96d',
  true,
  now(),
  4
WHERE NOT EXISTS (
  SELECT 1 FROM public.onboarding_status 
  WHERE user_id = '6d3df423-f210-4857-82d5-b068abdce96d'
);

-- Phase 2: Update trigger to auto-link future @humanoid-os.ai admins to Humanoid org

CREATE OR REPLACE FUNCTION public.check_and_add_platform_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_humanoid_org_id uuid := '774d7d78-8257-4891-aac7-718039b80049';
BEGIN
  -- Check if this is a humanoid-os.ai email (platform admin)
  IF NEW.email LIKE '%@humanoid-os.ai' THEN
    -- Add to platform_admins
    INSERT INTO public.platform_admins (user_id, role, is_active, notes)
    VALUES (NEW.id, 'super_admin', true, 'Platform admin - auto-added on signup')
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Update profile to link to Humanoid organization
    UPDATE public.profiles 
    SET organization_id = v_humanoid_org_id
    WHERE user_id = NEW.id;
    
    -- Add as organization member with owner role
    INSERT INTO public.organization_members (
      user_id, 
      organization_id, 
      org_role, 
      role, 
      status, 
      joined_at
    )
    VALUES (
      NEW.id,
      v_humanoid_org_id,
      'owner',
      'owner',
      'active',
      now()
    )
    ON CONFLICT (user_id, organization_id) DO UPDATE SET
      org_role = 'owner',
      role = 'owner',
      status = 'active';
    
    -- Mark onboarding as completed (skip onboarding for platform admins)
    INSERT INTO public.onboarding_status (user_id, completed, completed_at, current_step)
    VALUES (NEW.id, true, now(), 4)
    ON CONFLICT (user_id) DO UPDATE SET
      completed = true,
      completed_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;
