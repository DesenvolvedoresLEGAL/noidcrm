

## Plano de Correção: Consistência de Valores em Todas as Telas

### Diagnóstico

| Tela | Valor Mostrado | Fonte | Correto? |
|---|---|---|---|
| Dashboard (Avulsa + MRR) | R$ 29.943,60 | `proposal_items.total` (sem desconto) | **NÃO** |
| Forecast | R$ 29.754,20 | `valor_previsto` da oportunidade | SIM |
| BI Processadas | R$ 29.754,20 | `valor_previsto` da oportunidade | SIM |
| BI Forecast | R$ 29.754,20 | `valor_previsto` da oportunidade | SIM |

**Valor real fechado: R$ 29.754,20** (confirmado no banco de dados)

### Causa Raiz

O Dashboard CEO calcula "Receita Avulsa" somando `proposal_items.total` diretamente (linha 230 de `useOwnerDashboard.ts`). Esses valores são os totais de cada item ANTES do desconto de condição de pagamento. Para a Foody Delivery, os itens somam R$ 1.894, mas o valor real com 10% de desconto é R$ 1.704,60 — diferença de exatamente R$ 189,40.

### Correção

**Arquivo: `src/hooks/useOwnerDashboard.ts`** — Seção "ONE-TIME REVENUE CALCULATION"

A lógica atual soma `item.total` de todos os `proposal_items` com `billing_type != 'recurring'`. O problema é que o desconto de condição de pagamento não está refletido nos itens individuais — ele existe apenas em `proposal_payment_terms.discount_percent`.

**Solução:** Após somar os itens one-time por proposta, buscar o `discount_percent` correspondente de `proposal_payment_terms` e subtrair o desconto do total one-time de cada proposta.

Passos:
1. Agrupar os `proposal_items` por `proposal_id` (em vez de somar tudo direto)
2. Para cada proposta, buscar `proposal_payment_terms.discount_percent`
3. Aplicar o desconto ao subtotal one-time de cada proposta
4. Somar os totais já descontados

Alternativa mais simples e robusta: usar `proposals.total_amount` (que já contém o desconto) e subtrair a parte recurring, em vez de somar itens individuais. Isso garante que qualquer desconto futuro também será respeitado automaticamente.

**Abordagem escolhida:** Buscar `proposals.total_amount` e `proposal_payment_terms.monthly_value` para propostas aceitas de oportunidades ganhas. A receita avulsa = `total_amount - (monthly_value * contract_months ou recurring_total)`. Isso é mais robusto e alinhado com a fonte de verdade já corrigida.

### Resultado

Todas as telas passarão a mostrar R$ 29.754,20 como receita fechada, com a divisão correta entre avulsa e MRR, ambas derivadas dos valores já descontados persistidos em `proposals.total_amount`.

