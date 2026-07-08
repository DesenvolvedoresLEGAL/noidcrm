## Problema

Quando um desconto manual é aplicado à proposta, a tela pública mostra **quatro valores diferentes** para o mesmo total, porque cada seção calcula por conta própria em vez de ler a mesma fonte (o ledger `pricing_breakdown_snapshot`):

| Local | Mostra | De onde vem |
|---|---|---|
| Header (Proposta) | Subtotal vigente **R$ 3.465,83** / Desconto **-R$ 272,90** / Total **R$ 3.192,93** | `subtotalItems + dynamic.amount` (mistura raw + ajuste sobre base já descontada) |
| Tabela "Itens Avulsos" | Total Vigente Hoje **R$ 3.547,70** | `dpBreakdown` recalculado sobre subtotal bruto — **não considera desconto manual** |
| "Resumo Financeiro" (Condições) | Valor vigente **R$ 3.192,93** ✅ | Ledger (ProposalPricingBreakdown) — correto |
| "Forma e prazo do pagamento" | **R$ 3.119,25** ❌ | `calculateInstallments` recebe `effectiveOneTimeBase = 3.465,83` e aplica desconto de 10% em cima (dupla aplicação/base errada) |

O valor correto e canônico é o do ledger: `effective_amount = 3.192,93` (subtotal 2.729 − desconto 272,90 = base 2.456,10 × 1,30 = 3.192,93).

## Objetivo

Todo lugar que exibe totais na proposta pública **lê o mesmo ledger** e mostra a mesma composição. `Total Vigente Hoje`, `Total Vigente`, `Forma e prazo do pagamento`, `Header` e `Condição comercial vigente` precisam bater até o centavo com `pricing_breakdown_snapshot.effective_amount` quando o snapshot existe.

## Escopo (somente `src/pages/ProposalPublicView.tsx`)

Nenhuma mudança em cálculo backend, RLS ou tabelas. Apenas alinhar as leituras/renderizações no client.

### 1. Header "Proposta" (linhas ~1317–1339)
Quando `pricingSummary` existe, exibir:
- `Subtotal:` = `subtotalItems + recurringContractTotal` (número que o cliente reconhece: soma dos itens)
- `Desconto manual (X%)` = `pricingSummary.manualDiscount.amount`
- `Ajuste dinâmico (+Y%)` = `pricingSummary.dynamicAdjustment.amount` (quando ≠ 0)
- `Total:` = `oneTimeNetFromLedger + recurringContractTotal` (= 3.192,93 no caso)

Assim o header conta a mesma história do "Resumo Financeiro" e do ledger.

### 2. Tabela "Itens Avulsos" (linhas ~1488–1520)
Quando `pricingSummary` existe e há desconto manual e/ou ajuste dinâmico, substituir o footer atual (`Subtotal dos Itens` → `Ajuste por antecedência` → `Total Vigente Hoje`) pela sequência canônica do ledger:
```text
Subtotal dos Itens        2.729,00
Desconto manual (10%)      -272,90
Base comercial            2.456,10
Ajuste por antecedência (+30%)  +736,83
Total Vigente Hoje        3.192,93
```
Rótulo `Total Vigente Hoje` continua, mas agora representa o valor **efetivo pós-desconto**, batendo com header/condição/resumo.

Para o rodapé "Condição vigente até … novo valor: R$ 4.093,50", aplicar o mesmo desconto manual sobre `dpBreakdown.nextAmount` quando `pricingSummary.manualDiscount.percent > 0`, para que o "novo valor" também seja pós-desconto.

### 3. "Condição Comercial Vigente" (card amarelo, linhas ~1524–1533 e card seguinte)
Trocar os três valores exibidos (valor vigente / próxima virada / valor anterior) por versões pós-desconto quando houver desconto manual, para não conflitar com o header. Fonte: `pricingSummary.effectiveAmount` e derivar próximo/anterior aplicando o mesmo % de desconto.

### 4. "Forma e prazo do pagamento" (linhas ~1043–1064)
Corrigir a base do cronograma:
- Quando `pricingSummary` existe e a proposta **não** está congelada (`frozenInstallments == null`) e **não** está aceita, passar `baseForSchedule = oneTimeNetFromLedger` (já líquido = 3.192,93) **e** passar `approvedAmount: oneTimeNetFromLedger` no options de `calculateInstallments`, para que a função **não reaplique** `discount_percent` sobre uma base já descontada.
- Isto elimina o R$ 3.119,25 e faz a parcela única/soma bater com `effective_amount`.

Quando não há ledger, mantém o comportamento atual (legacy).

### 5. Verificação
- Rodar typecheck.
- Testar visualmente na proposta `/p/6746e1c5…` (a mesma da tela enviada): todos os cinco lugares precisam mostrar **R$ 3.192,93** como total efetivo (parcela única = 3.192,93), e a composição intermediária idêntica (subtotal 2.729 → desconto 272,90 → base 2.456,10 → ajuste +736,83 → 3.192,93).
- Testar com desconto = 0 (garantir que nada regride).
- Testar proposta aceita/congelada (schedule congelado tem prioridade — não pode ser alterado).

## Riscos
- Baixo. Todas as mudanças são apresentacionais e ficam atrás de `if (pricingSummary)`; propostas legadas sem ledger continuam usando o caminho antigo.
- `calculateInstallments` não é alterado — apenas o valor passado a ela.
- Nenhum RLS, migração, edge function ou cálculo server-side é tocado.

## Fora do escopo
- Recalcular ou congelar propostas antigas.
- Alterar o PDF (`proposalPdfBuilder.ts`) — pode ser sprint seguinte usando o mesmo padrão.
- Editor interno da proposta — o breakdown lá já usa `ProposalPricingBreakdown` (ledger) e está correto.
