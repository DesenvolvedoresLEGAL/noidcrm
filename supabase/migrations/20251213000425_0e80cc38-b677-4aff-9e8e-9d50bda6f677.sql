-- Create trigger to auto-add first platform admin based on specific email
-- This is a one-time setup for the initial admin

CREATE OR REPLACE FUNCTION public.check_and_add_platform_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this is the designated platform admin email
  IF NEW.email = 'fala@humanoid-os.ai' THEN
    INSERT INTO public.platform_admins (user_id, role, is_active, notes)
    VALUES (NEW.id, 'super_admin', true, 'Initial platform admin - auto-added on signup')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users for new signups
CREATE OR REPLACE TRIGGER on_auth_user_created_platform_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.check_and_add_platform_admin();