
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS matched_account_id uuid;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS dedupe_status text DEFAULT 'unchecked';
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending';
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS rejected_by uuid;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS rejected_at timestamptz;
