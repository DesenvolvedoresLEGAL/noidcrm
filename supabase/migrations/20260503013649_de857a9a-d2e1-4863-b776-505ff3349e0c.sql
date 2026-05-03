
-- =========================================================
-- Proposal Analytics AI Insights Cache
-- =========================================================

CREATE TABLE IF NOT EXISTS public.proposal_ai_insights_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  opportunity_id uuid NOT NULL,
  proposal_id uuid NOT NULL,
  analytics_signature text NOT NULL,
  insights_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  engagement_score numeric,
  engagement_level text,
  close_probability numeric,
  risk_level text,
  recommended_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  smart_alerts jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_summary text,
  model_used text,
  tokens_input integer DEFAULT 0,
  tokens_output integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposal_ai_insights_cache_proposal_unique UNIQUE (proposal_id)
);

CREATE INDEX IF NOT EXISTS idx_proposal_ai_insights_cache_org
  ON public.proposal_ai_insights_cache(organization_id);
CREATE INDEX IF NOT EXISTS idx_proposal_ai_insights_cache_opportunity
  ON public.proposal_ai_insights_cache(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_proposal_ai_insights_cache_signature
  ON public.proposal_ai_insights_cache(analytics_signature);

DROP TRIGGER IF EXISTS trg_proposal_ai_insights_cache_updated_at
  ON public.proposal_ai_insights_cache;
CREATE TRIGGER trg_proposal_ai_insights_cache_updated_at
  BEFORE UPDATE ON public.proposal_ai_insights_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.proposal_ai_insights_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_insights_cache_select" ON public.proposal_ai_insights_cache;
CREATE POLICY "ai_insights_cache_select"
  ON public.proposal_ai_insights_cache
  FOR SELECT
  TO authenticated
  USING (public.user_is_org_member(organization_id));

DROP POLICY IF EXISTS "ai_insights_cache_insert" ON public.proposal_ai_insights_cache;
CREATE POLICY "ai_insights_cache_insert"
  ON public.proposal_ai_insights_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_is_org_member(organization_id));

DROP POLICY IF EXISTS "ai_insights_cache_update" ON public.proposal_ai_insights_cache;
CREATE POLICY "ai_insights_cache_update"
  ON public.proposal_ai_insights_cache
  FOR UPDATE
  TO authenticated
  USING (public.user_is_org_member(organization_id))
  WITH CHECK (public.user_is_org_member(organization_id));

