## Objetivo

A aba **Visão Geral** precisa responder em até 5 segundos: por que estamos perdendo, quanto custa, e o que fazer agora. Mudança apenas na aba "Visão Geral" — sem refatoração estrutural fora dela.

## Escopo (arquivos)

- `src/components/intelligence/winloss/WinLossKPIStrip.tsx` — rótulos dos cards.
- `src/components/intelligence/winloss/tabs/WinLossOverviewTab.tsx` — reordenação, novos blocos, regras de filtro.
- `src/components/intelligence/winloss/tabs/LossAnalysisSection.tsx` — substituir "Fatores de Perda" por bloco executivo "Por que estamos perdendo" e enriquecer "Top Motivos de Perda" com valor perdido. Remover "Perdas por Categoria" da aba (já não está nesta seção, mas vou retirá-la do Overview).
- `src/components/intelligence/winloss/MonthlyPulseCards.tsx` — exibir variação vs mês anterior, valor perdido e ganhos/perdas (já tem maior parte; só ajuste de copy).
- **Novo:** `src/components/intelligence/winloss/AIDiagnosisCard.tsx` — Diagnóstico Executivo da IA (cliente-side, derivado dos dados já carregados, sem nova chamada de IA — lê `data.lossReasonsByMacro`, `lostValue`, `avgCycleWon/Lost`, `factors`).
- **Novo:** `src/components/intelligence/winloss/MonthSignalsCard.tsx` — "Sinais do Mês" (mostrado só com filtro = `month`).
- `src/pages/intelligence/WinLossHub.tsx` — passar `timeframe` para `WinLossOverviewTab`.

## 1. Renomear cards do topo (KPI Strip)

Em `WinLossKPIStrip.tsx`, sobrepor labels (apenas para `pipeline_type='sales'`, mantendo terminologia atual para qualification/onboarding):

- "Deals Ganhos" → "Ganhos"
- "Deals Perdidos" → "Perdidos"
- "Ticket Médio Won" → "Ticket Médio Ganho"
- "Ciclo Médio (dias)" → "Ciclo Médio Geral"

O ciclo médio passa a ser média ponderada de `avgCycleWon` e `avgCycleLost` quando ambos existirem (atualmente só mostra `avgCycleWon`).

## 2. Nova ordem da Visão Geral

`WinLossOverviewTab` renderiza, nesta ordem:

1. (Header e Filtros e KPI Strip continuam acima, no `WinLossHub` — não muda.)
2. **Diagnóstico Executivo da IA** (novo)
3. **Alertas Inteligentes** (subir — hoje está no fim)
4. **Pulso Mensal** (condicional ao filtro)
5. **Análise de Perdas** (com "Por que estamos perdendo" + "Top Motivos de Perda" enriquecidos; sem "Perdas por Categoria")
6. **Análise de Ganhos**
7. **Ciclo de Venda**
8. **Tendência de Motivos de Perda** ou **Sinais do Mês** (condicional)

Remover do Overview: `LossReasonsByCategoryChart` ("Perdas por Categoria"). Mantém-se disponível em outras abas (Revenue Impact / Relatório).

## 3. Diagnóstico Executivo da IA (novo bloco)

Componente client-side determinístico (sem nova chamada à IA) que lê `WinLossDataResult` e gera:

- **Principal motivo de perda**: `lossReasonsByMacro[0]` (categoria + label).
- **Valor perdido associado**: soma `final_value` das `losses` cuja categoria == top macro.
- **Δ ciclo (perda − ganho)**: `avgCycleLost - avgCycleWon`.
- **Recomendação**: regra simples por categoria top:
  - `timing` → "ativar alerta para oportunidades paradas > 7 dias e playbook de retomada por urgência"
  - `competition` → "revisar diferenciais vs concorrentes ranqueados em Perdas por Concorrente"
  - `price` → "revisar política comercial / aprovar desconto para faixa X"
  - `feature/operational/internal/no_fit/other` → mensagens análogas pré-definidas.
- **Severidade**: `low | medium | high | critical` calculada por `(lostValue / (wonValue+lostValue))` + share do top motivo.

Copy padrão exatamente no formato do enunciado, com badge de severidade colorida.

## 4. Alertas Inteligentes acima

`SmartAlertsCard` passa do bloco "Análise Avançada" para logo após o Diagnóstico Executivo. Largura full.

## 5. Remover "Perdas por Categoria"

Apagar `LossReasonsByCategoryChart` do JSX de `WinLossOverviewTab`. O componente continua existindo para reuso em outras abas.

## 6. "Por que estamos perdendo" (substitui "Fatores de Perda")

Em `LossAnalysisSection.tsx`, terceiro card vira "Por que estamos perdendo". Cada linha (categoria) mostra:

- Ícone + label da categoria
- `% das perdas` (= count/totalFactors)
- `quantidade de deals`
- `valor perdido estimado` (somar `final_value` das `losses` cuja categoria casa)
- `tendência vs período anterior` — calculada comparando contagem da categoria nos últimos 30 dias do range vs 30 dias anteriores (delta em pp). Se não houver dados suficientes, mostrar "—".
- `ação recomendada` — micro-copy curta (1 linha) por categoria, mesma tabela do Diagnóstico.

## 7. "Top Motivos de Perda" enriquecido

Mesmo componente. Para cada `lossReasonsByMacro[i]` exibir, ao lado do contador:

`{label} — {count} deals | {pct}% | {formatCurrency(valorPerdido)} perdidos`

`valorPerdido` calculado a partir das `losses` filtradas pela categoria + specifics.

## 8. Regra do Pulso Mensal

`WinLossOverviewTab` recebe `timeframe`. Condicional:

- `timeframe === 'month'` → não renderiza `MonthlyPulseCards`.
- `quarter | semester | year | custom` → renderiza, mostrando todos os meses com: win rate, ganhos, perdas, valor perdido, variação vs mês anterior (`prevWinRate` já existe; adicionar valor perdido visível).

## 9. Regra da Tendência

- `timeframe !== 'month'` → mantém `LossReasonsTrendChart`.
- `timeframe === 'month'` → renderiza novo `MonthSignalsCard` com até 3 sinais derivados:
  1. Concorrência: % das perdas com `competitor` preenchido.
  2. Categoria que virou principal causa (top atual diferente do top do período anterior).
  3. Categoria que mais subiu em pontos percentuais vs período anterior.

Cada sinal: ícone + frase curta no formato do enunciado.

## 10. Visual

Manter cards/tipografia atuais (`Card`, `Badge`, `Progress`). Sem novos componentes visuais pesados. Severidade usa `bg-{rose|amber|yellow|emerald}-500/10` já em uso.

## Critério de sucesso

- Ordem e nomes batem com o enunciado.
- Filtro "Mês" esconde Pulso Mensal e mostra "Sinais do Mês".
- Filtros maiores mostram Pulso Mensal e Tendência.
- Diagnóstico e Alertas Inteligentes ficam visíveis sem rolar até o fim.
- "Por que estamos perdendo" mostra valor perdido e ação recomendada por linha.
- Nenhuma chamada extra ao banco — tudo derivado de `useWinLossData`.

## Riscos

- Baixo. Apenas presentation/derivações no frontend. Sem mudanças em hooks de dados, RLS, edge functions ou schema.
- Cuidado para não quebrar as outras abas que reusam `LossAnalysisSection` — só esta seção é usada na Visão Geral, então a mudança fica isolada.
