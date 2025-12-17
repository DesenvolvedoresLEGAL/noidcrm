-- Add memories_extracted column to track which win_loss_records have been processed
ALTER TABLE public.win_loss_records 
ADD COLUMN IF NOT EXISTS memories_extracted BOOLEAN DEFAULT FALSE;

-- Add index for efficient querying of pending extractions
CREATE INDEX IF NOT EXISTS idx_win_loss_records_memories_pending 
ON public.win_loss_records (organization_id, memories_extracted) 
WHERE memories_extracted = false;