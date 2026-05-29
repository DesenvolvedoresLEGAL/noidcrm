-- Sprint C: bump proposal analytics signature to include scoring version v2
CREATE OR REPLACE FUNCTION public.get_proposal_analytics_signature(p_proposal_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signature text;
  v_scoring_version constant text := 'proposal-analytics-score-v2-2026-05';
BEGIN
  SELECT md5(
    concat_ws('|',
      v_scoring_version,
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
      coalesce((SELECT max(i.updated_at)::text FROM public.proposal_items i WHERE i.proposal_id = p.id), ''),
      -- Day-bucket on last view so the signature naturally rotates when recency category changes
      coalesce(date_trunc('day', (SELECT max(v.viewed_at) FROM public.proposal_views v WHERE v.proposal_id = p.id AND v.viewer_type = 'external'))::text, '')
    )
  )
  INTO v_signature
  FROM public.proposals p
  WHERE p.id = p_proposal_id;

  RETURN v_signature;
END;
$$;