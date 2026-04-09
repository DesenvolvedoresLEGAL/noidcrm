

## Correção Urgente: Desconto de Condição de Pagamento Não Aplicado nos Valores

### Problema Identificado

A proposta Foody Delivery (PROP-2026-00504) tem:
- Items: R$ 997 + R$ 400 + R$ 497 = **R$ 1.894,00** (subtotal)
- Desconto na condição de pagamento: **10%**
- Valor correto: R$ 1.894 - R$ 189,40 = **R$ 1.704,60**

Porém, `calculateProposalTotal()` em `proposal-items.ts` soma apenas os totais dos itens sem considerar o desconto de condição de pagamento (`proposal_payment_terms.discount_percent`). Resultado:

| Campo | Valor Atual (errado) | Valor Correto |
|---|---|---|
| `proposals.value` | 1894 | 1704.60 |
| `proposals.total_amount` | 1894 | 1704.60 |
| `opportunities.valor_previsto` | 1894 | 1704.60 |
| `opportunities.commission_value` | 1397 | 1257.30 |
| Slack (Valor) | R$ 1.894,00 | R$ 1.704,60 |
| ERP (amount) | 1894 | 1704.60 |

O desconto é **apenas visual** (mostrado no PDF e link público) mas nunca persistido nos valores reais.

### Impacto Sistêmico

- **Forecast**: inflado por ignorar descontos de pagamento
- **Dashboard/KPIs**: receita e ticket médio incorretos
- **OTE/Comissões**: commission_value também não desconta
- **ERP**: valor enviado sem desconto
- **Slack**: notificação com valor incorreto
- **Relatórios**: todas as métricas de receita afetadas

### Correção

**1. `src/services/supabase/proposal-items.ts`** — `calculateProposalTotal()`:
- Buscar `proposal_payment_terms.discount_percent` para o proposalId
- Separar itens one_time vs recurring
- Aplicar desconto apenas aos itens one_time (como já feito visualmente)
- Retornar `total` e `commissionTotal` já com desconto aplicado

**2. `src/services/supabase/proposals.ts`** — `updateProposalTotals()`:
- Persistir `discount_amount` na proposta (campo já existe no schema)
- `value` e `total_amount` passam a refletir o valor final com desconto

**3. `src/services/supabase/proposals.ts`** — `syncOpportunityValue()`:
- `valor_previsto` da oportunidade usará o valor já descontado (vem do total corrigido)
- `commission_value` também será recalculado com desconto nos itens comissionáveis

**4. `supabase/functions/notify-deal-won/index.ts`**:
- Buscar `discount_percent` dos payment terms
- Aplicar desconto ao `totalAmount` antes de enviar ao ERP
- Garantir que `dealPayload.amount` reflete valor final

**5. `supabase/functions/post-acceptance-effects/index.ts`**:
- Buscar payment terms com desconto
- Recalcular `proposalValue` aplicando desconto (ou usar `total_amount` que já virá correto)
- Slack e notificações passam a mostrar valor final real

**6. Correção de dados existentes** — Migração SQL:
- UPDATE da proposta Foody Delivery para corrigir `value`, `total_amount`, `discount_amount`
- UPDATE da oportunidade correspondente para corrigir `valor_previsto` e `commission_value`

### Arquivos a editar

| Arquivo | Ação |
|---|---|
| `src/services/supabase/proposal-items.ts` | Incluir desconto de pagamento no cálculo |
| `src/services/supabase/proposals.ts` | Persistir `discount_amount`, propagar valor correto |
| `supabase/functions/notify-deal-won/index.ts` | Aplicar desconto ao amount do ERP |
| `supabase/functions/post-acceptance-effects/index.ts` | Usar valor final com desconto no Slack/notificações |
| Migração SQL | Corrigir dados da Foody Delivery |

### Resultado

Após a correção, o desconto de condição de pagamento será aplicado de ponta a ponta: do cálculo interno até o Slack, ERP, Forecast, Dashboard e Relatórios. Todas as propostas futuras (e a Foody Delivery retroativamente) refletirão o valor real da contratação.

