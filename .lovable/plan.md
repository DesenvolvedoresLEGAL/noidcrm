## Objetivo
Adicionar um relatório forense de **Produtos & Serviços vendidos** dentro do Dashboard de BI (`/app/reports`), respondendo a perguntas como: "quantas vezes o LEGAL™ XGo foi vendido?", "qual a receita por produto?", "qual o mix de venda por pipeline/closer/mês?".

## Onde aparece
Nova categoria **CATÁLOGO** na `ReportTabs`, com a aba **Produtos** (ícone `Package`).
Respeita os filtros globais já existentes: período, pipelines, usuários.

## Fonte de dados (única e canônica)
Tudo deriva de `proposal_items` ∪ `proposals` ∪ `opportunities`:
- Considera apenas oportunidades **`status = 'won'`** e **`deleted_at IS NULL`**
- Data de referência: `opportunities.closed_at` (regra Core já vigente)
- Valor: `proposal_items.total` (já é líquido por item) — coerente com a fonte única de receita líquida implementada no fix de propostas
- Agrupador primário: `product_id` quando existe; fallback para `LOWER(TRIM(name))` (para itens avulsos legados)

## Estrutura do relatório

### 1. KPIs no topo (4 cards)
- Receita total de produtos no período
- Total de unidades vendidas (Σ quantity)
- Nº de produtos distintos vendidos
- Ticket médio por item

### 2. Ranking de Produtos (tabela principal)
Colunas: Produto · Tipo (one_time/recurring) · Vezes vendido · Qtd · Receita · Ticket médio · % do mix · Δ vs. período comparativo · Sparkline mensal
Ordenável, com busca e export CSV.

### 3. Gráficos
- **Top 10 por receita** (barras horizontais)
- **Top 10 por nº de vendas** (barras horizontais)
- **Mix por tipo de cobrança** (donut: one_time vs recurring)
- **Evolução mensal** dos 5 produtos mais vendidos (linha)
- **Receita por pipeline** empilhada por produto (VENDAS, OPERACIONAL, REMARKETING)

### 4. Cross-analysis (acordeões)
- Produto × Closer (quem mais vende cada produto)
- Produto × Conta (clientes que mais compram cada produto)
- Combos frequentes (produtos que aparecem juntos na mesma proposta — frequência simples)

### 5. Painel de Insights IA (opcional, reuso do padrão `AIInsightsPanel`)
Prompt curto enviado para a edge function existente de insights, com o ranking + tendências, retornando 3-5 bullets ("LEGAL™ Core puxa 32% da receita mas só 12% dos deals — oportunidade de upsell", etc.).

## Implementação técnica

### Backend
- **Nova RPC `report_products_sold(p_org uuid, p_start date, p_end date, p_pipelines uuid[], p_users uuid[])`**
  - Retorna linhas agregadas (product_key, name, billing_type, sales_count, qty, revenue, avg_ticket, share_pct)
  - SECURITY DEFINER, `SET search_path = public`, valida `organization_id = current org`
- **RPC `report_products_monthly(...)`** — série mensal para sparklines/linha
- **RPC `report_products_cross(...)`** — produto × closer e produto × conta

Indices auxiliares (se ainda não houver):
- `idx_proposal_items_proposal` (já existe)
- `idx_opportunities_closed_at_status` parcial `WHERE status='won' AND deleted_at IS NULL`

### Frontend
- `src/components/reports/ProductsReport.tsx` — container do relatório
- `src/components/reports/products/ProductsKpiCards.tsx`
- `src/components/reports/products/ProductsRankingTable.tsx` (com export CSV)
- `src/components/reports/products/ProductsCharts.tsx` (Recharts; padrão já usado no projeto)
- `src/components/reports/products/ProductsCrossAnalysis.tsx`
- `src/hooks/useProductsReport.ts` — React Query, chaves: `['products-report', orgId, filtros]`
- Registrar no `ReportTabs.tsx` (nova categoria `catalog`) e no roteador interno de `Reports.tsx`

### Reuso
- Filtros globais: usa o mesmo contexto/props que `GeneralOverview` já consome
- Cores/tipografia: tokens semânticos do design system (sem cores hardcoded)
- Tabela: `@/components/ui/table` + `DataTable` se já existir; senão tabela simples com sort local

## Arquivos impactados
- ✏️ `src/components/reports/ReportTabs.tsx` (nova aba + categoria)
- ✏️ `src/pages/Reports.tsx` (render do novo report)
- ➕ 5 componentes novos em `src/components/reports/products/`
- ➕ `src/hooks/useProductsReport.ts`
- ➕ Migration com 3 RPCs (`report_products_sold`, `report_products_monthly`, `report_products_cross`)

## Riscos & mitigação
- **Itens legados sem `product_id`**: agrupar por nome normalizado evita perda; mostrar badge "sem catálogo" quando aplicável
- **Performance**: RPCs com agregação no Postgres + índice em `closed_at` parcial
- **Multi-tenant**: todas as RPCs filtram por `organization_id` derivado do JWT (não confia em parâmetro)
- **Soft-delete**: rigorosamente excluído (regra Core)
- **Win Rate / Receita**: não toca nas fórmulas existentes — apenas lê

## Próximos passos
Aprovar o plano → migração das RPCs → componentes → QA com dados reais (validar que LEGAL™ XGo aparece com 20 vendas e ~R$ 21.765, conforme amostra).
