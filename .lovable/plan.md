

# Copiar Payment Terms na Duplicação de Oportunidade

## Problema

A Edge Function `execute-workflow` copia propostas e itens ao duplicar oportunidades, mas **não copia a tabela `proposal_payment_terms`**. Resultado: vencimento e pagamento aparecem como "-" na proposta duplicada.

Confirmado no banco: a proposta original (`a10ad516`) tem payment term com `pix` e vencimento `2026-04-06`, mas a proposta duplicada (`206dcb14`) tem zero registros em `proposal_payment_terms`.

## Alteração

### `supabase/functions/execute-workflow/index.ts`

Após o bloco que copia `proposal_items` (linha ~586), adicionar um bloco idêntico para copiar `proposal_payment_terms`:

```typescript
// Copy proposal payment terms
const { data: sourceTerms } = await supabase
  .from('proposal_payment_terms')
  .select('*')
  .eq('proposal_id', oldProposalId);

if (sourceTerms && sourceTerms.length > 0) {
  const termsToInsert = sourceTerms.map((term: any) => {
    const { id, created_at, updated_at, ...termData } = term;
    return { ...termData, proposal_id: newProposal.id };
  });
  
  const { error: termsError } = await supabase
    .from('proposal_payment_terms')
    .insert(termsToInsert);

  if (termsError) {
    console.error('[execute-workflow] Error copying payment terms:', termsError);
  } else {
    console.log(`[execute-workflow] Copied ${sourceTerms.length} payment terms for proposal ${newProposal.id}`);
  }
}
```

### Fix retroativo para BaseLinker

Após o deploy, copiar manualmente os payment terms da proposta original para a duplicada via migration ou script, para que a BaseLinker operacional já mostre os dados corretos.

## Arquivos impactados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/execute-workflow/index.ts` | Adicionar cópia de `proposal_payment_terms` |

## Resultado

- Vencimento e pagamento aparecerão corretamente em propostas duplicadas
- PDF e link rápido mostrarão as informações de pagamento
- Nenhuma informação ficará para trás na duplicação

