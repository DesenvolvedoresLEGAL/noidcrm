-- Function to preview the next proposal number without incrementing
CREATE OR REPLACE FUNCTION public.preview_next_proposal_number(p_org_id uuid, p_prefix text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefix TEXT;
  v_year TEXT;
  v_next_sequence INTEGER;
  v_proposal_number TEXT;
BEGIN
  -- Get prefix from parameter or organization settings
  IF p_prefix IS NOT NULL THEN
    v_prefix := p_prefix;
  ELSE
    SELECT COALESCE(proposal_prefix, 'PROP') INTO v_prefix
    FROM organizations
    WHERE id = p_org_id;
  END IF;
  
  -- Get current year
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  -- Get next sequence number (without incrementing)
  SELECT COALESCE(proposal_sequence, 0) + 1 INTO v_next_sequence
  FROM organizations
  WHERE id = p_org_id;
  
  -- Format: PREFIX-YEAR-00001
  v_proposal_number := v_prefix || '-' || v_year || '-' || LPAD(v_next_sequence::TEXT, 5, '0');
  
  RETURN v_proposal_number;
END;
$$;

-- Add payment_method column to proposal_payment_terms
ALTER TABLE public.proposal_payment_terms 
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'boleto';

-- Add due_day for recurring payments
ALTER TABLE public.proposal_payment_terms 
ADD COLUMN IF NOT EXISTS recurring_due_day integer DEFAULT 10;