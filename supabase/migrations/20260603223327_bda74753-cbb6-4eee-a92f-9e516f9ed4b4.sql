CREATE OR REPLACE FUNCTION public.get_proposal_by_public_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_proposal proposals%rowtype;
  v_result jsonb;
  v_opp_account_id uuid;
  v_opp_contact_id uuid;
BEGIN
  SELECT * INTO v_proposal
  FROM proposals p
  WHERE (p.public_token = p_token OR p.public_token = encode(extensions.digest(p_token, 'sha256'), 'hex'))
    AND p.deleted_at IS NULL
    AND p.status IN ('sent', 'viewed', 'accepted', 'rejected')
  LIMIT 1;

  IF v_proposal.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT account_id, contact_id INTO v_opp_account_id, v_opp_contact_id
  FROM opportunities WHERE id = v_proposal.opportunity_id;

  v_result := jsonb_build_object(
    'proposal', to_jsonb(v_proposal)
      - 'acceptor_ip' - 'acceptor_user_agent' - 'acceptor_document'
      - 'acceptor_email' - 'acceptor_phone' - 'acceptance_hash',

    'organization', (
      SELECT jsonb_build_object(
        'id', o.id, 'name', o.name, 'legal_name', o.legal_name, 'cnpj', o.cnpj,
        'logo_url', o.logo_url, 'email', o.email, 'phone', o.phone,
        'primary_color', o.primary_color,
        'address_street', o.address_street, 'address_number', o.address_number,
        'address_complement', o.address_complement, 'address_city', o.address_city,
        'address_state', o.address_state, 'address_zip', o.address_zip
      )
      FROM organizations o WHERE o.id = v_proposal.organization_id
    ),

    'opportunity', (
      SELECT jsonb_build_object(
        'id', op.id, 'title', op.title, 'pipeline_id', op.pipeline_id,
        'owner_user_id', op.owner_user_id, 'created_at', op.created_at
      )
      FROM opportunities op WHERE op.id = v_proposal.opportunity_id
    ),

    'account', (
      SELECT jsonb_build_object(
        'id', a.id, 'razao_social', a.razao_social, 'nome_fantasia', a.nome_fantasia,
        'cnpj', a.cnpj, 'telefones', a.telefones, 'emails', a.emails,
        'cidade', a.cidade, 'uf', a.uf, 'logradouro', a.logradouro,
        'numero', a.numero, 'bairro', a.bairro, 'cep', a.cep
      )
      FROM accounts a WHERE a.id = v_opp_account_id
    ),

    'contact', (
      SELECT jsonb_build_object(
        'id', c.id, 'nome', c.nome, 'cargo', c.cargo,
        'emails', c.emails, 'telefones', c.telefones
      )
      FROM contacts c WHERE c.id = v_opp_contact_id
    ),

    'items', COALESCE((
      SELECT jsonb_agg(
        (to_jsonb(i) - 'unit_cost')
          || jsonb_build_object(
            'measurement_unit',
            CASE
              WHEN mu.id IS NOT NULL THEN jsonb_build_object(
                'id', mu.id,
                'name', mu.name,
                'abbreviation', mu.abbreviation
              )
              ELSE NULL
            END
          )
        ORDER BY i.order_index
      )
      FROM proposal_items i
      LEFT JOIN measurement_units mu ON mu.id = i.measurement_unit_id
      WHERE i.proposal_id = v_proposal.id
    ), '[]'::jsonb),

    'payment_terms', COALESCE((
      SELECT jsonb_agg(to_jsonb(t))
      FROM proposal_payment_terms t WHERE t.proposal_id = v_proposal.id
    ), '[]'::jsonb),

    'layout', (
      SELECT jsonb_build_object(
        'id', l.id, 'name', l.name, 'terms_pdf_url', l.terms_pdf_url,
        'pages', COALESCE((
          SELECT jsonb_agg(to_jsonb(lp) ORDER BY lp.page_number)
          FROM proposal_layout_pages lp WHERE lp.layout_id = l.id
        ), '[]'::jsonb)
      )
      FROM proposal_layouts l WHERE l.id = v_proposal.layout_id
    ),

    'contract', (
      SELECT to_jsonb(c)
      FROM contracts c
      WHERE c.opportunity_id = v_proposal.opportunity_id
      ORDER BY c.created_at DESC
      LIMIT 1
    ),

    'seller_profile', (
      SELECT jsonb_build_object(
        'full_name', pr.full_name, 'avatar_url', pr.avatar_url,
        'phone', pr.phone, 'email', pr.email
      )
      FROM profiles pr
      WHERE pr.user_id = (SELECT owner_user_id FROM opportunities WHERE id = v_proposal.opportunity_id)
    )
  );

  RETURN v_result;
END;
$function$;