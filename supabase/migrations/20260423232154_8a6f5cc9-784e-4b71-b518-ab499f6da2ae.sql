ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS pre_sales_user_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_pre_sales_user_id
ON public.accounts(pre_sales_user_id)
WHERE pre_sales_user_id IS NOT NULL;

COMMENT ON COLUMN public.accounts.pre_sales_user_id IS 'Usuário responsável pela pré-venda (SDR/BDR) da conta.';