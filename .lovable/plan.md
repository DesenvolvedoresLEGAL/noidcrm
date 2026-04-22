

# Plano de Refinamento — Lead Score (Fase 1)

## Diagnóstico Confirmado

Após varredura no banco e código:

- **3.862 contas ativas** vs **500 mostradas** → o hook `useLeadScoreAnalytics` tem `.limit(500)` hardcoded, e a edge function `calculate-account-scores` também limita em 500 no modo `recalculateAll`.
- **Segmentos duplicados no banco**: existem `Serviços` (348) + `servicos` (15), `Tecnologia` (1) + `tecnologia` (5), `Indústria` (32) + `industria` (1), `Outro` (1) + `outro` (2). É problema de dado, não só de UI.
- **Recalcular Leads quebra** em escala: roda 3.862 contas em loop sequencial dentro de uma única edge function (timeout garantido).
- **Tabela limitada a 50** com `.slice(0, 50)` sem paginação.
- **Insights sem ação**: cards têm `cursor-pointer` decorativo, sem onClick que filtre a tabela ou navegue.
- **Cálculo do Lead Score** atual: fórmula determinística simples (`FIT × 0.4 + INTENT × 0.6`). Sem ML, sem RAG, sem contexto financeiro/contatos/oportunidades enriquecido.

---

## Ajustes Propostos

### 1. Corrigir contagem real (3.862 contas)

**`src/hooks/useLeadScoreAnalytics.ts`**
- Trocar `.limit(500)` por busca paginada de **todas as contas ativas** da organização (loop em páginas de 1.000 via `range()` até esgotar).
- Adicionar `totalAccountsInOrg` separado via `count: 'exact', head: true` para o KPI "Total".
- Normalizar `segmento` ao montar `segmentStats` e `filterOptions` (trim + capitalização consistente: `Serviços`, `Tecnologia`, etc.) usando um mapa de aliases.

### 2. Padronização de Segmentos (banco + UI)

**Migração SQL** para consolidar duplicatas no banco:
```sql
UPDATE accounts SET segmento = 'Serviços'   WHERE lower(trim(segmento)) IN ('servicos','serviços','serviço','servico');
UPDATE accounts SET segmento = 'Tecnologia' WHERE lower(trim(segmento)) IN ('tecnologia','tech','ti');
UPDATE accounts SET segmento = 'Indústria'  WHERE lower(trim(segmento)) IN ('industria','indústria');
UPDATE accounts SET segmento = 'Outro'      WHERE lower(trim(segmento)) IN ('outro','outros');
UPDATE accounts SET segmento = 'Saúde'      WHERE lower(trim(segmento)) IN ('saude','saúde');
```
+ trigger `BEFORE INSERT OR UPDATE` em `accounts.segmento` que aplica `initcap(trim())` e normaliza acentos via mapa.

### 3. Paginação real na tabela

**`src/components/scoring/lead/LeadScoreTable.tsx`**
- Remover `.slice(0, 50)`.
- Adicionar paginação local: 25 / 50 / 100 por página, com setas `<` `>` e indicador "1 de N".
- Filtros (grade, segmento, tamanho, busca) aplicados antes da paginação.

### 4. Recalcular Scores funcional para 3.862 contas

**`supabase/functions/calculate-account-scores/index.ts`**
- Remover `.limit(500)` no modo `recalculateAll`.
- Implementar **processamento em batch + background**: dispara job e responde 202 imediatamente; usa `EdgeRuntime.waitUntil()` para processar em lotes de 100 contas com `Promise.all` concorrente.
- Adicionar parâmetro `organizationId` obrigatório (multi-tenant safe).
- Persistir progresso em tabela `score_recalc_jobs` (status, processed_count, total).

**`src/components/scoring/lead/LeadScoreDashboard.tsx`**
- Botão mostra toast inicial + polling do job para feedback "Processando 1.234 / 3.862…".

### 5. Insights acionáveis

**`src/components/scoring/lead/LeadScoreInsights.tsx`**
- Cada insight ganha `onClick` que aplica filtro correspondente na tabela:
  - "X leads quentes" → filtra `grade=A` e rola até a tabela
  - "Leads com alto interesse" → filtro custom (FIT<50, INTENT≥70)
  - "X% leads frios" → filtra `grade IN (D,F)`
  - "Leads prontos para nutrição" → filtra `grade=B`