-- =========================================================
-- Signature function
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_proposal_analytics_signature(p_proposal_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signature text;
BEGIN
  SELECT md5(
    concat_ws('|',
      coalesce(p.id::text, ''),
      coalesce(p.opportunity_id::text, ''),
      coalesce(p.organization_id::text, ''),
      coalesce(p.status::text, ''),
      coalesce(round(coalesce(p.total_amount, 0)::numeric, 2)::text, ''),
      coalesce(round(coalesce(p.value, 0)::numeric, 2)::text, ''),
      coalesce(round(coalesce(p.subtotal, 0)::numeric, 2)::text, ''),
      coalesce(round(coalesce(p.discount_amount, 0)::numeric, 2)::text, ''),
      coalesce(p.expires_at::text, ''),
      coalesce(p.updated_at::text, ''),
      coalesce(p.signature_status::text, ''),
      coalesce(p.deleted_at::text, ''),
      coalesce((SELECT count(*) FROM public.proposal_views v WHERE v.proposal_id = p.id AND v.viewer_type = 'external')::text, '0'),
      coalesce((SELECT count(DISTINCT v.viewer_ip) FROM public.proposal_views v WHERE v.proposal_id = p.id AND v.viewer_type = 'external')::text, '0'),
      coalesce((SELECT count(DISTINCT v.viewer_user_id) FROM public.proposal_views v WHERE v.proposal_id = p.id AND v.viewer_type = 'external')::text, '0'),
      coalesce((SELECT round(coalesce(sum(v.duration_seconds), 0)::numeric, 0)::text FROM public.proposal_views v WHERE v.proposal_id = p.id AND v.viewer_type = 'external'), '0'),
      coalesce((SELECT round(coalesce(avg(v.duration_seconds), 0)::numeric, 0)::text FROM public.proposal_views v WHERE v.proposal_id = p.id AND v.viewer_type = 'external'), '0'),
      coalesce((SELECT max(v.viewed_at)::text FROM public.proposal_views v WHERE v.proposal_id = p.id AND v.viewer_type = 'external'), ''),
      coalesce((SELECT max(v.scroll_depth_percent)::text FROM public.proposal_views v WHERE v.proposal_id = p.id AND v.viewer_type = 'external'), '0'),
      coalesce((SELECT bool_or(v.is_forwarded)::text FROM public.proposal_views v WHERE v.proposal_id = p.id AND v.viewer_type = 'external'), 'false'),
      coalesce((SELECT count(*) FROM public.proposal_view_events e WHERE e.proposal_id = p.id)::text, '0'),
      coalesce((SELECT count(*) FROM public.proposal_items i WHERE i.proposal_id = p.id)::text, '0'),
      coalesce((SELECT max(i.updated_at)::text FROM public.proposal_items i WHERE i.proposal_id = p.id), '')
    )
  )
  INTO v_signature
  FROM public.proposals p
  WHERE p.id = p_proposal_id;

  RETURN v_signature;
END;
$$;

-- =========================================================
-- Get cache (with current vs cached signature)
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_proposal_ai_insights_cache(p_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current text;
  v_row public.proposal_ai_insights_cache%ROWTYPE;
BEGIN
  v_current := public.get_proposal_analytics_signature(p_proposal_id);

  SELECT * INTO v_row
  FROM public.proposal_ai_insights_cache
  WHERE proposal_id = p_proposal_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_cache', false,
      'is_valid', false,
      'current_signature', v_current,
      'cached_signature', null,
      'generated_at', null,
      'insights_payload', null
    );
  END IF;

  RETURN jsonb_build_object(
    'has_cache', true,
    'is_valid', (v_row.analytics_signature = v_current),
    'current_signature', v_current,
    'cached_signature', v_row.analytics_signature,
    'generated_at', v_row.generated_at,
    'insights_payload', v_row.insights_payload,
    'engagement_score', v_row.engagement_score,
    'engagement_level', v_row.engagement_level,
    'close_probability', v_row.close_probability,
    'risk_level', v_row.risk_level,
    'recommended_actions', v_row.recommended_actions,
    'smart_alerts', v_row.smart_alerts,
    'generated_summary', v_row.generated_summary,
    'model_used', v_row.model_used
  );
END;
$$;

-- =========================================================
-- Upsert
-- =========================================================

CREATE OR REPLACE FUNCTION public.upsert_proposal_ai_insights_cache(
  p_organization_id uuid,
  p_opportunity_id uuid,
  p_proposal_id uuid,
  p_analytics_signature text,
  p_insights_payload jsonb,
  p_engagement_score numeric DEFAULT NULL,
  p_engagement_level text DEFAULT NULL,
  p_close_probability numeric DEFAULT NULL,
  p_risk_level text DEFAULT NULL,
  p_recommended_actions jsonb DEFAULT '[]'::jsonb,
  p_smart_alerts jsonb DEFAULT '[]'::jsonb,
  p_generated_summary text DEFAULT NULL,
  p_model_used text DEFAULT NULL,
  p_tokens_input integer DEFAULT 0,
  p_tokens_output integer DEFAULT 0,
  p_total_tokens integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.proposal_ai_insights_cache (
    organization_id, opportunity_id, proposal_id, analytics_signature,
    insights_payload, engagement_score, engagement_level, close_probability,
    risk_level, recommended_actions, smart_alerts, generated_summary,
    model_used, tokens_input, tokens_output, total_tokens, generated_at
  ) VALUES (
    p_organization_id, p_opportunity_id, p_proposal_id, p_analytics_signature,
    coalesce(p_insights_payload, '{}'::jsonb), p_engagement_score, p_engagement_level, p_close_probability,
    p_risk_level, coalesce(p_recommended_actions, '[]'::jsonb), coalesce(p_smart_alerts, '[]'::jsonb),
    p_generated_summary, p_model_used, coalesce(p_tokens_input, 0),
    coalesce(p_tokens_output, 0), coalesce(p_total_tokens, 0), now()
  )
  ON CONFLICT (proposal_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    opportunity_id = EXCLUDED.opportunity_id,
    analytics_signature = EXCLUDED.analytics_signature,
    insights_payload = EXCLUDED.insights_payload,
    engagement_score = EXCLUDED.engagement_score,
    engagement_level = EXCLUDED.engagement_level,
    close_probability = EXCLUDED.close_probability,
    risk_level = EXCLUDED.risk_level,
    recommended_actions = EXCLUDED.recommended_actions,
    smart_alerts = EXCLUDED.smart_alerts,
    generated_summary = EXCLUDED.generated_summary,
    model_used = EXCLUDED.model_used,
    tokens_input = EXCLUDED.tokens_input,
    tokens_output = EXCLUDED.tokens_output,
    total_tokens = EXCLUDED.total_tokens,
    generated_at = now(),
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_proposal_analytics_signature(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_proposal_ai_insights_cache(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_proposal_ai_insights_cache(uuid, uuid, uuid, text, jsonb, numeric, text, numeric, text, jsonb, jsonb, text, text, integer, integer, integer) TO authenticated, service_role;
