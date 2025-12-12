-- Adicionar campos de atividades diárias e revenue share em ote_seller_config
ALTER TABLE public.ote_seller_config 
ADD COLUMN IF NOT EXISTS daily_calls_target INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS daily_leads_target INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS daily_proposals_target INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS daily_sales_target INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS daily_revenue_target NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS revenue_share NUMERIC DEFAULT 0.25;

-- Comentários explicativos
COMMENT ON COLUMN public.ote_seller_config.daily_calls_target IS 'Meta diária de ligações';
COMMENT ON COLUMN public.ote_seller_config.daily_leads_target IS 'Meta diária de leads qualificados';
COMMENT ON COLUMN public.ote_seller_config.daily_proposals_target IS 'Meta diária de propostas enviadas';
COMMENT ON COLUMN public.ote_seller_config.daily_sales_target IS 'Meta diária de vendas';
COMMENT ON COLUMN public.ote_seller_config.daily_revenue_target IS 'Meta diária de receita';
COMMENT ON COLUMN public.ote_seller_config.revenue_share IS 'Percentual de comissão sobre vendas';