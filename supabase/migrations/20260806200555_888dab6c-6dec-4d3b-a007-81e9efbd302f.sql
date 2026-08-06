REVOKE SELECT ON public.proposal_payment_terms FROM anon;
GRANT SELECT (
  id, proposal_id, organization_id, payment_type, entry_date, entry_percent,
  discount_percent, installments, first_installment_date, installment_interval_days,
  due_day, first_payment_date, monthly_value, contract_total, created_at, updated_at,
  payment_method, recurring_due_day, contract_start_date, contract_duration_months,
  billing_day, auto_renewal, payment_condition, second_payment_due_strategy,
  second_payment_due_date, dynamic_pricing_reference_type, dynamic_pricing_reference_date,
  freeze_price_on_approval, payment_due_days, manual_schedule
) ON public.proposal_payment_terms TO anon;