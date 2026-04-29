# Sprint E — Agent-Driven Experimentation (Kairós)

Loop fechado: insights → hipóteses → variantes → distribuição → resultados → vencedor → (opcional) promoção. Tudo dentro de guardrails, com aprovação humana por padrão.

## Aderência ao padrão NOID

- Multi-tenant via `**organization_id**` (memória obrigatória — nunca `workspace_id`/`tenant_id`).
- RLS em todas as tabelas (read = membros da org, write = service role / RPC).
- Edge functions seguem o padrão existente (`compute-optimization-insights`, `apply-recommendation`, `run-optimization-cycle`).
- Soft-delete (`deleted_at`) e `created_by` em registros de hipótese/variante.
- Reuso da infra de Optimization: hipóteses são geradas a partir de `optimization_insights`; promoção emite `optimization_recommendations` (`recommendation_type='template_change'` etc.) — **não cria caminho paralelo**.

## 1. Banco de dados (1 migration)

Tabelas novas — **todas com `organization_id` + RLS**:

- `**experiment_hypotheses**` — `id, organization_id, hypothesis_type ('template'|'channel'|'timing'|'icp'), target_entity, target_id, description, source_insight_id (FK optimization_insights), created_by ('system'|user_id), confidence_score, status ('pending'|'approved'|'running'|'completed'|'rejected'|'promoted'), winner_variant_id, started_at, completed_at, created_at, deleted_at`
- `**experiment_variants**` — `id, organization_id, hypothesis_id, variant_label ('A'|'B'|'C'), is_control bool, content jsonb, allocation_percentage int, created_at`
- `**experiment_runs**` — `id, organization_id, hypothesis_id, variant_id, prospect_id, opportunity_id, contact_id, assigned_at, sent_at, result ('success'|'fail'|'neutral'|'pending'), result_event ('reply'|'meeting'|'win'|'no_response'), created_at`. Índices: `(hypothesis_id, variant_id)`, `(opportunity_id)`.
- `**experiment_results**` — agregado materializado por variante: `sent, replies, meetings, wins, reply_rate, meeting_rate, win_rate, score, sample_size, statistical_confidence`. Recalculado pela função `evaluate-experiment`.
- `**agent_guardrails**` — 1 linha por org: `max_experiments_per_day (5), max_variants_per_test (3), min_sample_size (20), min_lift_to_promote (0.10), allow_auto_apply (false), require_approval (true), allowed_hypothesis_types text[], updated_by, updated_at`. RPC `get_or_create_agent_guardrails(org)` para auto-bootstrap.

RLS: `SELECT` para membros da org via `has_org_access(auth.uid(), organization_id)` (helper já existente no projeto). `INSERT/UPDATE` apenas via service role nas edge functions, **exceto** `agent_guardrails` (admin pode editar) e `experiment_hypotheses.status` em `approved/rejected` (RPC `approve_hypothesis(id)` / `reject_hypothesis(id, reason)` validando role admin/manager).

## 2. Edge functions (6 novas + 1 ajuste)

Todas: CORS padrão, service role client, validação Zod-like simples, log estruturado, idempotência onde fizer sentido.

1. `**generate-experiment-hypothesis**`
  - Lê `optimization_insights` recentes (status sem hipótese ligada) + `learning_signals` agregados.
  - Aplica heurística: insight de baixa reply rate em template → hipótese `template`; baixa meeting rate em canal → `channel`; padrão de horário ruim → `timing`; ICP underperforming → `icp`.
  - Valida guardrails (`max_experiments_per_day`).
  - Insere `experiment_hypotheses` com `status='pending'`, `created_by='system'`, `source_insight_id`.
2. `**generate-variants**` (chamada após `approve_hypothesis`)
  - Usa API da **OPEN AI** via tool calling para gerar N variantes (≤ `max_variants_per_test`) baseadas no template/canal/timing alvo + contexto da org (ICP, segmentos top).
  - Inclui sempre 1 variante `is_control=true` clonando o conteúdo atual.
  - Distribui `allocation_percentage` igualmente.
  - Move hipótese para `status='running'`.
3. `**assign-variant**`
  - Invocada quando o agente de outreach (Email Agent / WhatsApp / cadência) vai disparar para um lead em segmento elegível.
  - Verifica hipóteses `running` cobrindo aquele `target_entity` + ICP do lead.
  - Hash determinístico `(opportunity_id, hypothesis_id) % 100` → bucket por `allocation_percentage` (estável em retries).
  - Cria `experiment_runs` com `assigned_at`. Retorna `variant.content` para o caller substituir o template.
  - Idempotente por `(hypothesis_id, opportunity_id)`.
4. `**track-experiment-result**` (trigger DB + endpoint)
  - Trigger AFTER INSERT em `lifecycle_events`/`activities`/`opportunities` (won/lost) → fila `pg_net` para esta função.
  - Função casa `opportunity_id` com `experiment_runs` abertos e atualiza `result` + `result_event`.
