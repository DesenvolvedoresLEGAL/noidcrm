-- Add viewer_type and viewer_user_id columns to proposal_views
ALTER TABLE proposal_views ADD COLUMN IF NOT EXISTS viewer_type TEXT DEFAULT 'external';
ALTER TABLE proposal_views ADD COLUMN IF NOT EXISTS viewer_user_id UUID REFERENCES auth.users(id);

-- Add comment for documentation
COMMENT ON COLUMN proposal_views.viewer_type IS 'Type of viewer: internal (logged-in seller from same org) or external (client/anonymous)';
COMMENT ON COLUMN proposal_views.viewer_user_id IS 'User ID of the viewer if they were logged in (for internal views)';

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_proposal_views_viewer_type ON proposal_views(proposal_id, viewer_type);

-- Add proposal_viewed to workflow trigger type enum (if using enum)
-- Since workflow_trigger_type is an enum, we need to add the new value
ALTER TYPE workflow_trigger_type ADD VALUE IF NOT EXISTS 'proposal_viewed';