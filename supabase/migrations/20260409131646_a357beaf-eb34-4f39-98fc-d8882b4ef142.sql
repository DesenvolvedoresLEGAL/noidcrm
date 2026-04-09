ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS event_name text,
  ADD COLUMN IF NOT EXISTS event_url text,
  ADD COLUMN IF NOT EXISTS exhibitor_profile_url text,
  ADD COLUMN IF NOT EXISTS booth text;