5. `**evaluate-experiment**` (chamada pelo orchestrator)
  - Para cada hipótese `running`: recalcula `experiment_results` por variante.
  - Se `min(sample_size_por_variante) >= guardrail.min_sample_size`: calcula `score = win_rate * 0.6 + meeting_rate * 0.3 + reply_rate * 0.1`, escolhe winner se lift sobre control ≥ `min_lift_to_promote`. Marca `status='completed'` + `winner_variant_id`.
  - Cria `optimization_recommendations` (`recommendation_type='template_change'` etc., `action_payload={hypothesis_id, winner_variant_id, target}`) — entra no fluxo já existente de aprovação/auto-apply.
6. `**promote-winning-variant**`
  - Chamada por `apply-recommendation` quando a recomendação tem origem em experimento.
  - Aplica conteúdo da variante vencedora ao `target_entity` (ex.: `email_templates.body`), versionando o anterior em `optimization_actions_log` para rollback. Marca hipótese `status='promoted'`.
7. **Ajuste em `run-optimization-cycle**`: após `compute-optimization-insights` e `generate-recommendations`, encadear `generate-experiment-hypothesis` → `evaluate-experiment`. Auto-apply continua respeitando `agent_guardrails.allow_auto_apply` (OFF por padrão).

## 3. Frontend — nova aba "Experiments" no Kairós

Reusa padrões de `optimization/`:

- `src/pages/intelligence/ExperimentsHub.tsx` (rota `/intelligence/experiments`, item no `AppSidebar` sob Kairós).
- `src/components/intelligence/experiments/`:
  - `ExperimentsFeed.tsx` — lista hipóteses com status, tipo, score, sample size, badges.
  - `HypothesisDetailDrawer.tsx` — variantes lado a lado, métricas (reply/meeting/win), gráfico de evolução, botões **Aprovar / Rejeitar** (chamam RPCs).
  - `VariantViewer.tsx` — diff visual de mensagens A/B/C, badge `Control` e `🏆 Winner`.
  - `GuardrailsCard.tsx` — edita `agent_guardrails` (admin only). Toggle `allow_auto_apply` com confirm modal duplo (memory: padrão NOID).
  - `ExperimentImpactSummary.tsx` — KPIs: hipóteses ativas, lift médio, promoções últimos 7d.
- Hooks em `src/hooks/experiments/` (`useHypotheses`, `useApproveHypothesis`, `useGuardrails`) com React Query + invalidations + realtime no canal `experiment_hypotheses` (memory: arquitetura de reatividade).
- No editor de template (`email_templates`), badge: **"Versão promovida automaticamente em DD/MM via experimento #123"** com link para o drawer.

## 4. Guardrails (críticos — não-negociáveis)

- `allow_auto_apply = false` por padrão.
- `require_approval = true` ⇒ `generate-variants` não roda enquanto hipótese estiver `pending`.
- Hard cap `max_experiments_per_day` checado em `generate-experiment-hypothesis`.
- `evaluate-experiment` **nunca** decide com `sample_size < min_sample_size`.
- Promoção bloqueada se `lift < min_lift_to_promote` (default 10%).
- Toda promoção registra estado anterior em `optimization_actions_log` → rollback via função `rollback-recommendation` já existente.
- Logs estruturados em `system_events` (memory: comprehensive audit infrastructure).

## 5. Riscos & mitigações

- **Sobreposição de experimentos no mesmo template**: `generate-experiment-hypothesis` checa unicidade `(target_entity, target_id, status='running')`.
- **Viés de alocação em retries**: hash determinístico em `assign-variant` evita realocação.
- **Quebra de Email Agent atual**: `assign-variant` é opt-in — o caller decide chamar. Sem chamada → comportamento idêntico ao de hoje. Integração inicial será apenas no `execute-email-agent-run` atrás de feature flag por org (`agent_guardrails.experiments_enabled`).
- **Custo de IA em `generate-variants**`: limitado por `max_variants_per_test` e só roda após aprovação humana (auto-mode OFF).

## 6. Entregáveis

- 1 migration (5 tabelas + RLS + RPCs `approve_hypothesis`, `reject_hypothesis`, `get_or_create_agent_guardrails`, trigger em `lifecycle_events`).
- 6 edge functions novas + ajuste em `run-optimization-cycle`.
- 1 página + 5 componentes + 3 hooks no frontend.
- Item de menu sob Kairós; entrada de memory documentando o padrão de experimentação.

## 7. Critério de sucesso (validação manual após deploy)

1. Insight existente gera hipótese `pending` automaticamente no próximo ciclo.
2. Admin aprova → variantes A/B/C aparecem em ≤ 30s.
3. Próximos envios do Email Agent (na org, dentro do segmento alvo) entram em `experiment_runs` distribuídos ~igualmente.
4. Replies/meetings/wins atualizam `experiment_results` em tempo real.
5. Atingido `min_sample_size`, vencedor é marcado e recomendação aparece em `OptimizationHub`.
6. Com `allow_auto_apply=false`, nada muda no template até admin aplicar a recomendação.
7. Com `allow_auto_apply=true` + lift ≥ 10%, template é trocado e badge aparece no editor; rollback funciona.