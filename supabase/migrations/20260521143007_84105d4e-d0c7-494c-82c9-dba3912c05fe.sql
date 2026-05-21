-- View de elegibilidade de comissão derivada da SSoT
CREATE OR REPLACE VIEW public.commission_eligibility_view AS
SELECT
  v.organization_id,
  v.opportunity_id,
  v.commercial_opportunity_id,
  v.operational_opportunity_id,
  v.accepted_proposal_id,
  v.proposal_number,
  v.account_id,
  v.account_name,
  v.nome_fantasia,
  v.seller_id,
  v.seller_name,
  v.won_at,
  v.approved_at,
  v.commercial_amount,
  v.mrr_amount,
  v.one_shot_amount,
  v.commercial_amount AS commission_amount,
  v.review_required,
  v.revenue_confidence,
  v.warnings,
  CASE
    WHEN v.review_required THEN 'blocked_review_required'
    ELSE 'eligible'
  END AS commission_status,
  v.pipeline_id,
  v.pipeline_name,
  v.pipeline_type,
  v.opportunity_title,
  v.status,
  v.canonical_kind,
  v.created_at
FROM public.commercial_won_revenue_view v;

COMMENT ON VIEW public.commission_eligibility_view IS
  'Derivada da SSoT commercial_won_revenue_view. commission_amount = commercial_amount. commission_status=blocked_review_required quando review_required=true. Nunca paga comissão automática para itens bloqueados.';

GRANT SELECT ON public.commission_eligibility_view TO authenticated;