

# Correções: Nome do Cliente no Slack + Cópia de Propostas na Duplicação

## Problema 1: Slack mostra "Cliente" em vez do nome real

Tanto `post-acceptance-effects` quanto `generate-acceptance-proof` buscam apenas `razao_social` da conta. O campo correto a priorizar é `nome_fantasia` (com fallback para `razao_social`).

**Alterações:**

- **`supabase/functions/post-acceptance-effects/index.ts`** (linha 96): Alterar select para buscar `razao_social, nome_fantasia` e usar `account.nome_fantasia || account.razao_social` como accountName
- **`supabase/functions/generate-acceptance-proof/index.ts`** (linha 89): Alterar o select do join de accounts para incluir `nome_fantasia`, e atualizar a linha 639 para priorizar `nome_fantasia`

## Problema 2: Propostas não copiadas na duplicação

O código de cópia em `execute-workflow` (linhas 501-557) **existe**, mas falha silenciosamente. A causa: ao copiar a proposta com `...proposalData`, ele copia `public_token` e `acceptance_hash` que possuem constraints `UNIQUE` no banco. O INSERT falha por violação de unicidade.

**Alteração em `supabase/functions/execute-workflow/index.ts`** (linha 510):

Excluir campos que causam conflito de unicidade e campos de aceitação ao fazer o spread:

```typescript
const { 
  id: oldProposalId, 
  created_at, 
  updated_at, 
  public_token,        // UNIQUE constraint
  acceptance_hash,     // UNIQUE constraint
  proposal_number,     // Deve ser gerado novo
  // Reset acceptance/signature fields
  acceptor_name,
  acceptor_document,
  acceptor_document_masked,
  acceptor_position,
  acceptor_ip,
  acceptor_user_agent,
  acceptor_email,
  acceptor_phone,
  accepted_at,
  signed_at,
  signature_status,
  declined_at,
  declined_reason,
  sent_at,
  viewed_at,
  views_count,
  last_viewed_at,
  acceptance_proof_url,
  pdf_url,
  ...proposalData 
} = proposal;
```

E inserir com status `draft`:
```typescript
.insert({
  ...proposalData,
  opportunity_id: data.id,
  status: 'draft',
})
```

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/post-acceptance-effects/index.ts` | Buscar e priorizar `nome_fantasia` |
| `supabase/functions/generate-acceptance-proof/index.ts` | Buscar e priorizar `nome_fantasia` |
| `supabase/functions/execute-workflow/index.ts` | Excluir campos UNIQUE e de aceitação ao copiar propostas |

## Deploy
As 3 edge functions precisam ser redeployadas após as alterações.

