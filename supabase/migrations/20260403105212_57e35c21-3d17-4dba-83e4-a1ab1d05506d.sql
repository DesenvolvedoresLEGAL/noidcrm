
-- Add new columns for email reply sync
ALTER TABLE public.opportunity_emails
ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'outbound',
ADD COLUMN IF NOT EXISTS gmail_message_id text,
ADD COLUMN IF NOT EXISTS gmail_thread_id text,
ADD COLUMN IF NOT EXISTS in_reply_to uuid REFERENCES public.opportunity_emails(id);

-- Add constraint for direction values
ALTER TABLE public.opportunity_emails
ADD CONSTRAINT opportunity_emails_direction_check CHECK (direction IN ('inbound', 'outbound'));

-- Index for deduplication on gmail_message_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunity_emails_gmail_message_id 
ON public.opportunity_emails(gmail_message_id) WHERE gmail_message_id IS NOT NULL;

-- Index for thread lookups
CREATE INDEX IF NOT EXISTS idx_opportunity_emails_gmail_thread_id 
ON public.opportunity_emails(gmail_thread_id) WHERE gmail_thread_id IS NOT NULL;

-- Index for reply chain
CREATE INDEX IF NOT EXISTS idx_opportunity_emails_in_reply_to 
ON public.opportunity_emails(in_reply_to) WHERE in_reply_to IS NOT NULL;

-- Enable realtime for opportunity_emails if not already
ALTER PUBLICATION supabase_realtime ADD TABLE public.opportunity_emails;
