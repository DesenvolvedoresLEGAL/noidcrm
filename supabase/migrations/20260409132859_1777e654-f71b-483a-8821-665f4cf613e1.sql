ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS playbook_run_id uuid,
  ADD COLUMN IF NOT EXISTS prospect_id uuid,
  ADD COLUMN IF NOT EXISTS priority_score numeric(6,2),
  ADD COLUMN IF NOT EXISTS source_metadata jsonb DEFAULT '{}'::jsonb;