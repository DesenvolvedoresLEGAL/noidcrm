-- Fix: Restrict INSERT on gamification tables to same-organization sellers only

-- 1. seller_badges
DROP POLICY IF EXISTS "System can insert seller badges" ON public.seller_badges;
CREATE POLICY "System can insert seller badges"
ON public.seller_badges
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sellers s
    WHERE s.id = seller_badges.seller_id
      AND s.organization_id = public.get_user_organization_id()
  )
);

-- 2. seller_achievements
DROP POLICY IF EXISTS "System can insert seller achievements" ON public.seller_achievements;
CREATE POLICY "System can insert seller achievements"
ON public.seller_achievements
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sellers s
    WHERE s.id = seller_achievements.seller_id
      AND s.organization_id = public.get_user_organization_id()
  )
);

-- 3. seller_missions
DROP POLICY IF EXISTS "System can insert seller missions" ON public.seller_missions;
CREATE POLICY "System can insert seller missions"
ON public.seller_missions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sellers s
    WHERE s.id = seller_missions.seller_id
      AND s.organization_id = public.get_user_organization_id()
  )
);