- Adicionar botão secundário "Exportar lista (CSV)" em cada insight.

### 6. Detalhamento do Cálculo (transparência)

**Novo componente `LeadScoreFormulaInfo.tsx`** acessível via ícone `Info` no header do dashboard. Mostra modal explicando:

```text
LEAD SCORE = (FIT × 0.4) + (INTENT × 0.6)

FIT (perfil ideal — 0-100):
  ├─ Segmento premium ........ até 25 pts
  ├─ Tamanho da empresa ...... até 20 pts
  ├─ Capital social .......... até 15 pts
  ├─ Localização (SP/RJ) ..... até 15 pts
  └─ Dados completos ......... até 25 pts

INTENT (engajamento — 0-100):
  ├─ Cliente ativo (won deals) até 40 pts
  ├─ Bônus por deals ganhos .. até 20 pts
  ├─ Recência (6 meses) ...... 10 pts
  ├─ Valor ganho ............. até 15 pts
  ├─ Atividades (decay -2/sem) até 40 pts
  └─ Propostas + visualizações até 40 pts
  Penalidade: -15 pts se sem atividade em 14 dias

GRADES:  A ≥80 | B 60-79 | C 40-59 | D 20-39 | F <20
```

---

## Roadmap ML + RAG + KAG (Fase 2 — proposta separada)

Implementação requer infraestrutura adicional. Proposta de arquitetura para validação:

```text
┌──────────────────────────────────────────────────────────┐
│  LEAD SCORE INTELLIGENCE ENGINE v2                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [RAG] Contexto da Conta                                 │
│    ├─ Oportunidades (won/lost/open + valores)            │
│    ├─ Contatos (qtd, cargos, primary)                    │
│    ├─ Atividades (timeline, frequência)                  │
│    ├─ Score Financeiro (ERP integration)                 │
│    ├─ Proposals (visualizações, aceites)                 │
│    └─ Win/Loss histórico do segmento                     │
│                                                          │
│  [KAG] Knowledge Graph                                   │
│    ├─ Padrões de conversão por segmento                  │
│    ├─ Decision Makers identificados                      │
│    └─ Sazonalidade e benchmarks                          │
│                                                          │
│  [ML Layer] OpenAI GPT-5 + structured output             │
│    ├─ FIT score com justificativa textual                │
│    ├─ INTENT score com sinais detectados                 │
│    ├─ Probabilidade de conversão (0-100%)                │
│    └─ Próxima melhor ação recomendada                    │
│                                                          │
│  [Feedback Loop]                                         │
│    └─ Won/lost feedback retreina pesos por org           │
└──────────────────────────────────────────────────────────┘
```

Esta Fase 2 será detalhada em plano separado após validação dos ajustes da Fase 1.

---

## Detalhes Técnicos (Fase 1)

**Arquivos modificados:**
- `src/hooks/useLeadScoreAnalytics.ts` — paginação completa + normalização de segmentos
- `src/components/scoring/lead/LeadScoreTable.tsx` — paginação UI
- `src/components/scoring/lead/LeadScoreDashboard.tsx` — botão Info + polling do recalc
- `src/components/scoring/lead/LeadScoreInsights.tsx` — onClick handlers
- `src/components/scoring/lead/LeadScoreOverviewKPIs.tsx` — usar `totalAccountsInOrg`
- `supabase/functions/calculate-account-scores/index.ts` — remover limite + background batch

**Arquivos criados:**
- `src/components/scoring/lead/LeadScoreFormulaInfo.tsx`
- `src/lib/segment-normalizer.ts`
- Migração SQL: normalização de segmentos + trigger + tabela `score_recalc_jobs`

**Riscos:**
- Recalcular 3.862 contas em background pode levar ~3-5 min; UI precisa do polling para não parecer travada.
- Trigger de normalização de segmento pode quebrar imports existentes que esperam o valor literal — adicionar exceção via flag.

**Próximo passo após aprovação:** Implementar Fase 1 imediatamente, validar com você, depois detalhar Fase 2 (ML/RAG/KAG).

