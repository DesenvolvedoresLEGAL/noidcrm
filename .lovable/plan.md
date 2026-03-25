

## Problema

O Forecast está incluindo oportunidades **soft-deleted** (como "BRANDY NO SALÃO MOTOPEÇAS 2026") porque nenhuma das 3 queries no `useForecastData.ts` filtra `deleted_at IS NULL`. Isso polui todos os KPIs, cenários, riscos e tabelas de deals.

## Plano

### Arquivo: `src/hooks/useForecastData.ts`

Adicionar `.is('deleted_at', null)` nas 3 queries de oportunidades:

1. **Query de oportunidades abertas** (linha ~257, após `.not('pipeline_id', 'is', null)`)
   - Adicionar: `.is('deleted_at', null)`

2. **Query de oportunidades ganhas** (linha ~424, após `.eq('status', 'won')`)
   - Adicionar: `.is('deleted_at', null)`

3. **Query de oportunidades perdidas** (linha ~471, após `.eq('status', 'lost')`)
   - Adicionar: `.is('deleted_at', null)`

### Resultado

Oportunidades excluídas (soft-delete) deixarão de contaminar:
- KPIs (Meta, Fechado, Commit, Best Case, Cobertura, Win Rate)
- Cenários de Forecast (Pessimista, Realista, Otimista, Melhor Caso)
- Deal Inspection (tabela de deals)
- Deals em Risco
- Forecast por Vendedor
- Qualidade dos Dados

Nenhuma outra mudança necessária -- todos os componentes downstream consomem os dados já filtrados pelo hook.

