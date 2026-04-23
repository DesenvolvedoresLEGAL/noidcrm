-- Remove duplicate performance_insights, keeping only the latest per session
DELETE FROM public.performance_insights pi
USING public.performance_insights pi2
WHERE pi.session_id = pi2.session_id
  AND pi.created_at < pi2.created_at;

-- Add unique constraint to prevent future duplicates
ALTER TABLE public.performance_insights
ADD CONSTRAINT performance_insights_session_id_unique UNIQUE (session_id);

-- Same for video_recommendations (currently no dups, but enforce)
DELETE FROM public.video_recommendations vr
USING public.video_recommendations vr2
WHERE vr.session_id = vr2.session_id
  AND vr.created_at < vr2.created_at;

ALTER TABLE public.video_recommendations
ADD CONSTRAINT video_recommendations_session_id_unique UNIQUE (session_id);