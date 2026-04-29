# Sprint Scoring 1.2 — Opportunity Score automático e realtime

Mesma arquitetura da Sprint 1.1 (Lead Score), agora aplicada à oportunidade. O score passa a ser calculado por uma fórmula determinística (Stage Strength + Deal Signals + Velocity + Engagement + Risk Adjustment, com caps), persistido em `opportunities`, registrado em `score_history`, propagado via realtime e invalidado de forma centralizada — sem hard refresh.

## Mapeamento ao schema real (importante)

Validado no banco antes de planejar:

- Tabela usa `organization_id` (não `org_id`/`tenant_id`).
- `opportunities` já tem: `opportunity_score`, `engagement_score`, `velocity_score`, `risk_score`, `scoring_factors`, `score_updated_at`, `prob`, `valor_previsto`, `close_date_prevista`, `next_followup_date`, `last_contact_date`, `closed_at`, `won_at` (gerada), `lost_at`, `loss_reason_id`, `deleted_at`.
- `activities` usa `scheduled_date` (não `due_at`); tem `account_id`, `contact_id`, `opportunity_id`, `type`, `status`, `completed_at`, `deleted_at`.
- `proposals` tem `opportunity_id`, `status`, `sent_at`, `viewed_at`, `accepted_at`, `expires_at`, `total_amount`, `organization_id` (sem `rejected_at`/`amount`).
- "Communications" = `opportunity_emails` (`opportunity_id`, `direction`, `sent_at`, `opened_at`, `clicked_at`).
- `score_history` já existe e suporta `score_type='opportunity'` + `entity_type='opportunity'` com `factors jsonb` — reaproveitar, não duplicar.

## 1. Migration de schema (`opportunities`)

Adicionar apenas o que falta (não duplicar colunas existentes):

- `opportunity_grade text` — CHECK in (`A`,`B`,`C`,`D`,`F`)
- `opportunity_health text` — CHECK in (`hot`,`healthy`,`attention`,`risk`,`stalled`)
- `opportunity_score_updated_at timestamptz` — alias semântico; manter `score_updated_at` como source of truth e popular ambos via edge function (evita quebrar consumidores atuais). Caso prefira só um, optaremos por reutilizar `score_updated_at` e referenciá-lo nas leituras.
- `opportunity_score_metadata jsonb default '{}'` — novo, separado de `scoring_factors` (este último permanece para compat).
- Constraint adicional: `opportunity_score BETWEEN 0 AND 100`.

Índices novos:

- `idx_opportunities_opp_score (organization_id, opportunity_score DESC)`
- `idx_opportunities_opp_grade (organization_id, opportunity_grade)`
- `idx_opportunities_opp_health (organization_id, opportunity_health)`
- `idx_opportunities_score_updated (organization_id, score_updated_at DESC)`

## 2. Fila `opportunity_score_recalc_queue`

Tabela nova com colunas: `id`, `organization_id`, `opportunity_id` (FK opportunities ON DELETE CASCADE), `account_id`, `trigger_source` CHECK in (`opportunities`,`activities`,`proposals`,`opportunity_emails`,`contacts`,`manual`), `trigger_action` CHECK in (`insert`,`update`,`delete`), `status` CHECK in (`pending`,`processing`,`completed`,`failed`,`skipped`) default `pending`, `error_message`, `metadata jsonb default '{}'`, `created_at`, `processed_at`.

Índices: `(organization_id, opportunity_id, status)`, `(organization_id, status, created_at)`, `(opportunity_id, created_at DESC)`, `(created_at)`.

RLS:
- SELECT: `user_is_org_member(organization_id)`.
- INSERT/UPDATE: somente service role (sem policy explícita para usuários).

## 3. Função SQL `enqueue_opportunity_score_recalc()`

`SECURITY DEFINER`, `search_path = public`. Resolve `organization_id`, `opportunity_id` e `account_id` conforme `TG_TABLE_NAME`:

- `opportunities`: usa NEW/OLD direto.
- `activities`, `proposals`, `opportunity_emails`: usa `opportunity_id` da linha.
- `contacts`: faz `SELECT … FROM opportunities WHERE contact_id = NEW.id` para enfileirar todas as oportunidades vinculadas (uma por uma).

Debounce de 2 min: se já existir registro `pending`/`processing` para o mesmo `opportunity_id` criado há menos de 2 minutos, não enfileira de novo. Erros são engolidos com `EXCEPTION WHEN OTHERS` para nunca derrubar a transação de origem.

## 4. Triggers (column-scoped)

Apenas em tabelas que existem:

