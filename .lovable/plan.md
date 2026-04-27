## Sprint C — Learning Loop (reuso máximo, zero duplicidade)

### Princípio: ANTES de criar, AUDITAR

O sistema já tem 80% da infra que a Sprint C pede. Em vez de criar 4 tabelas novas (`lifecycle_events`, `opportunity_outcomes`, `learning_signals`, `outreach_performance`), vamos **reusar o que já existe** e adicionar apenas o que realmente falta.

#### Mapa de reuso

| Sprint C pede | Já existe → reusar | Decisão |
|---|---|---|
| `lifecycle_events` | `revenue_events` (org, account, contact, opp, channel, event_type, event_subtype, payload, sentiment, engagement, revenue_impact) | **REUSAR** — adicionar `prospect_id` opcional |
| `opportunity_outcomes` | `win_loss_records` + `v_win_loss_records_normalized_v2` | **REUSAR** — já tem outcome, lost_reason, revenue |
| `learning_signals` (agregado, com impact_score) | `prospect_signals` (granular por prospect) | **CRIAR NOVA** — é uma agregação org-wide, não existe |
| `outreach_performance` | `ai_email_agent_metrics_daily` (só email) | **CRIAR NOVA** — precisa multi-canal (email/whatsapp/call) |
| `track-event` edge fn | `track-plg-event`, `track-email-open`, `track-email-click`, `ingest-email-delivery-event` | **CRIAR ROTEADOR** unificado que escreve em `revenue_events` e dispara updates |
| Score com learning | `recalculate-prospect-score` (Sprint A) | **ESTENDER** com learning_adjustment |

---

### 1. Mudanças de banco (mínimas)

**Migration única** com 2 tabelas + 1 coluna:

```sql
-- 1.1 Agregação org-wide de sinais que viram aprendizado
CREATE TABLE learning_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,        -- ex: "trigger_signal", "company_size", "has_linkedin"
  signal_value TEXT NOT NULL,       -- ex: "participa_evento", "enterprise"
  occurrences INT DEFAULT 0,
  positive_outcomes INT DEFAULT 0,  -- replies + meetings + wins ponderados
  negative_outcomes INT DEFAULT 0,  -- bounces, no_reply, lost
  impact_score NUMERIC DEFAULT 0,   -- cap [-20, +20]
  confidence NUMERIC DEFAULT 0,     -- 0..1 baseado em occurrences
  last_recalculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id, signal_type, signal_value)
);

-- 1.2 Performance multi-canal (email/whatsapp/call) por template/variant
CREATE TABLE outreach_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,            -- email, whatsapp, call
  template_type TEXT,               -- cold, follow_up, breakup, etc
  variant TEXT DEFAULT 'default',
  sent INT DEFAULT 0,
  delivered INT DEFAULT 0,
  opened INT DEFAULT 0,
  replied INT DEFAULT 0,
  meetings INT DEFAULT 0,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  last_event_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id, channel, template_type, variant)
);

-- 1.3 Adicionar prospect_id em revenue_events (lifecycle pré-conversão)
ALTER TABLE revenue_events ADD COLUMN prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL;
CREATE INDEX idx_revenue_events_prospect ON revenue_events(prospect_id) WHERE prospect_id IS NOT NULL;
CREATE INDEX idx_revenue_events_org_type_created ON revenue_events(organization_id, event_type, created_at DESC);

-- RLS: org-scoped padrão
ALTER TABLE learning_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_performance ENABLE ROW LEVEL SECURITY;
-- policies: SELECT for org members, INSERT/UPDATE via service_role only
```

---

### 2. Edge Functions (3 novas + 1 estender)

#### 2.1 `track-event` (NOVA — roteador unificado)
- INPUT: `{ event_type, prospect_id?, opportunity_id?, account_id?, contact_id?, metadata? }`
- Insere em `revenue_events` (single source of truth)
- Mapeia `event_type` → `channel`/`event_subtype`
- Dispara assíncrono (`fire-and-forget`):
  - `update-outreach-performance` (incrementa contador)
  - `update-learning-signals` (somente para eventos terminais: replied, meeting_booked, deal_won, deal_lost)

#### 2.2 `update-outreach-performance` (NOVA)
- Lê o evento, identifica canal e template_type (do payload)
- UPSERT em `outreach_performance` incrementando o contador apropriado

#### 2.3 `update-learning-signals` (NOVA)
- Para o prospect/opportunity do evento, lê `prospect_signals` + `enrichment_signals`
- Para cada sinal, faz UPSERT em `learning_signals`:
  - `occurrences += 1`
  - Se evento positivo (replied/meeting/won): `positive_outcomes += peso`
  - Se negativo (lost/bounce/no_reply após N dias): `negative_outcomes += peso`
- Recalcula `impact_score` com **proteções**:
  - Se `occurrences < 20`: `impact_score = 0` (sem confiança)
  - `impact_score = clamp((positive - negative) / occurrences * 30, -20, +20)`
  - `confidence = min(occurrences / 100, 1.0)`

#### 2.4 ESTENDER `recalculate-prospect-score` (Sprint A)
Adicionar `learning_adjustment` na fórmula:
```ts
const learning = await supabase
  .from('learning_signals')
  .select('signal_type, signal_value, impact_score')
  .eq('organization_id', orgId)
  .gte('confidence', 0.2);

const matched = signals.filter(s => 
  learning.find(l => l.signal_type === s.signal_type && l.signal_value === s.signal_value)
);
const learning_adjustment = matched.reduce((sum, s) => sum + s.impact_score, 0);

priority_score = base + enrichment + contact + intent + learning_adjustment;
```
Persistir `learning_adjustment` em `enrichment_runs` (nova coluna) para auditoria.

