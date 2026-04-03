
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS score_financeiro integer;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS risco_financeiro text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS score_fatores jsonb DEFAULT '{}';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS score_calculado_em timestamptz;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS total_titulos integer DEFAULT 0;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS titulos_pagos integer DEFAULT 0;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS titulos_vencidos integer DEFAULT 0;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS taxa_pagamento_pct integer DEFAULT 0;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS valor_total numeric DEFAULT 0;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS valor_vencido numeric DEFAULT 0;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS erp_sync_at timestamptz;
