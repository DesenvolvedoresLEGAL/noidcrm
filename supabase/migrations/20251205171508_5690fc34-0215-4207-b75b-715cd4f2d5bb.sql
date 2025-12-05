
-- 1. Create function to check if user is admin OR manager (using correct org_role column)
CREATE OR REPLACE FUNCTION public.user_is_org_admin_or_manager(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = _org_id
      AND org_role IN ('owner', 'admin', 'manager')
      AND status = 'active'
  )
$$;

-- 2. Fix original user_is_org_admin to use correct column (org_role instead of role)
CREATE OR REPLACE FUNCTION public.user_is_org_admin(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = _org_id
      AND org_role IN ('owner', 'admin')
      AND status = 'active'
  )
$$;

-- 3. Update ORIGINS policies
DROP POLICY IF EXISTS "Admins can manage origins" ON public.origins;
DROP POLICY IF EXISTS "Admins and managers can insert origins" ON public.origins;
DROP POLICY IF EXISTS "Admins and managers can update origins" ON public.origins;
DROP POLICY IF EXISTS "Admins and managers can delete origins" ON public.origins;

CREATE POLICY "Admins and managers can insert origins"
ON public.origins FOR INSERT
WITH CHECK (user_is_org_admin_or_manager(organization_id));

CREATE POLICY "Admins and managers can update origins"
ON public.origins FOR UPDATE
USING (user_is_org_admin_or_manager(organization_id));

CREATE POLICY "Admins and managers can delete origins"
ON public.origins FOR DELETE
USING (user_is_org_admin_or_manager(organization_id));

-- 4. Update ORIGIN_GROUPS policies
DROP POLICY IF EXISTS "Admins can manage origin groups" ON public.origin_groups;
DROP POLICY IF EXISTS "Admins and managers can insert origin groups" ON public.origin_groups;
DROP POLICY IF EXISTS "Admins and managers can update origin groups" ON public.origin_groups;
DROP POLICY IF EXISTS "Admins and managers can delete origin groups" ON public.origin_groups;

CREATE POLICY "Admins and managers can insert origin groups"
ON public.origin_groups FOR INSERT
WITH CHECK (user_is_org_admin_or_manager(organization_id));

CREATE POLICY "Admins and managers can update origin groups"
ON public.origin_groups FOR UPDATE
USING (user_is_org_admin_or_manager(organization_id));

CREATE POLICY "Admins and managers can delete origin groups"
ON public.origin_groups FOR DELETE
USING (user_is_org_admin_or_manager(organization_id));

-- 5. Update PRODUCTS policies
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Admins and managers can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins and managers can update products" ON public.products;
DROP POLICY IF EXISTS "Admins and managers can delete products" ON public.products;

CREATE POLICY "Admins and managers can insert products"
ON public.products FOR INSERT
WITH CHECK (user_is_org_admin_or_manager(organization_id));

CREATE POLICY "Admins and managers can update products"
ON public.products FOR UPDATE
USING (user_is_org_admin_or_manager(organization_id));

CREATE POLICY "Admins and managers can delete products"
ON public.products FOR DELETE
USING (user_is_org_admin_or_manager(organization_id));

-- 6. Update OPPORTUNITIES UPDATE policy (allow managers to edit any opportunity)
DROP POLICY IF EXISTS "Users can update opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can update own opportunities" ON public.opportunities;

CREATE POLICY "Users can update opportunities"
ON public.opportunities FOR UPDATE
USING (
  organization_id = get_user_organization_id() 
  AND (
    owner_user_id = auth.uid()
    OR user_is_org_admin_or_manager(organization_id)
  )
);
