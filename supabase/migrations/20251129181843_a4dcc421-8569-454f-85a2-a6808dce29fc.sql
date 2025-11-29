-- Add progress tracking fields to roleplay_sessions for improved training quality
ALTER TABLE roleplay_sessions
ADD COLUMN IF NOT EXISTS checkpoints_reached jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS objections_resolved text[] DEFAULT ARRAY[]::text[],
ADD COLUMN IF NOT EXISTS current_phase text DEFAULT 'initial';

COMMENT ON COLUMN roleplay_sessions.checkpoints_reached IS 'List of checkpoints achieved during session (discovery, pain_identified, objection_answered, opening_for_closing)';
COMMENT ON COLUMN roleplay_sessions.objections_resolved IS 'List of objections that were satisfactorily answered by the seller';
COMMENT ON COLUMN roleplay_sessions.current_phase IS 'Current conversation phase: initial, discovery, deepening, closing';

-- Create index for phase queries
CREATE INDEX IF NOT EXISTS idx_roleplay_sessions_phase ON roleplay_sessions(current_phase);