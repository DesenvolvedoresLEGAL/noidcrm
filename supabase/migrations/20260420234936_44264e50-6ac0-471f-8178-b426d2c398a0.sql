ALTER TABLE public.email_sync_config
  ADD COLUMN IF NOT EXISTS last_sync_error text;