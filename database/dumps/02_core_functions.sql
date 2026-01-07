-- ============================================================
-- NOID REVENUE OS - DATABASE DUMP
-- File: 02_core_functions.sql
-- Generated: 2026-01-07
-- Description: Essential RLS helper functions
-- ============================================================

-- ==========================================
-- 1. get_user_organization_id()
-- Returns the organization_id of the current user
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT organization_id 
  FROM public.organization_members 
  WHERE user_id = auth.uid() 
    AND status = 'active' 
  LIMIT 1;
$function$;

-- ==========================================
-- 2. user_is_org_member(org_id)
-- Checks if user is member of given organization
-- ==========================================
CREATE OR REPLACE FUNCTION public.user_is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_members 
    WHERE user_id = auth.uid() 
      AND organization_id = org_id 
      AND status = 'active'
  );
$function$;

-- ==========================================
-- 3. user_is_org_admin(org_id)
-- Checks if user is admin/owner of given organization
-- ==========================================
CREATE OR REPLACE FUNCTION public.user_is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_members 
    WHERE user_id = auth.uid() 
      AND organization_id = org_id 
      AND status = 'active'
      AND org_role IN ('owner', 'admin')
  );
$function$;

-- ==========================================
-- 4. can_view_all(user_id)
-- Checks if user has admin/manager/owner role
-- ==========================================
CREATE OR REPLACE FUNCTION public.can_view_all(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_members 
    WHERE user_id = p_user_id 
      AND status = 'active'
      AND org_role IN ('owner', 'admin', 'manager')
  );
$function$;

-- ==========================================
-- 5. is_platform_admin(user_id)
-- Checks if user is platform super admin
-- ==========================================
CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.platform_admins 
    WHERE user_id = p_user_id 
      AND is_active = true
  );
$function$;

-- ==========================================
-- 6. is_platform_admin_for_rls(user_id)
-- RLS-safe version of is_platform_admin
-- ==========================================
CREATE OR REPLACE FUNCTION public.is_platform_admin_for_rls(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.platform_admins 
    WHERE user_id = p_user_id 
      AND is_active = true
  );
$function$;

-- ==========================================
-- 7. is_team_manager(user_id)
-- Checks if user manages a team
-- ==========================================
CREATE OR REPLACE FUNCTION public.is_team_manager(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.teams 
    WHERE manager_user_id = p_user_id
  );
$function$;

-- ==========================================
-- 8. get_team_member_ids(manager_user_id)
-- Returns array of user_ids managed by given user
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_team_member_ids(p_manager_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    array_agg(DISTINCT tm.user_id),
    ARRAY[]::uuid[]
  )
  FROM public.teams t
  JOIN public.team_members tm ON tm.team_id = t.id
  WHERE t.manager_user_id = p_manager_user_id;
$function$;

-- ==========================================
-- 9. calculate_lead_grade(fit_score, intent_score)
-- Calculates A/B/C/D grade based on scores
-- ==========================================
CREATE OR REPLACE FUNCTION public.calculate_lead_grade(fit_score integer, intent_score integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  total_score integer;
BEGIN
  total_score := COALESCE(fit_score, 0) + COALESCE(intent_score, 0);
  
  IF total_score >= 160 THEN
    RETURN 'A';
  ELSIF total_score >= 120 THEN
    RETURN 'B';
  ELSIF total_score >= 80 THEN
    RETURN 'C';
  ELSE
    RETURN 'D';
  END IF;
END;
$function$;

-- ==========================================
-- 10. update_updated_at_column()
-- Trigger function to auto-update updated_at
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
