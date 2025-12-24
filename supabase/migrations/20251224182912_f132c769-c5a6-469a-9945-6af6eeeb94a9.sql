-- RLS para seat_events - org members podem ver seus próprios eventos
DROP POLICY IF EXISTS "Organizations can view their own seat events" ON public.seat_events;
CREATE POLICY "Organizations can view their own seat events"
  ON public.seat_events FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() AND pa.is_active = true
    )
  );