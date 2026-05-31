
# Inteligência Semântica das Perdas — Motor da Visão Geral do Win/Loss Hub

A IA semântica é o motor invisível da Visão Geral. Não cria aba nova. Alimenta os blocos executivos para o gestor responder em 30s: por que perdemos, o que é inconsistente, quanto isso vale, o que fazer agora.

## Backend (inalterado vs. plano anterior)

### Migration
- Tabela `loss_semantic_analyses` (1 linha por oportunidade perdida), com:
  - `source_texts jsonb` (vendedor + cliente + free_text, com origem)
  - `ai_detected_loss_category`, `ai_detected_loss_reason`, `ai_detected_competitor`
  - `ai_confidence_score` (0-100), `diagnosis_quality_score` (0-100)
  - `seller_customer_gap bool`, `gap_explanation text`
  - `recommended_action text`, `ai_summary_short text` (≤160c, LGPD)
  - `model_used`, `rule_version`, `context_signature`, timestamps
  - GRANTs + RLS por organização
- Coluna `opportunities.is_recoverable boolean`

### View `v_loss_semantic_v2`
Join `v_loss_classification_v2` + `loss_semantic_analyses` + excerpts truncados de `loss_comment` e `proposals.declined_reason` (≤160c). Esta é a única fonte usada pelos blocos da Visão Geral.

### Edge function `ai-loss-semantic-analyzer`
- OpenAI direto (`gpt-5-mini`), wrapper `_shared/ai-client.ts`.
- Cache via `context_signature`; reprocessa só com `force_refresh`.
- `diagnosis_quality_score` calculado deterministicamente (sem custo de IA), critérios já listados no enunciado original.
- Nunca escreve em `loss_reason_id`, `client_loss_reason_id` ou `win_loss_records`.

### Helpers TS
- `src/lib/winloss/diagnosisQuality.ts` (puro + testes)
- `src/services/winloss/lossSemantic.ts`
- `src/hooks/useLossSemantic.ts` (período + filtros do Hub)
- `useWinLossData.ts` passa a expor `semantic` (não-quebra de consumidores).

## Frontend — Visão Geral (única superfície)

Sem aba nova. Sem poluição. Ordem dos blocos na Visão Geral:

```text
1. Diagnóstico Executivo da IA   (existente, reforçado)
2. Alertas Inteligentes          (subir para o topo)
3. CRM Trust Score + Receita Recuperável  (linha de 2 KPIs compactos)
4. Motivos Ocultos               (declarado vs inferido)
5. Top Motivos de Perda          (existente, com badge Gap)
6. Gap Vendedor x Cliente        (bloco compacto)
7. Radar Competitivo             (existente "Perdas por Concorrente" enriquecido)
8. Drivers de Vitória            (novo, lado dos ganhos)
9. Pulso Mensal                  (existente, sem filtro Mês)
10. Análise de Perdas / Ganhos / Ciclo  (mantidos)
11. Tendência ou Sinais do Mês   (toggle Declarado vs Inferido IA)
```

### 1. Diagnóstico Executivo da IA — `AIDiagnosisCard.tsx` (reforçar)
Substituir o gerador atual por uma síntese que cruza humano × IA:
- principal motivo declarado vs principal motivo inferido
- valor perdido associado ao gap
- maior gap vendedor × cliente do período
- recomendação principal (mais frequente em `recommended_action`)
- severidade já existente (baixo/médio/alto/crítico) recalculada por valor + gap%
Copy: "No período, o CRM registra X como principal motivo, mas a IA identificou Y como causa real dominante. Esse gap representa R$ N. Recomendação: …"

### 2. Alertas Inteligentes — `SmartAlertsCard.tsx`
Subir para logo após o Diagnóstico. Adicionar regras semânticas:
- `qualidade média < 40` em ≥30% das perdas → "X% das perdas estão com diagnóstico fraco"
- gap dominante (ex.: Preço declarado, Timing inferido) acima de 20% → alerta
- concorrente em alta vs período anterior
- "R$ X em receita recuperável detectada"
- "CRM Trust Score abaixo de 70%"

