
ALTER TABLE public.apollo_query_logs
  ADD COLUMN IF NOT EXISTS raw_response_full jsonb,
  ADD COLUMN IF NOT EXISTS raw_response_compressed text,
  ADD COLUMN IF NOT EXISTS raw_response_size_bytes integer,
  ADD COLUMN IF NOT EXISTS raw_response_compressed_bool boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parser_count integer,
  ADD COLUMN IF NOT EXISTS filter_count integer,
  ADD COLUMN IF NOT EXISTS eliminated_contacts jsonb NOT NULL DEFAULT '[]'::jsonb;
