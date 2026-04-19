-- 1) Schema changes for cancellation tracking
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_activities_status_org ON public.activities(organization_id, status) WHERE deleted_at IS NULL;

-- 2) Promote Email Agent from draft to production
UPDATE public.ai_agents
SET environment = 'production',
    updated_at = NOW()
WHERE id = 'b48649bd-534b-4557-845f-3eeef18b0ca0'
  AND environment = 'draft';

-- 3) Backfill: rewrite all "Avançar + Orquestrar" rules to:
--    - keep ONLY the WhatsApp create_activity action
--    - add cancel_pending_activities action (auto-cleanup of orphans)
--    - keep move_stage as-is
WITH rule_actions AS (
  SELECT
    id,
    name,
    actions,
    -- Extract first move_stage action
    (
      SELECT to_jsonb(act)
      FROM jsonb_array_elements(actions) AS act
      WHERE act->>'type' = 'move_stage'
      LIMIT 1
    ) AS move_action,
    -- Extract first WhatsApp/follow_up create_activity action (preferred)
    COALESCE(
      (
        SELECT to_jsonb(act)
        FROM jsonb_array_elements(actions) AS act
        WHERE act->>'type' = 'create_activity'
          AND (act->'config'->>'activity_type' = 'follow_up'
               OR act->'config'->>'title' ILIKE '%whatsapp%')
        LIMIT 1
      ),
      -- Fallback: first create_activity of any type
      (
        SELECT to_jsonb(act)
        FROM jsonb_array_elements(actions) AS act
        WHERE act->>'type' = 'create_activity'
        LIMIT 1
      )
    ) AS whatsapp_action
  FROM public.workflow_rules
  WHERE name ILIKE '%avançar + orquestrar%' OR name ILIKE '%FUP-%'
)
UPDATE public.workflow_rules wr
SET actions = jsonb_build_array(
      ra.move_action,
      jsonb_build_object(
        'type', 'cancel_pending_activities',
        'config', jsonb_build_object(
          'scope', 'previous_stage',
          'exclude_completed_today', true
        )
      ),
      ra.whatsapp_action
    ),
    description = COALESCE(wr.description, '') ||
      E'\n[Auto-migrated 2026-04-19: reduced to 1 activity + auto-cancel orphans]',
    updated_at = NOW()
FROM rule_actions ra
WHERE wr.id = ra.id
  AND ra.move_action IS NOT NULL
  AND ra.whatsapp_action IS NOT NULL;

-- 4) Retroactive cleanup: cancel all overdue (>7 days) pending activities
UPDATE public.activities
SET status = 'cancelled',
    cancelled_at = NOW(),
    cancellation_reason = 'legacy_cleanup_2026_04'
WHERE status = 'pending'
  AND deleted_at IS NULL
  AND scheduled_date < NOW() - INTERVAL '7 days';