

## Problema
A RPC `get_proposal_by_public_token` retorna apenas os dados da tabela `proposals`. Depois, o `getProposalByToken` tenta carregar dados relacionados (organization, opportunity/account/contact, items, payment_terms, layout) via queries diretas nas tabelas -- mas o usuário anônimo é bloqueado pelo RLS. Resultado: proposta carrega, mas cliente, contato, itens e contrato ficam vazios.

## Solução
Consolidar tudo em uma unica RPC `SECURITY DEFINER` que retorna um JSONB bundle com todos os dados necessarios, eliminando as queries secundarias.

## Passos

### 1. Migration SQL -- Recriar `get_proposal_by_public_token` como JSONB bundle
Alterar a funcao para retornar `jsonb` (em vez de `RETURNS TABLE`) contendo:
- `proposal`: dados da proposta (sem PII sensivel)
- `organization`: id, name, legal_name, cnpj, logo_url, email, phone, primary_color, address_*
- `opportunity`: id, title, pipeline_id, owner_user_id
- `account`: id, razao_social, nome_fantasia, cnpj, telefones, emails, cidade, uf, logradouro, numero, bairro, cep
- `contact`: id, nome, cargo, emails, telefones
- `items`: array de proposal_items (order_index asc) -- excluindo unit_cost
- `payment_terms`: array de proposal_payment_terms
- `layout`: proposal_layouts + proposal_layout_pages
- `contract`: proposal_contracts (ultimo criado)

A funcao continua com os mesmos filtros (deleted_at, status whitelist, expiration).

### 2. Refatorar `getProposalByToken` em `src/services/supabase/proposals.ts`
- Remover todas as queries secundarias (opportunities, organizations, layouts, profiles)
- A RPC agora retorna JSONB -- extrair cada chave do bundle
- Montar o objeto `result` diretamente do retorno: `result.organization = data.organization`, `result.opportunity = { ...data.opportunity, account: data.account, contact: data.contact }`, etc.
- Manter o fallback de seller_profile apenas para usuarios autenticados (ja existe)

### 3. Ajustar `ProposalPublicView.tsx` -- items e payment_terms do bundle
- Em `loadProposal`, alem de `setProposal(data)`, extrair `data.items` e `data.payment_terms` do bundle retornado pela RPC (se existirem)
- Remover as chamadas separadas a `listProposalItems` e `getPaymentTerms` para o fluxo publico
- Manter fallback: se o bundle nao trouxer items/terms, tentar as queries separadas (para compatibilidade)

### Detalhes tecnicos

**SQL (resumo da funcao):**
```sql
CREATE OR REPLACE FUNCTION public.get_proposal_by_public_token(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_proposal proposals%rowtype;
BEGIN
  SELECT * INTO v_proposal FROM proposals p
  WHERE (p.public_token = p_token OR p.public_token = encode(digest(p_token, 'sha256'), 'hex'))
    AND p.deleted_at IS NULL
    AND p.status IN ('sent','viewed','accepted','rejected')
    AND (p.expires_at IS NULL OR (p.expires_at::date + interval '1 day') > now())
  LIMIT 1;
  IF v_proposal.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'proposal', to_jsonb(v_proposal) - 'acceptor_ip' - 'acceptor_user_agent' - 'acceptor_document' - 'acceptor_email' - 'acceptor_phone' - 'acceptance_hash',
    'organization', (SELECT to_jsonb(o) FROM organizations o WHERE o.id = v_proposal.organization_id),
    'opportunity', (SELECT to_jsonb(op) - ... FROM opportunities op WHERE op.id = v_proposal.opportunity_id),
    'account', (SELECT to_jsonb(a) FROM accounts a WHERE a.id = (SELECT account_id FROM opportunities WHERE id = v_proposal.opportunity_id)),
    'contact', (SELECT to_jsonb(c) FROM contacts c WHERE c.id = (SELECT contact_id FROM opportunities WHERE id = v_proposal.opportunity_id)),
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(i) - 'unit_cost' ORDER BY i.order_index) FROM proposal_items i WHERE i.proposal_id = v_proposal.id), '[]'),
    'payment_terms', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM proposal_payment_terms t WHERE t.proposal_id = v_proposal.id), '[]'),
    'layout', (SELECT jsonb_build_object('id', l.id, 'name', l.name, 'terms_pdf_url', l.terms_pdf_url, 'pages', COALESCE((SELECT jsonb_agg(to_jsonb(lp)) FROM proposal_layout_pages lp WHERE lp.layout_id = l.id), '[]')) FROM proposal_layouts l WHERE l.id = v_proposal.layout_id),
    'contract', (SELECT to_jsonb(pc) FROM proposal_contracts pc WHERE pc.proposal_id = v_proposal.id ORDER BY pc.created_at DESC LIMIT 1)
  );
END $$;
```

**Arquivos modificados:**
- Nova migration SQL
- `src/services/supabase/proposals.ts` (simplificar `getProposalByToken`)
- `src/pages/ProposalPublicView.tsx` (consumir items/terms do bundle)

