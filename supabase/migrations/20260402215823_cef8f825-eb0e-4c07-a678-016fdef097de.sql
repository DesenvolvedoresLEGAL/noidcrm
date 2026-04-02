
-- Outbox table for acceptance side effects
CREATE TABLE public.acceptance_effect_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  notifications_processed_at timestamptz,
  slack_processed_at timestamptz,
  attempt_count int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(proposal_id)
);

ALTER TABLE public.acceptance_effect_jobs ENABLE ROW LEVEL SECURITY;

-- No public access - only service role processes these
CREATE POLICY "No public access to acceptance_effect_jobs"
  ON public.acceptance_effect_jobs
  FOR ALL
  USING (false);

CREATE INDEX idx_acceptance_effect_jobs_status ON public.acceptance_effect_jobs(status) WHERE status IN ('pending', 'failed');

-- Trigger function: enqueue job when proposal becomes accepted
CREATE OR REPLACE FUNCTION public.enqueue_acceptance_effect_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM 'accepted') THEN
    INSERT INTO public.acceptance_effect_jobs (proposal_id, organization_id)
    VALUES (NEW.id, NEW.organization_id)
    ON CONFLICT (proposal_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER on_proposal_accepted
  AFTER INSERT OR UPDATE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_acceptance_effect_job();
