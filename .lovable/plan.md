

## Relatório de Oportunidades por Origem

### O que será criado
Uma nova aba **"Origens"** no Dashboard de BI, na categoria **Oportunidades**, com análise completa de onde vêm as oportunidades.

### Dados disponíveis
A tabela `opportunities` tem a coluna `origem` (string livre). O relatório agrupará por esse campo.

### Componentes

#### 1. Hook `useOriginReportData()` em `src/hooks/useReportsData.ts`
- Query em `opportunities` com os mesmos filtros (período, pipeline, usuário, visibilidade de equipe)
- Seleciona: `id, origem, status, valor_previsto, owner_user_id, pipeline_id, created_at`
- Agrupa por `origem` e calcula para cada uma:
  - Total de oportunidades
  - Quantidade e valor de ganhas (`won`)
  - Quantidade e valor de perdidas (`lost`)
  - Em aberto (nem won nem lost)
  - Taxa de conversão por origem
  - Ticket médio por origem

#### 2. Componente `src/components/reports/OriginReport.tsx`
Layout com:
- **KPIs no topo**: Total de origens ativas, origem com mais deals, origem com maior conversão, origem com maior valor
- **Gráfico de barras horizontal**: quantidade de oportunidades por origem (todas)
- **Gráfico de barras empilhadas**: ganhas vs perdidas vs abertas por origem
- **Tabela resumo**: origem | total | ganhas | perdidas | abertas | valor total | taxa conversão | ticket médio
- **Gráfico de pizza**: distribuição percentual por origem

#### 3. Registrar a aba em `ReportTabs.tsx`
- Adicionar `{ id: 'origins', label: 'Origens', icon: Compass, category: 'opportunities' }` ao array `reportTabs`

#### 4. Registrar no `Reports.tsx`
- Importar `OriginReport` e adicionar case `'origins'` no `renderReport()`

### Arquivos impactados
- `src/hooks/useReportsData.ts` — novo hook `useOriginReportData`
- `src/components/reports/OriginReport.tsx` — **novo**
- `src/components/reports/ReportTabs.tsx` — adicionar aba
- `src/pages/Reports.tsx` — adicionar case no switch

### Padrão seguido
Mesmo padrão de `LostReasons` e `ProcessedOpportunities`: usa `useReportFiltersContext`, `useTeamVisibility`, filtra por período/pipeline/usuário, usa Recharts para gráficos.

