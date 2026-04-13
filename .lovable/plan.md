

# Win/Loss Hub PRIME — Redesign de Classe Mundial

## Resumo

Refatorar o Win/Loss Hub de um arquivo monolítico de 1700 linhas para uma arquitetura componentizada, com contexto dinâmico por pipeline (em vez de tipos fixos), filtros temporais, novos módulos analíticos inspirados nas melhores práticas de mercado (Clozd, User Intuition, Klue), e storytelling visual que transforma dados em inteligência acionável.

## Mudanças Conceituais

### 1. Contexto por Pipeline (não por tipo)
O seletor atual "Leads Desqualificados / Deals Perdidos / Churns" é substituído por um **seletor de pipeline real** que lista os pipelines da organização. Cada pipeline já tem um `pipeline_type` que determina a terminologia automaticamente. Isso resolve o problema do usuário: PRÉ VENDAS mostra qualificação, Vendas mostra win/loss de propostas, e Produção (operacional) mostra análise operacional. Churn só aparece se existir pipeline de renewal/cs.

### 2. Filtro Temporal
Adicionar seletor de período (Mês atual, Trimestre, Semestre, Ano, Período personalizado) em vez do fixo "startOfYear".

### 3. Novos Módulos Analíticos (best practices)

| Módulo | Inspiração | O que faz |
|--------|-----------|-----------|
| **Win/Loss Quadrant** | Unkover | Matriz 2x2: Deal Size × Win Rate por segmento/vendedor |
| **Decision Driver Breakdown** | User Intuition | Mostra "motivo declarado vs motivo real" quando há dados de entrevista + CRM |
| **Competitive Battlecard Index** | Klue/Crayon | Win rate por concorrente com tendência |
| **Time-to-Loss Analysis** | Best practice | Em qual semana do ciclo os deals morrem? Histogram |
| **Seller Performance Matrix** | RevOps | Win rate por vendedor com volume e ticket médio |
| **Monthly Pulse** | Continuous program | Cards compactos mês a mês com trend arrows |

### 4. Tabs Reorganizadas

```text
Visão Geral → Análise de Perdas + Ganhos + Ciclo + Análise Avançada (tudo junto, scrollável)
Competitivo → Concorrentes + Battlecard Index + Win rate por competitor
Vendedor vs Cliente → Mantém (já existe)
Sellers → Performance matrix por vendedor
Revenue Impact → Mantém (já existe)  
Recomendações → Mantém mas enriquecido com routing por área
```

## Arquitetura de Componentes

```text
WinLossHub.tsx (orquestrador ~300 linhas)
├── WinLossContextSelector.tsx (pipeline picker + período)
├── WinLossKPIStrip.tsx (4-6 KPI cards)
├── tabs/
│   ├── WinLossOverviewTab.tsx
│   │   ├── LossAnalysisSection.tsx (motivos, fatores, feedback recusas)
│   │   ├── WinAnalysisSection.tsx (motivos ganho, diferenciais, feedback clientes)
│   │   ├── SalesCycleSection.tsx (ciclo won vs lost)
│   │   ├── MonthlyPulseCards.tsx (evolução mensal compacta)
│   │   └── AdvancedAnalysisSection.tsx (alertas + categoria + tendência)
│   ├── WinLossCompetitiveTab.tsx (concorrentes + battlecard + win rate por competitor)
│   ├── WinLossSellerTab.tsx (performance matrix por vendedor)
│   ├── SellerVsClientTab.tsx (wrapper existente)
│   ├── WinLossInterviewsTab.tsx (entrevistas extraído)
│   ├── WinLossRevenueTab.tsx (revenue impact extraído)
│   └── WinLossRecommendationsTab.tsx (recomendações extraído)
├── hooks/
│   └── useWinLossData.ts (query + transformação extraída)
```

## Detalhes Técnicos

### Hook `useWinLossData.ts`
Extrai toda a lógica de query (linhas 126-374 do atual) para um hook dedicado que aceita `pipelineId` e `dateRange` como parâmetros. Retorna os mesmos dados tipados mas filtrados por pipeline específico e período.

### `WinLossContextSelector`
- Dropdown/select de pipelines reais da organização (query `pipelines` com `organization_id`)
- Cada pipeline mostra nome + badge com tipo (Pré Vendas, Vendas, Operacional)
- Seletor de período: Mês / Trimestre / Semestre / Ano / Custom
- A terminologia (won/lost labels) é derivada automaticamente do `pipeline_type`

### `MonthlyPulseCards`
Cards compactos mostrando mês a mês: wins, losses, win rate, com trend arrows comparando ao mês anterior. Scroll horizontal.

### `WinLossCompetitiveTab`
- Tabela de concorrentes com colunas: Nome, Deals Perdidos, Valor Perdido, Win Rate contra, Tendência (spark)
- Expandível: ao clicar num concorrente, mostra os deals perdidos e motivos

### `WinLossSellerTab`
- Tabela ranking: Vendedor, Deals Won, Deals Lost, Win Rate, Ticket Médio, Ciclo Médio
- Cores condicionais (verde >50% win rate, vermelho <25%)
- Útil para coaching e identificação de gaps

### Sem mudança de banco de dados
Todas as informações já existem nas tabelas atuais (`opportunities`, `win_loss_records`, `loss_reasons`, `win_reasons`, `pipelines`, `profiles`). Nenhuma migration necessária.

## Files

| Action | File |
|--------|------|
| Create | `src/hooks/useWinLossData.ts` |
| Create | `src/components/intelligence/winloss/WinLossContextSelector.tsx` |
| Create | `src/components/intelligence/winloss/WinLossKPIStrip.tsx` |
| Create | `src/components/intelligence/winloss/MonthlyPulseCards.tsx` |
| Create | `src/components/intelligence/winloss/tabs/WinLossOverviewTab.tsx` |
| Create | `src/components/intelligence/winloss/tabs/LossAnalysisSection.tsx` |
| Create | `src/components/intelligence/winloss/tabs/WinAnalysisSection.tsx` |
| Create | `src/components/intelligence/winloss/tabs/SalesCycleSection.tsx` |
| Create | `src/components/intelligence/winloss/tabs/WinLossCompetitiveTab.tsx` |
| Create | `src/components/intelligence/winloss/tabs/WinLossSellerTab.tsx` |
| Create | `src/components/intelligence/winloss/tabs/WinLossInterviewsTab.tsx` |
| Create | `src/components/intelligence/winloss/tabs/WinLossRevenueTab.tsx` |
| Create | `src/components/intelligence/winloss/tabs/WinLossRecommendationsTab.tsx` |
| Rewrite | `src/pages/intelligence/WinLossHub.tsx` — orquestrador slim (~300 linhas) |
| Keep | `src/components/intelligence/SellerVsClientReasonsChart.tsx` — usado como está |
| Keep | `src/components/intelligence/LossReasonsTrendChart.tsx` — usado como está |
| Keep | `src/components/intelligence/LossReasonsByCategoryChart.tsx` — usado como está |
| Keep | `src/components/intelligence/SmartAlertsCard.tsx` — usado como está |

