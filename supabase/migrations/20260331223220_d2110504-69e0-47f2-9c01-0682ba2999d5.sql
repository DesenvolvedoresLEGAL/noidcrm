
-- Add audience column to loss_reasons
ALTER TABLE public.loss_reasons ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'both';

-- Add audience column to win_reasons
ALTER TABLE public.win_reasons ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'both';

-- Add client_loss_reason_id to opportunities (motivo informado pelo cliente)
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS client_loss_reason_id UUID REFERENCES public.loss_reasons(id);

-- Add requires_seller_classification flag to opportunities
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS requires_seller_classification BOOLEAN NOT NULL DEFAULT false;

-- Add client_reason_id to win_loss_records (motivo do cliente vs reason_id do vendedor)
ALTER TABLE public.win_loss_records ADD COLUMN IF NOT EXISTS client_reason_id UUID;
