ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS source_label text;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS duplicate_candidate boolean DEFAULT false;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS review_needed boolean DEFAULT false;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS recommended_next_action text;