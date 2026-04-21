-- Push delivery queue (Phase 2, incremental)
CREATE TABLE IF NOT EXISTS public.push_delivery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES public.notifications_v2(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text,
  action_url text,
  icon text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  processed_at timestamptz,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_delivery_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users read own push jobs"
    ON public.push_delivery_jobs FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role manage push jobs"
    ON public.push_delivery_jobs FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_push_jobs_status_next_attempt
  ON public.push_delivery_jobs (status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS idx_push_jobs_user_created
  ON public.push_delivery_jobs (user_id, created_at DESC);

DO $$ BEGIN
  CREATE TRIGGER update_push_delivery_jobs_updated_at
    BEFORE UPDATE ON public.push_delivery_jobs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
