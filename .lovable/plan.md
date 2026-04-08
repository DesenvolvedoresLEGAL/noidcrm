

## Plano: Exibir descontos completos na proposta (link publico + PDF)

### Problema atual
1. **Desconto de item**: Na tabela de itens do link publico, nao aparece coluna de desconto -- so mostra preco unitario e total. O PDF ja tem coluna de desconto nos itens.
2. **Desconto de pagamento**: Aparece apenas no card header da proposta. Nao aparece na secao "Condicoes de Pagamento" (nem no link publico nem no PDF com detalhamento adequado).
3. **Valores nas parcelas**: As parcelas ja calculam com desconto aplicado, mas nao ha indicacao visual de que o desconto foi aplicado e qual era o valor original.

### Alteracoes

**1. Link publico (`src/pages/ProposalPublicView.tsx`) -- Tabela de itens**
- Adicionar coluna "Desconto" na tabela de itens avulsos e recorrentes (entre Preco Un. e Total)
- Quando item tem `discount_percent > 0`, mostrar a porcentagem em vermelho
- Exibir na mesma logica que o PDF ja faz

**2. Link publico -- Secao Condicoes de Pagamento**
- Dentro do bloco "Pagamento Avulso", antes do cronograma de parcelas, adicionar um resumo financeiro:
  - Subtotal avulso (valor sem desconto)
  - Linha de desconto em vermelho: "Desconto (X%): - R$ Y"
  - Total com desconto em destaque
- Isso alinha com o que o usuario espera: ver o desconto especificado na condicao de pagamento

**3. PDF (`supabase/functions/generate-proposal-pdf/index.ts`) -- Secao Condicoes de Pagamento**
- No bloco de Pagamento Avulso, adicionar entre o badge de desconto e a tabela de parcelas:
  - Subtotal: R$ X
  - Desconto (Y%): - R$ Z
  - Total: R$ W
- Ja mostra badge "-X% Desconto" mas falta o detalhamento dos valores

**4. Link publico -- Tabela de itens: indicar desconto por item**
- Abaixo do preco unitario (ou ao lado do total), quando `discount_percent > 0`, mostrar tag/texto pequeno tipo "(-10%)" em vermelho junto ao total do item

**5. Totais gerais consistentes**
- No footer da tabela de itens (link publico), se houver descontos de item, adicionar linhas de subtotal bruto vs desconto vs total liquido (similar ao que `ProposalItemsManager` ja faz internamente no editor)

### Arquivos a editar
- `src/pages/ProposalPublicView.tsx` (tabela de itens + secao pagamento)
- `supabase/functions/generate-proposal-pdf/index.ts` (secao pagamento avulso)

### Resultado esperado
- Cliente ve claramente: valor original, desconto aplicado (%), valor do desconto, valor final
- Isso aparece em 3 lugares: tabela de itens, secao de pagamento, e header (ja existente)
- Consistente entre link publico e PDF

