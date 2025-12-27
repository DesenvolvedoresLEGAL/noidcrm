-- View para MRR por account_id (evita duplicação de propostas Sales + CS)
-- Esta view é uma referência canônica para cálculo de MRR em toda a plataforma

CREATE OR REPLACE VIEW public.v_mrr_by_account AS
WITH sales_pipelines AS (
  SELECT id, organization_id
  FROM public.pipelines
  WHERE pipeline_type = 'sales'
),
won_sales_opportunities AS (
  SELECT o.id, o.account_id, o.organization_id
  FROM public.opportunities o
  INNER JOIN sales_pipelines sp ON o.pipeline_id = sp.id
  WHERE o.status = 'won'
    AND o.account_id IS NOT NULL
),
accepted_proposals AS (
  SELECT p.id, p.opportunity_id, p.organization_id
  FROM public.proposals p
  INNER JOIN won_sales_opportunities wso ON p.opportunity_id = wso.id
  WHERE p.status = 'accepted'
),
recurring_terms AS (
  SELECT 
    ap.opportunity_id,
    ap.organization_id,
    COALESCE(SUM(ppt.monthly_value), 0) as mrr_value
  FROM accepted_proposals ap
  INNER JOIN public.proposal_payment_terms ppt ON ppt.proposal_id = ap.id
  WHERE ppt.payment_type IN ('recurring', 'monthly', 'subscription')
  GROUP BY ap.opportunity_id, ap.organization_id
),
mrr_with_account AS (
  SELECT 
    wso.account_id,
    wso.organization_id,
    rt.mrr_value
  FROM recurring_terms rt
  INNER JOIN won_sales_opportunities wso ON rt.opportunity_id = wso.id
)
SELECT 
  account_id,
  organization_id,
  MAX(mrr_value) as mrr_value -- Usa MAX para evitar duplicação por conta
FROM mrr_with_account
GROUP BY account_id, organization_id;

-- Comentário na view
COMMENT ON VIEW public.v_mrr_by_account IS 'MRR por conta (account), deduplicado. Usa apenas propostas aceitas de pipelines de vendas com termos recorrentes. MAX evita duplicação quando há múltiplas oportunidades para a mesma conta.';

-- Grant select para usuários autenticados
GRANT SELECT ON public.v_mrr_by_account TO authenticated;