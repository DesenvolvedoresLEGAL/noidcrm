-- Fix function search_path for security
-- Update get_team_member_ids function
CREATE OR REPLACE FUNCTION public.get_team_member_ids(_manager_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT tm.user_id),
    ARRAY[]::uuid[]
  )
  FROM teams t
  JOIN team_members tm ON tm.team_id = t.id
  WHERE t.manager_id = _manager_id;
$$;

-- Update get_user_team_ids function
CREATE OR REPLACE FUNCTION public.get_user_team_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT team_id),
    ARRAY[]::uuid[]
  )
  FROM team_members
  WHERE user_id = _user_id;
$$;

-- Update is_team_manager function
CREATE OR REPLACE FUNCTION public.is_team_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM teams
    WHERE manager_id = _user_id
  );
$$;

-- Update can_view_user_data function
CREATE OR REPLACE FUNCTION public.can_view_user_data(_viewer_id uuid, _owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    _viewer_id = _owner_id -- Own data
    OR can_view_all(_viewer_id) -- Admin/Owner
    OR _owner_id = ANY(get_team_member_ids(_viewer_id)); -- Team member
$$;

-- Update get_visible_user_ids function
CREATE OR REPLACE FUNCTION public.get_visible_user_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN can_view_all(_user_id) THEN NULL -- NULL means all users
      WHEN is_team_manager(_user_id) THEN 
        get_team_member_ids(_user_id) || ARRAY[_user_id]::uuid[]
      ELSE ARRAY[_user_id]::uuid[] -- Only own data
    END;
$$;