---

### 3. Hooks de integração (sem duplicar fluxos)

| Trigger natural | Ação |
|---|---|
| `run-decision-engine` executa | já chama `outbound_tasks` → adicionar `track-event('decision_executed')` |
| `send-email` / `ai-email-send` | adicionar `track-event('email_sent')` |
| `ingest-email-delivery-event` (já existe) | rotear `delivered/opened/replied` para `track-event` |
| `track-email-open` (já existe) | chamar `track-event('email_opened')` no final |
| Activity completed (meeting type) | trigger no DB já existe → adicionar `track-event('meeting_booked')` |
| `win_loss_records` insert | trigger novo → `track-event('deal_won' | 'deal_lost')` |

Tudo via wrapper, sem reescrever os fluxos existentes.

---

### 4. Frontend

#### 4.1 Nova rota: `/app/settings/noid-intelligence/learning`
Página `LearningPerformancePage.tsx` com 3 abas:

**Aba "Funil de Conversão"**
- Componente `ConversionFunnel.tsx`
- Query agregada de `revenue_events` por `event_type` no período
- Visualização: Leads → Replies → Meetings → Opportunities → Wins (com %)

**Aba "Sinais de Aprendizado"**
- `TopSignalsPanel.tsx` — top 10 positivos (impact_score DESC, confidence ≥ 0.3)
- `WorstSignalsPanel.tsx` — top 10 negativos
- Filtro por período + signal_type

**Aba "Performance de Outreach"**
- `OutreachPerformanceTable.tsx`
- Tabela: Canal | Template | Enviados | Entregues | Abertos | Respostas | Reuniões | Wins | Reply Rate | Meeting Rate
- Bonus: Rule Performance — JOIN `decision_logs.rule_id` × outcomes

#### 4.2 Atualizar `DecisionRulesPage.tsx`
Adicionar 4ª aba "Learning" (atalho para a página acima) — OU link cross-page no header.

#### 4.3 `ProspectDetailDrawer` — nova aba "Timeline"
Componente `ProspectLifecycleTimeline.tsx`:
- Lê `revenue_events` WHERE `prospect_id = X` ORDER BY `created_at`
- Visual estilo timeline com ícones por `event_type`
- Eventos: Enriched → Decision Executed → Email Sent → Opened → Replied → Meeting Booked

#### 4.4 Hook
`useLearningSignals.ts`, `useOutreachPerformance.ts`, `useLifecycleTimeline(prospectId)` — react-query padrão.

---

### 5. Proteções (já contempladas)

- **Anti-viés**: `occurrences < 20` → `impact_score = 0`
- **Anti-overfitting**: `clamp(impact_score, -20, +20)`
- **Anti-loop**: `track-event` é idempotente por `(prospect_id, event_type, source_event_id)` quando `metadata.dedup_key` é fornecido
- **RLS**: tudo org-scoped; writes via service_role nas edge functions

---

### 6. Testes (executados via tools)

1. Inserir 10 events `email_sent` para mesma org/template → `outreach_performance.sent = 10`
2. Inserir 3 `email_replied` → `replies = 3`, recalcula 1 sinal
3. Inserir 1 `deal_won` em prospect com `signal_type='trigger_signal' value='participa_evento'` → `learning_signals.positive_outcomes++`
4. Rodar `recalculate-prospect-score` em prospect com mesmo sinal → `learning_adjustment > 0`, `priority_score` aumenta
5. Verificar timeline aparece no drawer

---

### 7. Arquivos

**Novos (8)**
- `supabase/migrations/<ts>_sprint_c_learning_loop.sql`
- `supabase/functions/track-event/index.ts`
- `supabase/functions/update-outreach-performance/index.ts`
- `supabase/functions/update-learning-signals/index.ts`
- `src/pages/settings/noid-intelligence/LearningPerformancePage.tsx`
- `src/components/learning/{ConversionFunnel,TopSignalsPanel,WorstSignalsPanel,OutreachPerformanceTable,ProspectLifecycleTimeline}.tsx`
- `src/hooks/{useLearningSignals,useOutreachPerformance,useLifecycleTimeline}.ts`
- `src/services/learning/learningService.ts`

**Editados (5)**
- `supabase/functions/run-decision-engine/index.ts` (chamar track-event)
- `supabase/functions/recalculate-prospect-score/index.ts` (learning_adjustment)
- `supabase/functions/ingest-email-delivery-event/index.ts` (rotear)
- `src/components/playbook/ProspectDetailDrawer.tsx` (nova aba Timeline)
- `src/App.tsx` + `NoidIntelligenceHub.tsx` (rota + card)

---

### 8. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Volume alto de eventos pesa no Postgres | Index em `(org, event_type, created_at DESC)`; agregação assíncrona |
| Aprendizado enviesado por amostra pequena | Threshold `occurrences ≥ 20` + cap [-20,+20] |
| Duplicidade vs `nrhs_events`/`plg_events` | NÃO criar lifecycle_events — reusar `revenue_events` que é o canônico GTM (memo: gtm-canonical-model-unified-touchpoints) |
| Reescrita de fluxos existentes | Wrappers fire-and-forget, zero refactor invasivo |

---

### 9. Critério de sucesso

- [x] `revenue_events` registra todo o ciclo do prospect (incluindo pré-CRM)
- [x] `learning_signals` agrega org-wide com proteções estatísticas
- [x] `outreach_performance` multi-canal funcional
- [x] Score V3 incorpora `learning_adjustment` auditável
- [x] UI: Funil + Top/Worst Signals + Outreach Table + Timeline no drawer
- [x] Zero duplicidade com win_loss_records, plg_events, nrhs_events, ai_email_agent_outcomes

Aprovar para implementar?