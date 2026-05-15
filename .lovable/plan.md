## Problema

A proposta TELA MAGICA (`6f625243-5c77-45ea-9064-40e94132f5ed`) tem:
- `subtotal` itens = R$ 985,00 (gross)
- `dynamic_pricing_current_amount` = R$ 1.280,50 (vigente por antecedência)
- `payment_expected_amount` / `approved_amount` = **R$ 1.199,83** (vigente − desconto 6,3% à vista — fonte de verdade)

O `notify-deal-won` já envia `amount = 1.199,83` corretamente. Mas o mesmo payload manda:
- `products[].total_price` somando R$ 985 (raw dos itens, sem antecedência e sem desconto)
- não envia `net_total`, `final_amount`, `valor_liquido`, `total_with_discount` (campos que o ERP espera, presentes no `api-deals`)

O ERP está lendo do `products[]` / `total_amount` legado e gravando R$ 985,00. Resultado: data correta, valor errado.

A correção tem que ser feita **uma vez** no único ponto de saída para o ERP (`notify-deal-won`), espelhando o que o `api-deals` já entrega, para que qualquer campo que o ERP leia traga o valor líquido aprovado.

## Mudanças

### 1. `supabase/functions/notify-deal-won/index.ts` — payload completo e consistente

a) **Selecionar mais campos da proposta** para reusar a mesma lógica do `api-deals`:
- adicionar `subtotal`, `discount_amount`, `total_amount` ao SELECT (além dos já existentes via `APPROVED_VALUE_SELECT_COLUMNS`).

b) **Calcular breakdown financeiro** igual ao `api-deals`:
- `netTotal` = approved.amount (já é 1.199,83 via `payment_expected_amount`)
- `discountTotal` = `subtotal − netTotal` (ou `discount_amount` se já preenchido)
- `discountPercent` = `(discountTotal / subtotal) × 100`
- `itemsGrossTotal` = soma de `proposal_items.total`

c) **Adicionar campos redundantes no payload** (mesmos nomes que o `api-deals` retorna), para o ERP não ter ambiguidade:
```
amount: netTotal,                  // 1199.83
net_total: netTotal,
final_amount: netTotal,
valor_liquido: netTotal,
total_with_discount: netTotal,
total_negotiated: netTotal,
total_amount: netTotal,            // sobrescreve o legado de 985
subtotal: subtotal,                // 985 (gross dos itens)
gross_total: itemsGrossTotal,
discount_total: discountTotal,
discount_percent: discountPercent,
contract_total: paymentTerms?.contract_total ?? netTotal,
```

d) **Escalar cada `products[].total_price`** proporcionalmente para que `Σ products[].total_price === netTotal`. Isso evita o cenário atual onde o ERP soma os itens e ignora o total.
- fator = `netTotal / itemsGrossTotal` (com guarda contra divisão por zero)
- aplicar ao `total_price` (e expor `original_total_price` para auditoria)
- **não alterar** `unit_price` nem `quantity` (preservam a apresentação original)
- adicionar `net_total_price` por item para o ERP que prefira ler do item

e) **Logs explícitos** com `net_total`, `gross_total`, `items_sum_after_scale` para facilitar diagnóstico futuro.

### 2. Não mexer em mais nada
- `api-deals` já está correto (envia `net_total`/`final_amount`/`amount` = 1.199,83) — nada a fazer.
- `_shared/approved-proposal-value.ts` já resolve a fonte de verdade corretamente — nada a fazer.
- RLS, multi-tenant, schema do DB: sem alterações.

### 3. Reenvio da TELA MAGICA
Após o deploy, retrigar o `notify-deal-won` para `proposal_id = 6f625243-5c77-45ea-9064-40e94132f5ed`. O ERP deve atualizar o R$ 985 → R$ 1.199,83 mantendo a data 14/05/2026.

## Arquivos impactados
- `supabase/functions/notify-deal-won/index.ts`

## Riscos
- **Baixo.** O ERP hoje lê algum campo que vale 985; depois da mudança, todos os campos relacionados a valor passam a refletir 1.199,83. Se o ERP lê do `products[]`, a soma escalada também bate.
- Itens com escala podem mostrar centavos não inteiros no ERP (ex.: R$ 985,00 vira R$ 1.199,83 quando há um único item; com vários itens, o último item recebe o ajuste de arredondamento para fechar exatamente).
- Não afeta propostas sem desconto/antecedência (fator = 1.0).

## Próximos passos
1. Implementar e deployar `notify-deal-won`.
2. Reenviar TELA MAGICA via `notify-deal-won` com `proposal_id` da accepted.
3. Conferir no ERP: valor R$ 1.199,83, vencimento 14/05/2026.
