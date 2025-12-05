-- Add DELETE policies for roleplay tables (admin/owner only)

-- 1. roleplay_messages - Allow org admins to delete
CREATE POLICY "Org admins can delete messages"
ON public.roleplay_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM roleplay_sessions rs
    WHERE rs.id = roleplay_messages.session_id
    AND user_is_org_admin(rs.organization_id)
  )
);

-- 2. roleplay_sessions - Allow org admins to delete
CREATE POLICY "Org admins can delete sessions"
ON public.roleplay_sessions
FOR DELETE
USING (user_is_org_admin(organization_id));

-- 3. performance_insights - Allow org admins to delete
CREATE POLICY "Org admins can delete insights"
ON public.performance_insights
FOR DELETE
USING (user_is_org_admin(organization_id));

-- 4. video_recommendations - Allow org admins to delete
CREATE POLICY "Org admins can delete recommendations"
ON public.video_recommendations
FOR DELETE
USING (user_is_org_admin(organization_id));

-- 5. seller_badges - Allow org admins to delete
CREATE POLICY "Org admins can delete badges"
ON public.seller_badges
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM sellers s
    WHERE s.id = seller_badges.seller_id
    AND user_is_org_admin(s.organization_id)
  )
);