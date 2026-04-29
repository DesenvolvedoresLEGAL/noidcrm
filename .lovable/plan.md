## Sprint D — AI Optimization Layer (Kairós)

Transformar dados históricos (`learning_signals`, `outreach_performance`, `revenue_events`) em insights, recomendações e ajustes automáticos — fechando o loop **Executa → Aprende → Otimiza**.

### Princípios de adaptação ao NOID

- Multitenancy: usar `organization_id` (não `workspace_id`) para alinhar com `learning_signals`, `decision_rules`, `outreach_performance` já existentes.
- RLS: Org members podem `SELECT`; apenas Owners/Admins podem aplicar recomendações; service_role para edge functions.
- Auto-mode OFF por padrão; `apply-recommendation` exige aprovação manual no início.
- Reaproveitar serviços existentes (`useLearningSignals`, `useOutreachPerformance`, `decisionService`) e padrões da `NoidIntelligenceHub`.

---

### 1. Banco de dados (1 migration)

**`optimization_insights`**
- `id`, `organization_id` (FK organizations, ON DELETE CASCADE), `insight_type` CHECK in (`signal`,`template`,`channel`,`playbook`,`provider`)
- `entity_id`, `entity_label`, `metric_name`, `metric_value`, `baseline_value`, `delta`
- `sample_size INT`, `confidence_score NUMERIC` (0-1, CHECK)
- `detected_at TIMESTAMPTZ DEFAULT now()`, `created_at`
- UNIQUE (organization_id, insight_type, entity_id, metric_name) → upsert idempotente por ciclo
- Index: (organization_id, detected_at DESC), (organization_id, insight_type)

**`optimization_recommendations`**
- `id`, `organization_id`, `insight_id` (FK optimization_insights ON DELETE SET NULL)
- `recommendation_type` CHECK in (`score_adjustment`,`rule_change`,`template_change`,`channel_shift`,`playbook_change`)
- `target_type`, `target_id`, `title`, `description`
- `impact_estimate NUMERIC`, `confidence_score NUMERIC` (CHECK 0-1)
- `action_payload JSONB NOT NULL` (instruções idempotentes para `apply-recommendation`)
- `status` CHECK in (`pending`,`accepted`,`dismissed`,`auto_applied`,`failed`) DEFAULT `pending`
- `reviewed_by UUID`, `reviewed_at`, `created_at`
- Index: (organization_id, status, created_at DESC)

**`optimization_actions_log`**
- `id`, `organization_id`, `recommendation_id` (FK ON DELETE CASCADE)
- `action_type`, `executed BOOLEAN`, `result JSONB`, `error_message TEXT`
- `executed_by UUID` (NULL para auto), `executed_at TIMESTAMPTZ DEFAULT now()`

**`organization_settings` (extensão)**
- Adicionar coluna `optimization_auto_mode BOOLEAN DEFAULT false` (criar tabela + linha por org se não existir, ou usar config JSONB existente).
- `max_score_adjustment_per_cycle NUMERIC DEFAULT 10`
- `min_sample_size_for_insight INT DEFAULT 20`

**RLS**
- Todas as 3 tabelas: `SELECT` para membros da org via `organization_members`
- `UPDATE status` em `optimization_recommendations` só para Owner/Admin (via `has_role`)
- `INSERT/UPDATE` em insights/log: apenas service_role (edge functions)

---

### 2. Edge Functions (3 novas)

**`compute-optimization-insights`**
- Input: `{ organization_id?: string }` (se omitido, processa todas as orgs ativas)
- Lê `learning_signals` (>= min_sample_size), `outreach_performance` (sent >= 100), `revenue_events` últimos 90d
- Detecta padrões:
  - **Sinal forte**: `positive_outcomes/occurrences > baseline_org + 0.20` → insight `signal`
  - **Template ruim**: `replied/sent < 0.05` AND `sent >= 100` → insight `template`
  - **Canal vencedor**: `channel.reply_rate > other.reply_rate * 2` → insight `channel`
- UPSERT em `optimization_insights` (idempotente por `(org, type, entity, metric)`)
- Logs estruturados, retorna contagem de insights gerados

**`generate-recommendations`**
- Input: `{ organization_id?, since?: ISO }`
- Para cada insight recente sem recomendação ativa, gera 1 recomendação com `action_payload`:
  - `signal` + delta positivo → `score_adjustment` (+N pontos, cap ±10)
  - `template` baixa resposta → `template_change` (sugere deprecar / criar variante)
  - `channel` vencedor → `channel_shift` (sugere priorizar canal X)
- `confidence_score` = função de `sample_size` e `delta`
- Skip se já existe recomendação `pending` ou `accepted` para mesmo target

**`apply-recommendation`**
- Input: `{ recommendation_id: string }` — chamada manual ou pelo cron quando `auto_mode=true`
- Valida JWT + role Owner/Admin (manual) OU origem service_role (auto)
- Switch por `recommendation_type`:
  - `score_adjustment` → UPDATE `learning_signals.impact_score` respeitando cap ±10/ciclo e CHECK ±20
  - `rule_change` → UPDATE `decision_rules` (ex: `is_active=false` ou ajusta `min_score`)
  - `template_change` → marca template/variant como `deprecated` em `outreach_performance` (adicionar coluna `status` se necessário) ou em tabela de templates
  - `channel_shift` → grava preferência em `organization_settings`
