## Plano

1. **Editor de proposta: pagamento de evento só avulso**
   - Remover a aba/controle “Recorrente” quando o template/proposta for de evento/avulso.
   - Manter somente “Forma de pagamento” e “Prazo/condição” para avulso.
   - Remover o campo “Início” do pagamento avulso nesse cenário.
   - Para “à vista”, o vencimento virá automaticamente da validade/faixa vigente da tabela dinâmica, não de uma data manual.

2. **Desconto aplicado no cálculo real**
   - Garantir que o desconto informado em “Configurar formas de pagamento” atualize o total líquido da proposta.
   - Regenerar/recalcular a tabela dinâmica usando o valor com desconto como base.
   - Sincronizar editor, header, link rápido e PDF para usarem o mesmo valor líquido.

3. **Preview/link rápido sem cobrança dinâmica do ERP**
   - Remover do link público qualquer banner/texto de “Condição comercial vigente”, “valor vigente hoje”, “diferença”, “cobrança complementar” ou “Pagar valor vigente”.
   - Manter apenas o bloco “Condições de Pagamento” com método e prazo.
   - Ajustar textos do CTA para “Aprovar Proposta”, sem “valor vigente”.

4. **PDF com condições financeiras limpas**
   - Confirmar que o PDF não renderiza bloco de condição dinâmica.
   - Exibir somente método, cronograma/prazo e valores já com desconto.

## Arquivos impactados

- `src/components/proposals/ProposalPaymentTerms.tsx`
- `src/pages/ProposalEditor.tsx`
- `src/pages/ProposalPublicView.tsx`
- `src/lib/proposalPdfBuilder.ts`
- `src/lib/proposalPdfGenerator.ts`
- `supabase/migrations/...` para ajustar o cálculo/orquestração financeira no banco

## Riscos

- Baixo/médio: há lógica financeira no frontend e no banco; o ajuste precisa manter uma única fonte de verdade para valor líquido.
- Não vou mexer em RLS nem em permissões de tenant além da função financeira existente.