### 3. CRM Trust Score + Receita Recuperável — novo `CrmTrustAndRecoverableStrip.tsx`
Uma linha, dois cards compactos:
- **CRM Trust Score 0-100** = média ponderada de: qualidade média do diagnóstico (30) + % perdas com texto suficiente (20) + (100 - % gap) (20) + % perdas com IA alta confiança (15) + cobertura de análise (15).
- **Receita Recuperável**: soma de `valor_previsto` (líquido) onde `is_recoverable=true` OR IA detectou recuperabilidade + qtd oportunidades + principal causa + ação recomendada.

### 4. Motivos Ocultos — novo `HiddenReasonsBlock.tsx`
Duas colunas lado a lado: ranking "Declarado" (a partir de `loss_reasons` selecionados) × ranking "Inferido pela IA" (a partir de `ai_detected_loss_category` agregado), com % e valor. Mostra explicitamente quando o time está resolvendo o problema errado.

### 5. Top Motivos de Perda — `LossAnalysisSection.tsx` (estender)
Por motivo: qtd, %, valor perdido, motivo declarado × motivo inferido quando divergente, badge "Gap" quando aplicável.

### 6. Gap Vendedor × Cliente — novo `SellerCustomerGapBlock.tsx`
Compacto:
- qtd de perdas com gap, % sobre analisadas, top 3 gaps mais comuns (par "declarado → inferido"), valor perdido associado.

### 7. Radar Competitivo — substitui o atual "Perdas por Concorrente"
`CompetitiveRadarBlock.tsx`. Por concorrente (mescla `win_loss_records.competitor` + `ai_detected_competitor`):
- qtd perdas, valor perdido, motivo dominante (do bloco semântico), tendência vs período anterior, confiança da IA.

### 8. Drivers de Vitória — novo `WinDriversBlock.tsx`
Usa `win_loss_records` de outcome `won` + `win_reason_id` + `customer_feedback` + `strengths_mentioned`:
- principais fatores (top 5) que fazem ganhar, valor ganho associado, recorrência por vendedor/pipeline, recomendação para repetir o padrão (ex.: "Ganhos mencionam agilidade e suporte 3,2× mais que perdas").

### 9. Tendência / Sinais do Mês — `LossReasonsTrendChart.tsx` (estender)
Adicionar toggle "Motivo informado / Motivo inferido pela IA". Regra de filtro já existente (Mês → MonthSignalsCard; demais → tendência) mantida.

### 10. Detalhe da oportunidade — `OpportunityHistoryTab.tsx`
Único lugar com texto completo (LGPD):
- texto original completo + origem (vendedor / cliente)
- motivo humano vs motivo inferido pela IA
- confiança, gap, ação recomendada
- botão "Reprocessar análise" (`force_refresh`)

### LGPD
Dashboards do Hub só renderizam `ai_summary_short` / `seller_diagnosis_excerpt` / `customer_comment_excerpt` (≤160c). `loss_semantic_analyses.source_texts` só é lido em escopo autenticado da própria oportunidade (RLS).

## Não fazer (reforço)
- Não criar aba "Inteligência Semântica".
- Não substituir motivo humano nem alterar `loss_reason_id` / `client_loss_reason_id`.
- Não alterar `win_loss_records`.
- Não tocar em OTE, Forecast, Vendas Realizadas, `commercial_won_revenue_view`.
- Sem cards redundantes; cada bloco responde a uma das 4 perguntas do gestor.

## Ordem de execução
1. Migration (`loss_semantic_analyses`, `is_recoverable`, view `v_loss_semantic_v2`, GRANTs, RLS)
2. `diagnosisQuality.ts` + testes
3. Edge function `ai-loss-semantic-analyzer` com cache por `context_signature`
4. `lossSemantic` service + `useLossSemantic` hook + extensão de `useWinLossData`
5. Reforço de `AIDiagnosisCard` e `SmartAlertsCard`
6. Novos blocos: CRM Trust + Recuperável, Motivos Ocultos, Gap, Radar Competitivo, Drivers de Vitória
7. Estender Top Motivos e Tendência (toggle)
8. Bloco "Análise Semântica da Perda" no detalhe da oportunidade + botão Reprocessar
9. Memória `mem://business-rules/winloss/semantic-loss-intelligence` + index
10. `tsc --noEmit` limpo

## Resultado
A Visão Geral entrega resposta executiva em 30s, com IA semântica como motor invisível. Nenhum dado humano é apagado; tudo é enriquecimento rastreável.