- INSERT em `optimization_actions_log` (com `result` ou `error_message`)
- UPDATE recommendation.status → `accepted` (manual) / `auto_applied` / `failed`

**Cron (pg_cron, a cada 24h às 04:00 UTC)**
1. `compute-optimization-insights`
2. `generate-recommendations`
3. Se org tem `optimization_auto_mode=true`: aplica recomendações com `confidence_score >= 0.8` e `impact_estimate` dentro do limite

---

### 3. Frontend

**Nova rota: `/intelligence/optimization` → `OptimizationHub.tsx`**
- Adicionar entry no `AppSidebar` (sob Intelligence) e em `App.tsx`
- Layout padrão `Layout` + `PageHeader` (icon `Sparkles`, variant `indigo`)

**Componentes (em `src/components/intelligence/optimization/`)**
- `InsightsFeed.tsx` — lista insights ordenada por `detected_at`, com chip do tipo, delta visual e sample_size
- `RecommendationsPanel.tsx` — grid de cards com:
  - Título, descrição, badge de tipo
  - Impacto estimado + barra de confiança
  - Botões **Aplicar** (chama `apply-recommendation`) e **Ignorar** (`status=dismissed`)
  - Estado `auto_applied` exibe badge + log
- `AutoModeToggle.tsx` — Switch que persiste `optimization_auto_mode` em `organization_settings` (apenas Owner/Admin)
- `PerformanceComparison.tsx` — gráfico antes/depois (reply_rate, meeting_rate, win_rate) usando `outreach_performance` agregado por janela pré/pós aplicação
- `ActionsHistoryTable.tsx` — `optimization_actions_log` com filtro por tipo/status

**Hooks (em `src/hooks/optimization/`)**
- `useOptimizationInsights(orgId)` — React Query, realtime opcional
- `useOptimizationRecommendations(status?)` — com mutations `apply` e `dismiss`
- `useOptimizationAutoMode()` — leitura/escrita do toggle
- `useOptimizationActionsLog()`

**Integração no Prospect Drawer**
- No componente onde score é exibido, mostrar badge "Score boosted by learning (+12)" quando o prospect tem sinais com `impact_score > 0` aplicados via recomendações `auto_applied` recentes (computado client-side a partir de `learning_signals` já carregado).

---

### 4. Serviços

**`src/services/optimization/optimizationService.ts`**
- `fetchInsights`, `fetchRecommendations`, `applyRecommendation` (invoke edge function), `dismissRecommendation`, `setAutoMode`
- Reusa cliente supabase já configurado

---

### 5. Proteções

- `min_sample_size_for_insight` (default 20) bloqueia geração de insights com base estatística fraca
- `max_score_adjustment_per_cycle` (default 10) limita drift de `impact_score`
- `auto_mode=false` por padrão; UI exige duas confirmações para ligar
- `apply-recommendation` é idempotente: se status != `pending`, retorna no-op
- Logs estruturados em todas as edge functions

---

### 6. Testes manuais (documentados no PR)

1. Seed de `learning_signals` com sinal `participa_evento` (positive_outcomes alto, sample 30+) → rodar `compute-optimization-insights` → verificar insight criado
2. Rodar `generate-recommendations` → recomendação `score_adjustment` com `+N` no payload
3. Aplicar via UI → verificar UPDATE em `learning_signals.impact_score`, log em `optimization_actions_log`, badge no Prospect Drawer
4. Template com sent>100 reply_rate<5% → recomendação `template_change`
5. Ligar `auto_mode` + cron mockado → recomendação `auto_applied`

---

### Arquivos a criar/editar

**Migration**
- `supabase/migrations/<ts>_optimization_layer.sql`

**Edge functions**
- `supabase/functions/compute-optimization-insights/index.ts`
- `supabase/functions/generate-recommendations/index.ts`
- `supabase/functions/apply-recommendation/index.ts`

**Frontend**
- `src/pages/intelligence/OptimizationHub.tsx`
- `src/components/intelligence/optimization/{InsightsFeed,RecommendationsPanel,AutoModeToggle,PerformanceComparison,ActionsHistoryTable}.tsx`
- `src/hooks/optimization/{useOptimizationInsights,useOptimizationRecommendations,useOptimizationAutoMode,useOptimizationActionsLog}.ts`
- `src/services/optimization/optimizationService.ts`
- Editar: `src/App.tsx` (rota), `src/components/AppSidebar.tsx` (item), Prospect Drawer (badge)

**Cron**
- SQL via insert tool (não migration) com `cron.schedule` chamando as 3 edge functions em sequência diária

---

### Riscos

- Drift de score se `max_adjustment_per_cycle` for relaxado → manter cap rígido
- Recomendação aplicada sobre dado obsoleto → `apply-recommendation` re-valida snapshot do insight antes de executar
- Loop infinito se `compute` rodar antes do log do `apply` propagar → cron sequencial, não paralelo
- Auto-mode pode aprovar mudanças ruins → exigir `confidence >= 0.8` AND limite por ciclo

### Próximos passos (pós-aprovação)

Implementar na ordem: migration → edge functions → service/hooks → UI → cron → testes manuais documentados.