# Sprint 4 — Histórico e Auditoria da Qualificação

Registrar 3 novos tipos de eventos em `timeline_events` (aparecem na aba **Histórico** da oportunidade) usando o logger central `src/services/crm/timeline-logger.ts`. Sem mudança de schema: a tabela já tem `metadata jsonb`, `actor_user_id`, `timestamp`. Apenas adicionamos novos valores de `activity_type` (`qualification_score_updated`, `lead_disqualified`, `sales_handoff_blocked`).

## 1. `timeline-logger.ts` — 3 novos helpers

```ts
logQualificationScoreEvent(opportunityId, {
  previousScore, nextScore,
  previousTier, nextTier,
  pendingBlockers // string[]
})
// type: 'score', activity_type: 'qualification_score_updated'
// title: "Score de Qualificação atualizado: {prev}→{next} ({tierPrev} → {tierNext})"

logDisqualificationEvent(opportunityId, {
  reasonSlug, reasonLabel, observation,
  remarketingCreated, remarketingOpportunityId, remarketingExisted
})
// type: 'audit', activity_type: 'lead_disqualified'
// title: "Lead desqualificado no Pré-vendas: {reasonLabel}"

logSalesHandoffBlockedEvent(opportunityId, {
  currentScore, requiredScore, pendingBlockers
})
// type: 'audit', activity_type: 'sales_handoff_blocked'
// title: "Tentativa bloqueada de passagem para Vendas"
```

Cada helper preenche `metadata` com todos os campos relevantes (usuário e timestamp já vêm do logger). Erros não bloqueiam o fluxo principal (try/catch já existe no logger).

## 2. Disparadores

### a) Score atualizado — `src/hooks/useOpportunityQualificationScore.ts`

- `useEffect` observa `(score, classification.tier)`.
- Mantém um **ref local** `lastLogged` por instância **+ um Map module-level** `qualScoreLastSignatureByOpp: Map<opportunityId, {score, tier}>` para deduplicar entre múltiplos componentes que montam o hook.
- Regra "mudança relevante": **muda o tier** OU `|delta| ≥ 10` pontos.
- Não loga primeiro valor (sem `previous`).
- Não loga durante `isLoading`.
- Chama `logQualificationScoreEvent` com `previous/next/tier/blockers`.

### b) Desqualificação — `src/services/crm/disqualify.ts`

- Ao final de `disqualifyPreSalesOpportunity`, antes do `return`, chamar `logDisqualificationEvent` com:
  - `reasonSlug`, `reasonLabel` (do mapa), `observation`
  - `remarketingCreated = result.duplicated`
  - `remarketingExisted = result.remarketingExisted`
  - `remarketingOpportunityId = result.remarketingOpportunityId`
- Wrap em try/catch silencioso.

### c) Bloqueio handoff — `src/components/opportunity/EditOpportunityModal.tsx`

- No ponto em que detecta `isQualToSalesMove && !canMoveToSales` antes de abrir o `QualificationGateModal`, chamar `logSalesHandoffBlockedEvent` com `currentScore=qualScore.score`, `requiredScore=75`, `pendingBlockers=qualScore.blockers`.
- Anti-spam: usa o mesmo padrão de Map module-level (`handoffBlockedLastLoggedByOpp`) com janela de 60s para evitar enxurrada se o usuário tentar várias vezes seguidas.

## 3. Renderização no histórico

A `OpportunityHistoryTab` já renderiza `timeline_events` agrupando por `type/activity_type` com fallback genérico. Vamos verificar se renderiza `activity_type` desconhecido com ícone neutro — se sim, nada a fazer; se não, adicionamos labels/icones rápidos para os 3 novos `activity_type`. (Confirmo na implementação.)

## 4. Arquivos

**Editados**
- `src/services/crm/timeline-logger.ts` — 3 funções.
- `src/services/crm/disqualify.ts` — chamada do logger.
- `src/hooks/useOpportunityQualificationScore.ts` — change detection + log.
- `src/components/opportunity/EditOpportunityModal.tsx` — log no gate.
- (Opcional) `src/components/opportunity/OpportunityHistoryTab.tsx` — labels/ícones para os 3 novos `activity_type`.

## 5. Riscos & decisões

- **Sem migração**: usamos `timeline_events.metadata` (jsonb). Convenções existentes preservadas.
- **Dedupe de score**: regra "tier change OU Δ≥10 pts" + Map de sessão evita ruído sem deixar de capturar eventos relevantes.
- **Falha de log nunca bloqueia** desqualificação/score/handoff (try/catch interno do logger).
- **PII**: observação é gravada no `metadata` — ok, mesma política que `loss_comment`/notes existentes.

## 6. Validação manual

1. Editar checklist da oportunidade em PRÉ VENDAS, mudando urgência/decisor → histórico mostra "Score de Qualificação atualizado: X→Y".
2. Tentar mover lead com score < 75 para Vendas → gate abre + histórico ganha "Tentativa bloqueada de passagem para Vendas".
3. Desqualificar lead com toggle ON → histórico mostra "Lead desqualificado no Pré-vendas: {motivo}" com `remarketing_created=true` no metadata.
4. Desqualificar lead com toggle OFF → mesmo evento, `remarketing_created=false`.
