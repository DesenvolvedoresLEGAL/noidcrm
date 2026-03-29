

## Correção: Receita Avulsa não contabiliza itens one-time de propostas mistas

### Problema
Quando uma oportunidade tem **proposta mista** (itens recurring + one-time, como Trisul: R$ 797 MRR + R$ 197 avulso), o código atual **exclui a oportunidade inteira** da receita avulsa porque `opportunityIdsWithRecurring.has(o.id)` é `true`. Resultado: R$ 8.035 em vez de R$ 8.232 (faltam os R$ 197 da Trisul).

### Solução
Em vez de classificar **por oportunidade** (tem recurring → não é avulsa), calcular avulso **por proposal_items**: somar `proposal_items.total` onde `billing_type` é `one_time` ou similar.

Para oportunidades **sem proposta aceita** ou sem itens, usar `valor_previsto` como fallback (comportamento atual para deals 100% avulsos).

### Lógica corrigida

```text
Receita Avulsa = 
  Para cada oportunidade won no mês:
    1. Buscar proposal_items da proposta aceita
    2. Somar items onde billing_type IN ('one_time', 'avulso', 'setup')
    3. Se não tem proposta aceita E não tem recurring → usar valor_previsto (fallback)
```

### Arquivos impactados

#### 1. `src/hooks/useOwnerDashboard.ts` (linhas 175-220)
- Buscar `proposal_items` com `billing_type` junto dos `proposalsWithTerms`
- Calcular `closedOneTimeThisMonth` somando itens one-time de todas as oportunidades won (inclusive mistas)
- Fallback: oportunidades sem proposta aceita e sem recurring → usar `valor_previsto`

#### 2. `src/hooks/useManagerDashboard.ts` (linhas 202-234)
- Mesma correção: calcular avulso por `proposal_items.billing_type` em vez de excluir oportunidades com recurring

### Dados necessários (já disponíveis)
- `proposal_items`: colunas `proposal_id`, `total`, `billing_type`
- `proposals`: já sendo consultadas com `opportunity_id` e `status = 'accepted'`
- Basta adicionar um JOIN/query de `proposal_items` nas propostas já buscadas

