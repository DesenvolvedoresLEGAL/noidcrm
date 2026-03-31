

# Ajustar Dashboard SDR para Metas de Leads Qualificados

## Problema
O dashboard que o SDR vê (RepDashboard) foi desenhado para Closers (vendedores de receita). Todos os KPIs, PACE e atividades diárias mostram valores em R$ e métricas de vendas (propostas, oportunidades abertas, receita). Para SDRs com `goal_type === 'leads'`, o dashboard precisa mostrar **quantidade de leads qualificados**, não valores monetários.

## Causa raiz
1. **`useRepPACE.ts`** — calcula `achieved` somando `commission_value`/`valor_previsto` de oportunidades "won" em pipelines de **vendas**. Para SDRs, deveria contar oportunidades "won" em pipelines de **qualificação** (cada won = 1 lead qualificado).
2. **`RepPACECard.tsx`** — formata tudo com `formatCurrencyBR()`, ignorando `goalType`.
3. **`RepKPICards.tsx`** — mostra "Oportunidades Abertas" e "Propostas (7 dias)" que são irrelevantes para SDR.
4. **`RepDailyActivities.tsx`** — mostra "Vendas" e "Receita do Dia" que não fazem sentido para SDR.

## Alterações

### 1. `src/hooks/useRepPACE.ts` — Buscar leads qualificados para SDRs
- Quando `goalType === 'leads'`, buscar oportunidades **won** em pipelines de **qualificação** (não de vendas).
- `achieved` = **count** dessas oportunidades (não soma de valores).
- `projection`, `dailyTarget`, `paceVariance` calculados com quantidades, não R$.

### 2. `src/components/dashboards/rep/RepPACECard.tsx` — Formatar por tipo
- Usar `paceData.goalType` para decidir formatação:
  - `leads`: `"X leads"` / `"X de Y leads"`
  - `revenue`: `formatCurrencyBR(X)`

### 3. `src/components/dashboards/rep/RepKPICards.tsx` — KPIs adaptativos
- Quando `goalType === 'leads'`, substituir KPIs irrelevantes:
  - "Oportunidades Abertas" → **"Leads em Qualificação"** (oportunidades abertas em pipelines de qualificação)
  - "Propostas (7 dias)" → **"Leads Qualificados (7 dias)"** (won em qualificação últimos 7 dias)
  - Meta do Mês e Projeção já formatam por goalType (manter)
  - PACE Diário já formata por goalType (manter)

### 4. `src/components/dashboards/rep/RepDailyActivities.tsx` — Adaptar para SDR
- Quando `goalType === 'leads'`:
  - Remover "Vendas" e "Receita do Dia"
  - Manter "Ligações" e "Leads"
  - Adicionar "Contatos" e "Agendamentos" como métricas SDR
- A seção "Receita do Dia" só aparece se `goalType === 'revenue'`

### 5. `src/hooks/useRepDashboard.ts` — Dados adaptativos
- Adicionar retorno de `goalType` no hook para que os componentes filhos saibam o tipo
- Quando `goalType === 'leads'`: buscar contagem de leads em qualificação em vez de pipeline de vendas

## Arquivos modificados
1. `src/hooks/useRepPACE.ts` — lógica de achieved por count para leads
2. `src/components/dashboards/rep/RepPACECard.tsx` — formatação condicional
3. `src/components/dashboards/rep/RepKPICards.tsx` — KPIs adaptativos por goalType
4. `src/components/dashboards/rep/RepDailyActivities.tsx` — métricas SDR vs Closer
5. `src/hooks/useRepDashboard.ts` — dados adaptativos por goalType

