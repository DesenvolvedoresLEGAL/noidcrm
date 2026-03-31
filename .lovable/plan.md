

# Corrigir Relatório OTE: Separar metas por tipo e usar meta configurada para gestor

## Problemas identificados

1. **BDR/Hunter (leads) misturados com Closers (R$)**: A tabela "Vendedores Individuais" exibe todos juntos, mostrando metas de leads como se fossem R$. O KPI "Vendas Individuais" soma leads com R$ indevidamente.

2. **Meta do gestor = soma das metas do time**: Na edge function (linha 175-184), `dynamicTeamGoal` é calculado como soma das metas individuais dos membros. Deveria usar `sales_config.monthly_revenue_target` (R$ 200.000 configurado em Metas).

## Alterações

### 1. Migration — adicionar `goal_type` em `ote_monthly_results`
```sql
ALTER TABLE ote_monthly_results ADD COLUMN goal_type text NOT NULL DEFAULT 'revenue';
```
Para que cada resultado carregue o tipo de meta do nível.

### 2. Edge function `calculate-ote/index.ts`
- **Salvar `goal_type`** no resultado: `goal_type: config.ote_level?.goal_type || 'revenue'`
- **Meta do gestor**: buscar `sales_config.monthly_revenue_target` e usar como `goalAmount` para team targets ao invés da soma dinâmica. Se houver `custom_goal_override`, ele prevalece.

### 3. `OTEOverviewTab.tsx` — separar tabelas por tipo de meta
- Dividir `individualResults` em dois grupos:
  - **Pré-vendas (leads)**: `goal_type === 'leads'` — tabela separada com colunas "Meta (leads)", "Leads Qualificados", sem formatação R$
  - **Vendedores (R$)**: `goal_type === 'revenue'` — tabela atual com formatação R$
- KPIs de "Vendas Individuais" e "Média % Meta" consideram apenas tipo `revenue`
- Subtotal da seção leads mostra quantidade, não R$

### 4. `OTEMonthlyResult` interface
- Adicionar `goal_type?: 'revenue' | 'leads'` na interface

## Arquivos modificados
1. Migration SQL (coluna `goal_type` em `ote_monthly_results`)
2. `supabase/functions/calculate-ote/index.ts` (salvar goal_type, meta gestor da config)
3. `src/hooks/useOTEData.ts` (interface)
4. `src/components/ote/OTEOverviewTab.tsx` (separar tabelas, KPIs corretos)

