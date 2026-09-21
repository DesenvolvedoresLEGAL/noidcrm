CREATE INDEX IF NOT EXISTS idx_score_history_created_at ON public.score_history (created_at);

CREATE OR REPLACE FUNCTION public.prune_score_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.score_history
   WHERE ctid IN (
     SELECT ctid FROM public.score_history
      WHERE created_at < now() - interval '30 days'
      LIMIT 100000
   );
END;
$$;

REVOKE ALL ON FUNCTION public.prune_score_history() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('prune-score-history')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-score-history');

SELECT cron.schedule('prune-score-history', '40 * * * *', $$SELECT public.prune_score_history();$$);