
## Problema

Dois números deveriam ser idênticos para o Wagner em maio/2026, mas não são:

- **Relatórios → Vendas Realizadas**: Receita Total **R$ 158.443,59** (60 vendas) — vem de `commercial_won_revenue_view` (SSoT oficial).
- **Resultados → Por Vendedor**: header **"Vendas R$ 126.150,15"** e meta 210,3% — vem de `ote_monthly_results.total_sales`.
- No mesmo card OTE, o rodapé "Elegível para meta" mostra **R$ 158.443,59** (vem de `ote_sales_records`, que já consome a SSoT).

Ou seja: o próprio card OTE já tem dois números divergentes para a mesma coisa, e o de cima viola a regra **"commercial_won_revenue_view é a ÚNICA fonte oficial de receita realizada"**.

## Causa-raiz

`supabase/functions/calculate-ote/index.ts` calcula `total_sales` somando `commission_value ?? valor_previsto` direto de `opportunities` (linhas 253-256). Logo depois, ao gerar `ote_sales_records`, enriquece com `commercial_won_revenue_view` (linhas 533-594) — esse caminho está correto. Resultado: header e drill-down nunca batem, e a meta % é calculada sobre o número errado.

Além disso, hoje **todo** registro em `ote_sales_records` é gravado com `counts_toward_goal = true`. Não respeitamos a flag `products.counts_for_commission` configurada em Produtos, então não há como o vendedor ver "este produto contou / este não contou".

## Plano

### Sprint 1 — Reconciliar OTE com a SSoT (corrige a divergência)

1. **Backend (`calculate-ote`)**
   - Buscar `commercial_won_revenue_view` uma única vez por vendedor (filtrando por `seller_id` + período via `won_at`/`closed_at` e `pipeline_id` em `relevantPipelineIds`), e usar essa lista como fonte única de oportunidades e valores.
   - `total_sales` (revenue) = soma de `commercial_amount` da SSoT, filtrada por `counts_toward_goal` (ver passo 2). Para `goalType='leads'`, manter contagem.
   - Garantir que `ote_sales_records` use exatamente a mesma lista usada no cálculo (sem branch separado lendo `opportunities`), eliminando a possibilidade de divergência futura.
   - Persistir `revenue_confidence` e bloquear cálculo (ou marcar `review_required`) quando a SSoT retornar `review_required=true`, alinhado à core rule de Comissão.

2. **Transparência produto/serviço (`counts_toward_goal` real)**
   - Para cada oportunidade ganha, ler `proposal_items` da `accepted_proposal_id` (campos: `quantity`, `unit_price`, `discount_pct`, `product_id`, `description`) e juntar com `products.counts_for_commission` + `products.type`/`billing_type`.
   - Calcular por linha:
     - `line_amount` proporcional ao `commercial_amount` da SSoT (rateio quando há ajuste de aprovação) — evita inventar valor; mantém a SSoT como teto.
     - `counts_toward_goal_line = products.counts_for_commission`.
   - Persistir em uma nova tabela filha **`ote_sales_record_items`** (`ote_sales_record_id`, `product_id`, `product_name`, `line_amount`, `mrr_amount`, `one_shot_amount`, `counts_toward_goal`, `exclusion_reason`).
   - Atualizar `ote_sales_records`:
     - `sale_value` continua = `commercial_amount` total da proposta (não muda a receita).
     - Novos campos: `eligible_amount` (soma das linhas com `counts_toward_goal=true`), `non_eligible_amount`, `counts_toward_goal` passa a ser `eligible_amount > 0`, `exclusion_reason` preenchido quando 100% não conta (ex.: "Produtos sem `counts_for_commission`").
   - `total_sales` no `ote_monthly_results` = soma de `eligible_amount` (não mais o `commercial_amount` cheio quando há produtos fora da meta).

3. **Fallback seguro**
   - Quando a proposta não tem itens vinculados a `products` (ex.: proposta legada manual), tratar como `counts_toward_goal=true` (comportamento atual) e marcar `exclusion_reason='sem itens vinculados — revisar'` para gerar visibilidade sem quebrar dados antigos.

### Sprint 2 — UI transparente para o vendedor

1. **`OTESellerDetailTab` — header "Vendas e Meta"**
   - Mostrar **dois números explícitos** lado a lado:
     - "Vendas (SSoT)" = soma de `sale_value` da SSoT.
     - "Elegível p/ meta" = `ote_monthly_results.total_sales` (já alinhado).
   - Quando houver diferença, badge azul "Parte do valor não conta para meta — ver detalhamento".

2. **`OTESellerSalesDrilldown`**
   - Adicionar coluna "Itens não elegíveis" (resumo: ex. "2 produtos · R$ 600,00") com tooltip listando os produtos e o motivo (`exclusion_reason`).
   - Expandir linha (accordion) mostrando os `ote_sales_record_items` com badge Sim/Não por produto.
   - Resumo no rodapé já existe ("Elegível para meta" / "Fora da meta") — passa a vir das somas dos itens, não mais por venda inteira.

3. **`VendasRealizadasTable` (Relatórios)**
   - Acrescentar nova coluna **"Elegível meta"** (Sim/Parcial/Não) ao lado de "Comissão", com tooltip mostrando o detalhamento por produto. Mesma fonte (`ote_sales_record_items`) — assim Relatórios e OTE contam a mesma história.

### Sprint 3 — Guardrail e teste

- Estender o vitest `REVENUE_SOURCE_MISMATCH` existente para incluir o par `(ote_monthly_results.total_sales, soma(ote_sales_record_items.eligible))` no mesmo período/vendedor.
- Página admin `/admin/revenue-integrity`: adicionar bloco "OTE × SSoT" com lista de vendedores onde `|total_sales - sum(eligible_amount)| > R$ 0,01`.
- Backfill: rodar `calculate-ote` para todos os meses fechados após o deploy, recriando os `ote_sales_record_items`.

## Riscos

- `total_sales` de meses anteriores vai mudar para vendedores que tinham produtos não elegíveis — comunicar (1 linha no card "Calculado em ...": "Recalculado com regra de produto X meta"). Variável final pode mudar; **não** alterar comissões já `paid`/`approved` automaticamente — apenas marcar `review_required=true` para o admin decidir.
- Rateio por item depende de `proposal_items.unit_price * quantity * (1 - discount)`. Quando a soma dos itens diverge de `commercial_amount` (proposta aprovada por valor manual), aplicar rateio proporcional e logar `warning` em `ote_sales_records.observations`.
- Performance: 1 query extra de `proposal_items` por vendedor com `IN (proposal_ids)` — aceitável (já fazemos query de `opportunities`).

## Arquivos impactados (estimativa)

- `supabase/functions/calculate-ote/index.ts` (refator do cálculo + items)
- Migration: criar `ote_sales_record_items` (+ GRANTs + RLS por `organization_id`); adicionar colunas `eligible_amount`, `non_eligible_amount`, `observations` em `ote_sales_records`.
- `src/hooks/useOTESalesRecords.ts` (incluir items via relação)
- `src/components/ote/OTESellerDetailTab.tsx`, `OTESellerSalesDrilldown.tsx`
- `src/components/reports/VendasRealizadasTable.tsx`
- `src/pages/admin/RevenueIntegrity*` + teste vitest do guardrail

## Fora de escopo

- Não alterar `commercial_won_revenue_view` nem a lógica de `approved_amount` (SSoT permanece intocada).
- Não mexer em comissões já pagas — só sinalizar revisão.
