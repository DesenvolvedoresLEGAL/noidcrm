
-- Add observability columns to playbook_runs
ALTER TABLE playbook_runs
  ADD COLUMN IF NOT EXISTS error_summary text,
  ADD COLUMN IF NOT EXISTS retry_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS execution_time_ms int;

-- Create run_events table for granular execution logging
CREATE TABLE IF NOT EXISTS run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  playbook_run_id uuid NOT NULL REFERENCES playbook_runs(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE run_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read run_events"
  ON run_events FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org members can insert run_events"
  ON run_events FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_run_events_run_id ON run_events(playbook_run_id);
CREATE INDEX idx_run_events_workspace ON run_events(workspace_id);
