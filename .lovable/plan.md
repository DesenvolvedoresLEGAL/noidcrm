

## Correção: Mapeamento de colunas errado no api-deals e notify-deal-won

### Problema
As edge functions `api-deals` e `notify-deal-won` estão usando nomes de colunas que **não existem** no banco, resultando em valores zerados/nulos no ERP.

### Colunas erradas vs reais

**`proposal_items`:**
| Usado (errado) | Real |
|---|---|
| `product_name` | `name` |
| `total_price` | `total` |
| `sort_order` | `order_index` |
| `billing_cycle` | não existe |
| `monthly_price` | não existe |

**`proposal_payment_terms`:**
| Usado (errado) | Real |
|---|---|
| `first_due_date` | `first_installment_date` (one_time) / `first_payment_date` (recurring) |
| `total_value` | `contract_total` |
| `installment_interval` | `installment_interval_days` |
| `notes` | `comments` |

### O que será corrigido

#### 1. `supabase/functions/api-deals/index.ts`
- Corrigir SELECT de `proposal_items`: usar `name`, `total`, `order_index`
- Corrigir SELECT de `proposal_payment_terms`: usar colunas reais
- Calcular `amount` como soma de `item.total`
- Adicionar campo `vencimento` no response: derivado de `first_installment_date` (one_time) ou `first_payment_date` (recurring)
- Corrigir extração de emails (JSONB `[{"value":"..."}]`)

#### 2. `supabase/functions/notify-deal-won/index.ts`
- Mesmas correções de mapeamento de colunas
- Adicionar `vencimento` no payload enviado ao ERP

### Campo `vencimento` (novo)
```text
Se payment_type = 'one_time' → first_installment_date
Se payment_type = 'recurring' → first_payment_date ou contract_start_date
Fallback → null
```

### Arquivos impactados
- `supabase/functions/api-deals/index.ts`
- `supabase/functions/notify-deal-won/index.ts`

