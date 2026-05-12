
## Problema

Hoje a proposta mostra valores divergentes quando há tabela dinâmica ativa **+** desconto manual da condição comercial:

| Local | Mostra | Base usada |
|---|---|---|
| Header (resumo da proposta) | Subtotal R$ 4.194,00 / Desconto -R$ 419,40 / **Total R$ 4.613,40** | mistura: subtotal base, desconto sobre base, total dinâmico |
| Itens avulsos (rodapé) | Subtotal R$ 4.194,00 + ajuste antecedência → R$ 4.613,40 | correto |
| Condição Comercial Vigente | R$ 4.613,40 | correto |
| Condições de Pagamento → Resumo Financeiro | Subtotal R$ 4.194,00 / Desconto -R$ 419,40 / **Total R$ 3.774,60** | base bruta (ignora dinâmica) |
| Pagamento à vista (parcelas) | **R$ 4.152,06** | dinâmica (4.613,40 × 0,9) |

Causa raiz: cada bloco escolhe sua própria base (ora `oneTimeTotal` bruto, ora `dynamic_pricing_snapshot.current_amount`, ora `proposal.total_amount`). Quando há ajuste por antecedência **e** desconto manual, os valores não fecham.

## Princípio (fonte única da verdade)

Quando a tabela dinâmica está ativa (`dynamic_pricing_enabled && snapshot.status === 'active'`):

- **Base avulsa** (subtotal de partida para todos os cálculos de pagamento) = `snapshot.current_amount` (já inclui ajuste por antecedência / referência).
- **Desconto manual** (`payment_terms.discount_percent`) é aplicado **sobre a base avulsa**.
- **Total líquido avulso** = base avulsa − desconto.
- **Parcelas** (à vista, 50/50, 30/60/90, etc.) são calculadas a partir da **base avulsa**, mantendo a lógica atual de `calculateInstallments`.

Quando a tabela dinâmica está desativada, base avulsa = `oneTimeTotal` (soma dos itens one-time, comportamento atual).

Header e Resumo Financeiro devem usar exatamente a mesma trinca: **Subtotal · Desconto · Total**.

## Mudanças (frontend / apresentação apenas)

Nenhuma mudança em banco, edge function ou regra de negócio. Apenas alinhar a leitura nas views.

### 1. `src/pages/ProposalPublicView.tsx`
- Criar `effectiveOneTimeBase = dpEnabled && snap.current_amount ? snap.current_amount : oneTimeTotal`.
- Recalcular `paymentDiscountAmount` e `oneTimeWithDiscount` a partir de `effectiveOneTimeBase`.
- **Header (linhas ~1308–1319)**: Subtotal = `effectiveOneTimeBase + recurringContractTotal`; Desconto = `paymentDiscountAmount`; Total exibido = `oneTimeWithDiscount + recurringContractTotal` (não `proposal.total_amount`).
- **Resumo Financeiro (linhas ~1632–1645)**: Subtotal Avulso = `effectiveOneTimeBase`; Desconto = `paymentDiscountAmount`; Total com Desconto = `oneTimeWithDiscount`.
- Manter `oneTimeTotalForInstallments` apontando para `effectiveOneTimeBase` (já está, garantir consistência).
- Quando há ajuste por antecedência diferente do bruto, mostrar uma micro-linha "Inclui ajuste de antecedência (+R$ X)" no Resumo Financeiro para o cliente entender por que o subtotal subiu.

### 2. `src/components/proposals/ProposalPreview.tsx` (visualização rápida no editor)
- Carregar `dynamic_pricing_snapshot` (já carregado em `dynamicPricing` query).
- Aplicar a mesma lógica `effectiveOneTimeBase` em `calculatedSubtotal`, `paymentDiscountAmount`, `oneTimeWithDiscount`, `displayTotal` (linhas 225–244).
- Usar a mesma base em `calculateInstallments` (linha ~415).

### 3. `src/components/proposals/PublicProposalApprovedScreen.tsx`
- Garantir que o "Resumo Financeiro" pós-aprovação também leia da snapshot quando `freeze_price_on_approval` ou snapshot aprovado existir (já usa `approved_amount`; só validar consistência do desconto em cima dessa base).

### 4. `src/lib/proposalPdfGenerator.ts`
- Replicar a regra ao montar o PDF: `effectiveOneTimeBase` → Subtotal, Desconto, Total e parcelas (área das linhas 285–310 e blocos de "Resumo" / "Condições de Pagamento").

### 5. Coerência visual (microcopy)
- Header e Resumo Financeiro: rotular o subtotal como **"Subtotal vigente"** quando `dpEnabled && current_amount !== oneTimeTotal`, para deixar claro que já inclui o ajuste por antecedência. Caso contrário manter "Subtotal".

## Validação manual

Cenário do print (Motoppar / EXPOSEC 2026):
- Itens base: R$ 4.194,00
- Ajuste antecedência: +10% → vigente R$ 4.613,40
- Desconto manual: 10%

Esperado em **todos** os locais:
- Subtotal vigente: **R$ 4.613,40**
- Desconto (10%): **− R$ 461,34**
- Total com Desconto: **R$ 4.152,06**
- Pagamento à vista: **R$ 4.152,06** ✓ (já está)

## Riscos / Não-objetivos

- Não alterar `orchestrate_proposal_financials` nem `dynamic_pricing_snapshot` (dados continuam corretos).
- Não alterar `calculateInstallments` (já recebe a base certa).
- Não tocar em itens recorrentes (MRR) — desconto manual continua só em one-time.
- Não mudar `proposal.total_amount` no banco; apenas a exibição passa a refletir base + desconto coerentes.
