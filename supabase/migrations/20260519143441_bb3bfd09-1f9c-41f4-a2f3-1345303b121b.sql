
-- Dispensa notificações v2 de virada de tabela dinâmica que foram disparadas
-- indevidamente para propostas cujo deal não está mais no funil de vendas
-- ativo (foi para Operacional/Onboarding/Renewal ou já está won/lost).
UPDATE public.notifications_v2 n
SET dismissed_at = now(),
    read_at = COALESCE(n.read_at, now()),
    status = 'dismissed'
FROM public.notification_events e
LEFT JOIN public.opportunities o ON o.id = e.opportunity_id
LEFT JOIN public.pipelines pl ON pl.id = o.pipeline_id
WHERE n.event_id = e.id
  AND e.event_type LIKE 'proposal_pricing_tier_transition_%'
  AND n.dismissed_at IS NULL
  AND (
    o.id IS NULL
    OR o.deleted_at IS NOT NULL
    OR (o.status IS NOT NULL AND o.status NOT IN ('new','in_progress','open'))
    OR (pl.pipeline_type IS NOT NULL AND pl.pipeline_type <> 'sales')
  );