- `opportunities` — UPDATE OF `stage_id, status, valor_previsto, prob, close_date_prevista, owner_user_id, account_id, contact_id, next_followup_date, last_contact_date, closed_at, lost_reason_id, deleted_at` + INSERT/DELETE.
- `activities` — UPDATE OF `status, type, completed_at, scheduled_date, opportunity_id, account_id, contact_id, deleted_at` + INSERT/DELETE.
- `proposals` — UPDATE OF `status, sent_at, viewed_at, accepted_at, expires_at, total_amount, opportunity_id` + INSERT/DELETE.
- `opportunity_emails` — INSERT + UPDATE OF `opened_at, clicked_at, direction`.
- `contacts` — UPDATE OF `nome, emails, telefones, cargo, account_id, deleted_at` (loop interno na função).

Nenhum trigger em tabelas inexistentes (sem `communications`/`messages`).

## 5. Edge function `calculate-opportunity-score` (singular, nova)

Não substitui a antiga `calculate-opportunity-scores` (mantida para compat e callers existentes), mas é a fonte de verdade do novo score determinístico.

Input: `{ opportunity_id, organization_id?, trigger_source?, trigger_action? }`.

Pipeline:
1. Carrega opportunity + stage (pipeline + ordem) + account + contato principal.
2. Carrega activities, proposals, opportunity_emails relacionadas (limites razoáveis).
3. Computa 5 componentes:
   - **Stage Strength (0–25)**: mapping por nome (Lead Captado=5, 1ª Tentativa=8 … Pre Aprovação=25); fallback normalizado por `order_index` no pipeline.
   - **Deal Signals (0–25)**: amount, owner, contato principal, próximo passo (`next_followup_date`), `close_date_prevista`, proposta enviada/aceita, origem etc.
   - **Velocity (0–20)**: criação recente, mudança de stage recente (via `audit_log` filtrando `action='stage_moved'`), atividades concluídas/futuras, penalidades por estagnação.
   - **Engagement (0–20)**: emails abertos/clicados, propostas visualizadas, atividades por tipo (`meeting`, `call`, `whatsapp`), respostas recentes do cliente.
   - **Risk Adjustment (-20…+10)**: atividades vencidas, falta de próximo passo/contato, proposta vencida, ghosting, ajustes positivos (indicação, recorrente, account `lead_score>=80`, urgência).
4. Aplica caps obrigatórios (sem next_activity → 59; sem contato principal → 69; sem owner → 49; parado >14d → 49; proposta sem retorno >5d → 59; estágio avançado sem amount → 59; >3 atividades vencidas → 49).
5. Estados terminais: `won` ⇒ 100/A/hot; `lost`/disqualified ⇒ 0/F/stalled.
6. Calcula grade (A/B/C/D/F) e health (hot/healthy/attention/risk/stalled).
7. UPDATE em `opportunities`: `opportunity_score`, `opportunity_grade`, `opportunity_health`, `opportunity_score_metadata` (breakdown completo + caps aplicados), `score_updated_at = now()` e mantém `engagement_score`/`velocity_score`/`risk_score` para compat com componentes legados.
8. INSERT em `score_history`: `entity_type='opportunity'`, `score_type='opportunity'`, `old_value`, `new_value`, `factors` com breakdown + `trigger_source`/`trigger_action`/`caps_applied`/`calculated_at`.
9. Retorna payload completo.

Falha nunca aborta — o processador da fila marca `failed` e o último score válido permanece.

## 6. Edge function `process-opportunity-score-queue`

Espelho do `process-lead-score-queue`: pega 50 `pending`, marca `processing`, deduplica por `opportunity_id`, chama `calculate-opportunity-score` por oportunidade, marca `completed`/`failed`/`skipped`. Aceita `{ organization_id }` opcional para flush sob demanda do frontend.

Cron `pg_cron` a cada 1 min via `net.http_post` (mesmo padrão do `process-lead-score-queue`, registrado fora da migration porque contém URL/anon key — usar a ferramenta de insert).

## 7. Realtime

- `ALTER TABLE opportunities REPLICA IDENTITY FULL` (já é a base; idempotente).
- Garantir que `opportunities` está em `supabase_realtime` (idempotente).
- Hook `src/hooks/scoring/useOpportunityScoreRealtime.ts`: assina updates filtrados por `id=eq.{opportunityId}` e só invalida se algum dos campos `opportunity_score, opportunity_grade, opportunity_health, score_updated_at, opportunity_score_metadata` mudou.
- Hook `src/hooks/scoring/usePipelineOpportunityScoreRealtime.ts`: assina updates por `organization_id=eq.{orgId}` em `opportunities`, filtra mudanças nos mesmos campos e dispara invalidação de pipeline/forecast/scoring (sem refazer query por toda mudança de oportunidade).

## 8. Invalidação centralizada

