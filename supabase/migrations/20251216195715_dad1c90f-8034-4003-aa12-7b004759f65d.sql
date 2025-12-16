-- Add customer acceptance fields to win_loss_records
ALTER TABLE public.win_loss_records
ADD COLUMN IF NOT EXISTS recorded_by_customer boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS acceptor_name text,
ADD COLUMN IF NOT EXISTS acceptor_document text,
ADD COLUMN IF NOT EXISTS acceptor_position text;

-- Add comment explaining the fields
COMMENT ON COLUMN public.win_loss_records.recorded_by_customer IS 'True if feedback was provided directly by the customer during proposal acceptance';
COMMENT ON COLUMN public.win_loss_records.acceptor_name IS 'Name of the person who accepted the proposal';
COMMENT ON COLUMN public.win_loss_records.acceptor_document IS 'CPF/CNPJ of the person who accepted';
COMMENT ON COLUMN public.win_loss_records.acceptor_position IS 'Position/role of the person who accepted';