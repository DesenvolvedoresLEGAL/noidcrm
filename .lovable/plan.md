

## Problema

Na versão mobile (Safari), os cards de **Cliente** e **Contato** aparecem vazios (fallback "Cliente" e "Contato não especificado"), enquanto no desktop os dados carregam normalmente. O card de **Proposta** mostra dados porque usa `proposal.title` diretamente, não o relation `opportunity.account`.

**Causa raiz**: O dado de `account` e `contact` vem de `proposal.opportunity?.account` e `proposal.opportunity?.contact` — uma query aninhada via Supabase. No mobile Safari com proteções de privacidade ativas, a query aninhada pode retornar parcialmente (a proposta carrega, mas as relações `opportunity → account/contact` vêm como `null`). Isso é confirmado pelo fato de que:
- O card **Proposta** mostra o título correto (vem de `proposal.title`, campo direto)
- O card **Cliente** cai no fallback `'Cliente'` (depende de `proposal.opportunity?.account`)

## Solução

Adicionar **fallback robusto** em `getProposalByToken`: se a query aninhada retornar `opportunity` sem `account` ou `contact`, buscar esses dados separadamente usando o `opportunity_id` da proposta.

### Arquivo: `src/services/supabase/proposals.ts` (função `getProposalByToken`)

Após a query principal (linha ~543), adicionar lógica de fallback:

```typescript
// Se opportunity existe mas account/contact não vieram na query aninhada, buscar separadamente
if (data?.opportunity_id && (!data?.opportunity?.account || !data?.opportunity?.contact)) {
  const { data: opp } = await supabase
    .from('opportunities')
    .select(`
      id, title, owner_user_id,
      account:accounts(id, razao_social, nome_fantasia, cnpj, telefones, emails, cidade, uf, logradouro, numero, bairro, cep),
      contact:contacts(id, nome, cargo, emails, telefones)
    `)
    .eq('id', data.opportunity_id)
    .maybeSingle();

  if (opp) {
    if (!data.opportunity) {
      (data as any).opportunity = opp;
    } else {
      if (!data.opportunity.account && opp.account) {
        (data as any).opportunity.account = opp.account;
      }
      if (!data.opportunity.contact && opp.contact) {
        (data as any).opportunity.contact = opp.contact;
      }
    }
  }
}
```

### Resumo

| Arquivo | Mudança |
|---------|---------|
| `src/services/supabase/proposals.ts` | Fallback para buscar account/contact separadamente se query aninhada retornar null |

Apenas 1 arquivo alterado. A view (`ProposalPublicView.tsx`) já renderiza corretamente quando os dados estão disponíveis — o problema é apenas no carregamento dos dados.