Novo helper `src/lib/scoring/invalidateOpportunityScoreQueries.ts` que reaproveita `invalidateOpportunity(queryClient, opportunityId)` (já cobre `opportunity-scoring`, pipeline, score analytics, NRHS, detail, lists) e adiciona:

- `['forecast']`, `['reports']`, `['win-loss']`, `['vibe-selling']`
- `['account-opportunities', accountId]` quando `accountId` for passado
- `['scoring']`, `['scoring-dashboard']`

Sem duplicar lógica do helper de Lead Score; consumir keys do `query-keys.ts`.

## 9. Integração no fluxo de UI

- Após salvar oportunidade (mutations em `services/crm/opportunities.ts` / hooks correlatos): fire-and-forget `supabase.functions.invoke('calculate-opportunity-score', { body: { opportunity_id } })` + `invalidateOpportunityScoreQueries`. Estado discreto "Atualizando score…" no header/sidebar.
- Após mover card no Kanban (`moveOpportunity`): mesmo disparo imediato + invalidate. O card atualiza score/grade/health sem F5 graças ao realtime.
- `OpportunityScoreBadge` passa a ler `opportunity_score`, `opportunity_grade`, `opportunity_health` direto da oportunidade (não recalcular local). Tooltip lê `opportunity_score_metadata` para mostrar breakdown e caps aplicados.
- `useOpportunityScoring` deixa de auto-disparar a edge function antiga quando a nova está disponível: prefere `calculate-opportunity-score`; mantém retrocompatibilidade.

## 10. Componentes que vão consumir o novo score

Sem refatorar layout — só trocar a fonte:

- `PipelineCard` (badge + tooltip de breakdown)
- `OpportunityDetail` / `OpportunitySidebar` / `OpportunityHeader`
- `ForecastTable` (quando lê score)
- Tela de Reports e Win/Loss Hub
- Vibe Selling recommendations
- `OpportunityScoreBadge` (props inalteradas, leitura central)

## Detalhes técnicos resumidos

```text
opportunities/activities/proposals/
opportunity_emails/contacts
        │ trigger column-scoped
        ▼
enqueue_opportunity_score_recalc()
        │ debounce 2 min por opportunity_id
        ▼
opportunity_score_recalc_queue (RLS)
        │ pg_cron 1 min  +  flush sob demanda
        ▼
process-opportunity-score-queue (batch 50, dedupe por opp)
        ▼
calculate-opportunity-score
  ├─ Stage Strength (0–25)
  ├─ Deal Signals (0–25)
  ├─ Velocity (0–20)
  ├─ Engagement (0–20)
  ├─ Risk Adjustment (-20…+10)
  ├─ Caps obrigatórios
  └─ won=100/A/hot · lost=0/F/stalled
        ▼
UPDATE opportunities (score/grade/health/metadata)
INSERT score_history (entity_type=opportunity, score_type=opportunity)
        ▼
Realtime UPDATE em opportunities (REPLICA IDENTITY FULL)
        ▼
useOpportunityScoreRealtime / usePipelineOpportunityScoreRealtime
        ▼
invalidateOpportunityScoreQueries → Pipeline, Detail, Forecast,
Reports, Win/Loss, Vibe Selling, Account, Scoring atualizam sem F5
```

## Riscos & mitigação

- **Volume de eventos em orgs grandes** → debounce de 2 min + dedupe por opportunity no batch + filtro de payload no realtime (só invalida quando campos de score mudam).
- **Conflito com `calculate-opportunity-scores` legado** → manter a antiga; nova função grava nos novos campos e mantém os antigos populados para retrocompat.
- **Triggers em tabela inexistente** → confirmado no schema antes; só `proposals`, `opportunity_emails`, `activities`, `contacts`, `opportunities`.
- **Cron em SQL com secrets** → registrado via insert tool, não via migration.
- **RLS multi-tenant** → fila com `organization_id` + policy `user_is_org_member`; service role processa.

## Fora de escopo (mantido)

Fórmula do Lead Score, ML preditivo, redesign de Pipeline, Account Score, Forecast V2, refactor de relatórios e mudanças de permissões fora do necessário.

## Próximos passos após aprovação

1. Migration: colunas + constraints + índices + queue + função enqueue + triggers + realtime.
2. Edge functions `calculate-opportunity-score` e `process-opportunity-score-queue`.
3. Cron `pg_cron` (via insert tool).
4. Helper `invalidateOpportunityScoreQueries` + hooks realtime.
5. Wire-up nas mutations de save/move + leitura central no `OpportunityScoreBadge`/cards.
6. Smoke test: mover card → score recalcula sem F5; remover owner → cap 49; concluir activity → velocity sobe.
