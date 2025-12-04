-- Permitir acesso público a itens quando proposta tem token público válido
CREATE POLICY "Public access to proposal items via token"
ON proposal_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM proposals 
    WHERE proposals.id = proposal_items.proposal_id
    AND proposals.public_token IS NOT NULL
    AND proposals.status IN ('sent', 'viewed', 'accepted', 'rejected')
  )
);

-- Permitir acesso público a condições de pagamento quando proposta tem token público válido
CREATE POLICY "Public access to payment terms via token"
ON proposal_payment_terms FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM proposals 
    WHERE proposals.id = proposal_payment_terms.proposal_id
    AND proposals.public_token IS NOT NULL
    AND proposals.status IN ('sent', 'viewed', 'accepted', 'rejected')
  )
);