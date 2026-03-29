-- Create a security definer function that returns proposal data WITHOUT PII columns
-- Excludes: acceptor_document, acceptor_ip, acceptor_user_agent, acceptor_email, acceptor_phone, acceptor_document_masked, acceptance_hash
CREATE OR REPLACE FUNCTION public.get_proposal_by_public_token(p_token text)
RETURNS TABLE (
  id uuid,
  opportunity_id uuid,
  status text,
  pdf_url text,
  sent_at timestamp with time zone,
  viewed_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  organization_id uuid,
  title text,
  content text,
  expires_at timestamp with time zone,
  client_email text,
  client_name text,
  value numeric,
  version integer,
  parent_proposal_id uuid,
  template_name text,
  public_token text,
  signature_status text,
  signed_at timestamp with time zone,
  declined_reason text,
  declined_at timestamp with time zone,
  accepted_at timestamp with time zone,
  views_count integer,
  last_viewed_at timestamp with time zone,
  introduction text,
  terms text,
  notes text,
  subtotal numeric,
  discount_amount numeric,
  total_amount numeric,
  layout_id uuid,
  proposal_number text,
  proposal_version integer,
  currency text,
  acceptor_name text,
  acceptor_position text,
  acceptance_proof_url text,
  deleted_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.opportunity_id, p.status, p.pdf_url,
    p.sent_at, p.viewed_at, p.created_at, p.updated_at,
    p.organization_id, p.title, p.content, p.expires_at,
    p.client_email, p.client_name, p.value, p.version,
    p.parent_proposal_id, p.template_name, p.public_token,
    p.signature_status, p.signed_at, p.declined_reason, p.declined_at,
    p.accepted_at, p.views_count, p.last_viewed_at,
    p.introduction, p.terms, p.notes,
    p.subtotal, p.discount_amount, p.total_amount,
    p.layout_id, p.proposal_number, p.proposal_version, p.currency,
    p.acceptor_name, p.acceptor_position, p.acceptance_proof_url,
    p.deleted_at
  FROM proposals p
  WHERE p.public_token = p_token
    AND p.deleted_at IS NULL
    AND p.status IN ('sent', 'viewed', 'accepted', 'rejected')
    AND (p.expires_at IS NULL OR (p.expires_at::date + interval '1 day') > now())
$$;