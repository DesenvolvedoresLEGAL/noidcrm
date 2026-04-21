

# Plano: eliminar a necessidade de hard refresh após recálculo de Score/NRHS (e padronizar para todo o CRM)

## Diagnóstico

O “refresh manual” acontece porque os mesmos dados (score, NRHS, lacunas) estão espalhados em **múltiplas chaves de cache do React Query** que não conversam entre si quando uma é recalculada.

### Problema 1 — `useOpportunityScoring`
- Ao recalcular, invalida **só** `['opportunity-scoring', id]`.
- Não invalida:
  - `['opportunity-score-lite', id]` (usada em outras telas).
  - `['opportunity', id]` (sidebar header, dados do deal — onde aparece score/NRHS).
  - `['opportunities']` (kanban / cards na listagem).
  - `['opportunity-score-analytics']` (dashboard).
- Resultado: card de Score local atualiza, mas sidebar, header, kanban e dashboard ficam com valor antigo até hard refresh.

### Problema 2 — `useNRHS`
- Invalida `['nrhs', id]` e `['opportunity', id]`, mas **não** invalida:
  - `['nrhs-score-lite', id]` (usado no `QuickIndicators` da sidebar).
  - `['opportunities']` (badge NRHS no card do kanban).
- Resultado: NRHS no card detalhado atualiza, mas o indicador “de cima” (QuickIndicators) e o badge no kanban ficam dessincronizados.

### Problema 3 — não há padrão central
Cada hook decide manualmente quais chaves invalidar → toda nova feature herda esse bug.

---

## O que vou corrigir

### Parte A — Correção imediata dos dois casos reportados

**1) `src/hooks/useOpportunityScoring.ts`**
No `onSuccess` do `recalculateMutation`, invalidar todas as chaves derivadas:
- `['opportunity-scoring', id]`
- `['opportunity-score-lite', id]`
- `['opportunity', id]`
- `['opportunities']`
- `['opportunity-score-analytics']`
- `['nrhs', id]` (alguns fatores compartilham insumo)

**2) `src/hooks/useNRHS.ts`**
No `onSuccess` do `recalculateMutation` e `markReviewMutation`, invalidar:
- `['nrhs', id]`
- `['nrhs-score-lite', id]`
- `['opportunity', id]`
- `['opportunities']`
- `['opportunity-scoring', id]` (NRHS afeta sub-score de risco)

Resultado esperado: clicar em **Recalcular** no card de Score ou NRHS atualiza em tempo real:
- card local
- sidebar (header com badges)
- QuickIndicators
- kanban (badges nos cards)
- dashboard de scoring
sem hard refresh.

### Parte B — Padrão central reaproveitável (para resolver o problema de uma vez)

Criar `src/lib/cache-invalidation.ts` com helpers semânticos:

```ts
invalidateOpportunity(queryClient, opportunityId)
  → invalida TODAS as chaves relacionadas àquela oportunidade
    (opportunity, opportunities, opportunity-scoring, opportunity-score-lite,
     nrhs, nrhs-score-lite, opportunity-score-analytics, pipeline, etc.)

invalidateAccount(queryClient, accountId)
invalidateContact(queryClient, contactId)
invalidateProposal(queryClient, proposalId)
```

Cada helper recebe o id e dispara o conjunto canônico de invalidações daquela entidade. Refatorar os hooks de mutação críticos (Scoring, NRHS, Update Opportunity, Workflow, Activity completion) para usar esses helpers.

Benefício: novas features só precisam chamar `invalidateOpportunity(qc, id)` e ganham consistência de cache automática — fim do “esqueci uma chave”.

### Parte C — Realtime para indicadores que mudam fora da UI

`useRealtimeOpportunityDetail` já escuta updates na oportunidade, mas só invalida `['opportunity', id]`. Atualizar para também invalidar os indicadores derivados (`opportunity-scoring`, `nrhs`, lite versions) — assim quando o backend recalcular score automaticamente (workflows, jobs), a UI atualiza sozinha.

### Parte D — Auditoria rápida das outras telas que precisam de hard refresh

Após corrigir os 2 casos reportados, vou varrer mutations que hoje invalidam apenas 1 chave quando deveriam invalidar várias. Lista preliminar a revisar:
- `AIFieldSuggestions` (já invalida `opportunity` + `opportunities` + `pipeline`, mas não `opportunity-scoring`/`nrhs` que dependem dos campos)
- `OpportunityActivitiesTab` (invalida `opportunity` + `opportunities`, mas atividades afetam engagement_score)
- `useNRHS.markReview` (não invalida nada hoje — bug)
- Updates de campos via `updateOpportunity` em `OpportunityDetail.tsx`
- Aceite/recusa de sugestão IA

Para cada um, trocar pela chamada única ao helper `invalidateOpportunity(qc, id)`.

---

## Arquivos modificados

**Novo:**
- `src/lib/cache-invalidation.ts` — helpers centrais

**Frontend:**
- `src/hooks/useOpportunityScoring.ts` — invalidação completa
- `src/hooks/useNRHS.ts` — invalidação completa + corrigir `markReview`
- `src/hooks/useRealtimeOpportunityDetail.ts` — propagar invalidação para scores/NRHS
- `src/components/ai/AIFieldSuggestions.tsx` — usar helper
- `src/components/opportunity/OpportunityActivitiesTab.tsx` — usar helper
- `src/pages/OpportunityDetail.tsx` — usar helper nas 4 mutations

---

## Validação

1. Abrir oportunidade → clicar em **Recalcular** no Score do Deal → todos os pontos da tela (card, sidebar header, QuickIndicators, kanban quando voltar) atualizam sem hard refresh.
2. Mesmo teste no NRHS (Revenue Hygiene).
3. Aceitar uma sugestão IA → indicadores se reajustam automaticamente.
4. Completar atividade → engagement_score reflete sem refresh.
5. Recalcular pelo dashboard `/scoring` → cards individuais das oportunidades também atualizam.

