
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS loss_accountability TEXT;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS is_recoverable TEXT;
ALTER TABLE public.win_loss_records ADD COLUMN IF NOT EXISTS loss_accountability TEXT;
ALTER TABLE public.win_loss_records ADD COLUMN IF NOT EXISTS is_recoverable TEXT;
