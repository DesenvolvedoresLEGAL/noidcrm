# Sprint 6.5 — Observabilidade, Performance e Rollout Controlado para Closers

## Objetivo

Dar ao Owner/Admin uma camada completa de observabilidade do Dashboard Closer (saúde, adoção, estabilidade, performance e feedback) e permitir expansão segura para até **3 Closers por tenant**, com rollback individual, em massa e por tenant. Sem mexer em propostas, atividades, oportunidades, sidebar, login ou dashboard legado. Sem ativar automações ou notificações.

## Escopo (o que entra e o que NÃO entra)

Entra:
- Painel "Saúde do Dashboard Closer" no Admin Center (cards + status de rollout).
- Métricas de adoção por usuário piloto.
- Métricas de estabilidade derivadas de `crm_dynamic_dashboard_runtime_logs`.
- Performance em fases (gate / shell / closer data / pace / total interactive).
- Tabela e RPC de feedback do piloto + card de feedback no Dashboard Closer.
- Rollout controlado: até 3 Closers por tenant (limite enforçado em RPC).
- Rollback em massa de Closers via RPC.
- Card "Pronto para expandir?" com critérios objetivos.
- Reorganização do Admin Center em uma seção/aba "Dashboard Closer".

NÃO entra:
- Dashboards de SDR, CS, Manager, Admin ou Owner.
- Ativação geral de dashboards dinâmicos.
- Automações, notificações, alterações em propostas/atividades/oportunidades/metas.
- Mudanças em permissões reais, sidebar, login ou remoção do dashboard legado.

---

## Banco de dados (1 migration)

Arquivo: `supabase/migrations/<timestamp>_sprint_6_5_observability_and_feedback.sql`

1. **Constraint do log de piloto** — alterar o CHECK de `crm_dynamic_dashboard_pilot_logs.action` para incluir `bulk_disable_closer_pilots` (mantendo `enable_pilot`, `disable_user_pilot`, `disable_tenant_dynamic_dashboard`, `rollback`). Drop + recreate da constraint, idempotente.

2. **Tabela `public.crm_dynamic_dashboard_feedback`** — exatamente como especificada no prompt (campos, CHECKs `dashboard_type IN ('closer')` e `rating BETWEEN 1 AND 5`, índices por `(tenant_id, user_id, created_at desc)` e `(tenant_id, created_at desc)`).
   - RLS habilitado.
   - Policy INSERT: `user_belongs_to_tenant(tenant_id) AND user_id = auth.uid()`.
   - Policy SELECT: `is_tenant_admin_or_owner(tenant_id) OR user_id = auth.uid()`.
   - Sem UPDATE/DELETE.

3. **RPC `crm_submit_dynamic_dashboard_feedback`** — `security definer`, `set search_path = public`. Valida tenant via `user_belongs_to_tenant`, força `dashboard_type = 'closer'`, valida `rating 1..5`, exige `business_function_key = 'closer'` no `crm_user_context_view` para o `auth.uid()`, trunca `comment` (1000 chars) e `missing_info` (500 chars), insere e retorna `{ success: true, feedback_id }`.

4. **RPC `crm_disable_all_closer_dashboard_pilots(p_tenant_id, p_reason)`** — `security definer`. Valida `is_tenant_admin_or_owner(p_tenant_id, auth.uid())`. Atualiza `crm_user_contexts.is_dashboard_dynamic_enabled = false` apenas para usuários do tenant com `business_function_key = 'closer'`. Insere 1 log por usuário desligado em `crm_dynamic_dashboard_pilot_logs` com `action = 'bulk_disable_closer_pilots'`, `reason`, e `metadata = { source: 'sprint_6_5' }`. NÃO desliga `dynamic_dashboards_enabled` global. Retorna `{ success: true, disabled_count }`.

5. **RPC `crm_enable_closer_dashboard_pilot` (alteração)** — manter assinatura. Antes do UPDATE, contar:
   ```
   SELECT count(*) FROM crm_user_context_view
   WHERE tenant_id = p_tenant_id
     AND business_function_key = 'closer'
     AND is_dashboard_dynamic_enabled = true
   ```
   Se `target_user_id` já está ativo → retornar `{ success: true, already_enabled: true }`.
   Se count >= 3 e target ainda não está ativo → `RAISE EXCEPTION 'pilot_limit_reached: max 3 closer pilots per tenant'`.
   Caso contrário, prossegue com a lógica atual (incluindo log existente).

Sem ALTER em `auth.users`, `storage`, `realtime`, `vault`. Sem service role no client.

---

## Services

### Atualizar `src/services/crm/dynamicDashboardRuntimeLogs.ts`
Adicionar funções (consultas read-only, todas filtradas por `tenant_id`):
- `getCloserDashboardHealthSummary(tenantId, days = 7)` — agrega contagens por `event_type`, `avg(load_ms)` em `runtime_allowed`, último `runtime_allowed` (data + user_id), e calcula `rolloutStatus: 'safe' | 'attention' | 'blocked'` conforme critérios do prompt.
- `getCloserDashboardUserAdoption(tenantId)` — junta logs com lista de pilotos ativos (`crm_user_context_view` filtrado por `business_function_key='closer'` e `is_dashboard_dynamic_enabled=true`) e devolve por usuário: nome, email, último acesso, totais por evento, `usage_rate`, `status: 'adotando' | 'testando' | 'resistencia' | 'sem_uso'`.
- `getCloserDashboardPerformanceSummary(tenantId, days = 7)` — extrai de `metadata` os campos `gate_load_ms`, `closer_data_load_ms`, `total_interactive_ms`, `performance_status`. Retorna médias, máximos e contagem de `slow`.
- `getCloserRolloutDecisionData(tenantId)` — combina health + performance + média de feedback e devolve `{ status: 'ready' | 'attention' | 'hold', reasons: string[], metrics: {...} }`.

Manter `logDynamicDashboardRuntimeEvent` como está. Atualizar a chamada existente no `DynamicDashboardRuntimeGate` para aceitar `metadata` extra (faseamento de performance) — ver "Frontend".

### Criar `src/services/crm/dynamicDashboardFeedback.ts`
- `submitDynamicDashboardFeedback(input)` → chama `crm_submit_dynamic_dashboard_feedback` via `supabase.rpc`.
- `getDynamicDashboardFeedbackSummary(tenantId)` → SELECT agregado: `count(*)`, `avg(rating)`, `count(*) filter (where is_slow)`, `count(*) filter (where is_confusing)`.
- `getDynamicDashboardFeedbackList(tenantId, limit = 20)` → últimos N feedbacks com `user_id`, `rating`, `comment`, `created_at`, flags.

### Atualizar `src/services/crm/closerDashboardPilot.ts`
- Adicionar `disableAllCloserDashboardPilots({ tenantId, reason? })` chamando a nova RPC.
- Adicionar `getActiveCloserPilots(tenantId)` (consulta `crm_user_context_view`).
- Adicionar `getEligibleClosers(tenantId)` (Closers do tenant com `requires_review=false`, `status='active'`, `is_dashboard_dynamic_enabled=false`).

---

## Hooks

### Criar `src/hooks/dashboard/useCloserDashboardObservability.ts`
Retorna `{ healthSummary, adoptionByUser, performanceSummary, feedbackSummary, feedbackList, rolloutDecision, isLoading, error, refetch }`. Usa `useQuery` para cada bloco com `staleTime: 30s` e chave `['closer-observability', kind, tenantId]`.

### Criar `src/hooks/dashboard/useDynamicDashboardFeedback.ts`
`useMutation` envolvendo `submitDynamicDashboardFeedback`. Em `onSuccess`, invalida `['closer-observability', 'feedback', tenantId]` e marca `submitted=true` localmente.

### Atualizar `src/hooks/dashboard/useCloserDashboardPilot.ts`
- Expor `activePilots`, `eligibleClosers`, `canEnableMore` (`activePilots.length < 3`), `MAX_PILOTS = 3`.
- Adicionar `useDisableAllCloserPilots()` (mutation). Em `onSuccess`, invalidar mesmas chaves do enable/disable existente + `['closer-observability', ...]`.
- Adicionar tratamento do erro `pilot_limit_reached` para mostrar mensagem amigável.

---

## Frontend — Performance em fases

Atualizar `src/components/dashboard/runtime/DynamicDashboardRuntimeGate.tsx`:
- Capturar `gateStart` no início do hook (antes do `useDynamicDashboardRuntimeGate` resolver). Quando `isLoading` virar false, calcular `gate_load_ms`.
- Marcar `shellStart` quando entra no branch `shouldRenderDynamic`. Passar callback `onShellReady(ms)` para `DynamicDashboardShell` (ou usar `useEffect` com `requestAnimationFrame` na primeira renderização do shell em modo runtime).
- Em `CloserDashboard.tsx`, quando `useCloserDashboardData` retornar dados (`isSuccess`), reportar `closer_data_load_ms` via callback prop `onDataReady` consumido pelo Gate. Idem para `pace_load_ms` (do `CloserPaceSection`).
- O gate consolida e chama `logDynamicDashboardRuntimeEvent('runtime_allowed', ...)` apenas quando todas as fases conhecidas estão prontas (com timeout de 8s para não segurar log indefinidamente — fases ausentes vão como `null`).
- `metadata` final segue exatamente o exemplo do prompt (`sprint: '6.5'`, `gate_load_ms`, `shell_render_ms`, `closer_data_load_ms`, `pace_load_ms`, `total_interactive_ms`, `performance_status`).
- `performance_status`: `good < 2000ms`, `attention 2000–5000ms`, `slow > 5000ms`.

Substituir o `useEffect` atual de log único pela versão consolidada — manter o ref `allowedLoggedRef` para garantir 1 log por sessão de render.

---

## Frontend — Componentes novos

Em `src/components/settings/adminCenter/closerDashboard/`:

1. `CloserDashboardHealthPanel.tsx` — wrapper da seção, usa `useCloserDashboardObservability`.
2. `CloserDashboardHealthCards.tsx` — 8 cards (pilotos ativos, acessos 7d, retornos legado, fallbacks, erros, tempo médio, último acesso, status de rollout). Status renderizado como `Badge` (`safe`=verde, `attention`=âmbar, `blocked`=destrutivo).
3. `CloserPilotRolloutPanel.tsx` — select de Closers elegíveis + botão "Habilitar". Botão desabilitado quando `!canEnableMore`. Mostra contador `X / 3`.
4. `ActiveCloserPilotsList.tsx` — tabela de pilotos com nome, email, último acesso, status individual, botão "Desligar".
5. `CloserDashboardFeedbackSummary.tsx` — média, total, lentos, confusos.
6. `CloserDashboardFeedbackList.tsx` — últimos comentários (user, data, rating, flags, comment).
7. `CloserPerformanceMetrics.tsx` — médias por fase, máximo, contagem `slow`.
8. `CloserRolloutDecisionCard.tsx` — título "Pronto para expandir?", badge de status, lista de motivos, link "Ver logs" (rola até `RuntimeAccessLog`).
9. `CloserRuntimeLogTable.tsx` — tabela enxuta dos últimos N eventos por tipo (reaproveita dados, NÃO substitui `RuntimeAccessLog` existente; usa-o por baixo se útil ou cria visualização compacta).
10. `CloserRollbackPanel.tsx` — três botões com confirmação:
    - "Desligar todos os Closers pilotos" → `crm_disable_all_closer_dashboard_pilots`.
    - "Desligar dashboard dinâmico do tenant" → reaproveita `disableTenantDynamicDashboards`.
    - (botão por usuário fica em `ActiveCloserPilotsList`).

Em `src/components/dashboard/closer/`:
- `CloserDashboardFeedbackCard.tsx` — só renderiza em modo runtime (prop `mode === 'runtime'`). Campos: rating 1–5 (estrelas ou botões), `is_useful`, `is_confusing`, `is_slow` (Switches/Checkboxes), `missing_info` (Input curto), `comment` (Textarea). Botão "Enviar feedback". Após envio mostra "Feedback registrado. Obrigado." Não modal, não bloqueante.

---

## Frontend — Atualizações no Admin Center

Atualizar `src/components/settings/adminCenter/AdminCenterPage.tsx`:
- Manter conteúdo atual.
- Adicionar `<Tabs>` com duas abas: "Visão geral" (conteúdo atual: Explainer + DynamicDashboardShell preview + audit/pilot/runtime logs) e "Dashboard Closer" (nova).
- A nova aba renderiza, na ordem:
  1. `CloserDashboardHealthPanel` (com `CloserDashboardHealthCards` dentro).
  2. `CloserPilotRolloutPanel` + `ActiveCloserPilotsList`.
  3. `CloserPerformanceMetrics`.
  4. `CloserDashboardFeedbackSummary` + `CloserDashboardFeedbackList`.
  5. `CloserRolloutDecisionCard`.
  6. `CloserRuntimeLogTable` (ou reuso compacto do `RuntimeAccessLog`).
  7. `CloserRollbackPanel`.

Atualizar `src/components/dashboard/closer/CloserDashboard.tsx`:
- Aceitar prop `mode?: 'runtime' | 'preview'` (default `'preview'`).
- Renderizar `CloserDashboardFeedbackCard` no final apenas quando `mode === 'runtime'`.
- Receber e propagar callbacks `onDataReady`, `onPaceReady` se vindas do gate (props opcionais).

`DynamicDashboardShell` em modo `runtime` passa `mode='runtime'` ao `CloserDashboard`.

---

## Critérios de status (implementação literal)

- **Saúde de rollout (tenant)**:
  - `safe`: `errors=0` E `fallback_rate<10%` E `avg_load_ms<3000` E `runtime_allowed>=1` E `feedback_avg_rating >= 3` (sem feedback ainda → não bloqueia).
  - `attention`: `errors>0` OU `10% <= fallback_rate <= 25%` OU `3000 <= avg_load_ms <= 5000` OU `chose_legacy_count > 2` (por usuário, qualquer um).
  - `blocked`: `runtime_error` recorrente (>=3 em 7d) OU `fallback_rate>25%` OU `avg_load_ms>5000` OU `feedback_avg_rating <= 2`.

- **Status individual (adoção)**:
  - `usage_rate = allowed / (allowed + chose_legacy)`; se denominador 0 → `sem_uso`.
  - `adotando`: `usage_rate >= 0.7` E `allowed >= 3`.
  - `testando`: `allowed BETWEEN 1 AND 2`.
  - `resistencia`: `chose_legacy > allowed`.
  - `sem_uso`: `allowed = 0`.

- **Decisão de expansão**:
  - `ready`: `errors=0`, `fallback_rate<10%`, `avg_total_interactive_ms<3000`, `feedback_avg_rating>=4`, `runtime_allowed>=3`.
  - `attention`: `errors<=2`, `10% <= fallback_rate <= 25%`, `avg_total_interactive_ms<=5000`, `feedback_avg_rating BETWEEN 3 AND 4`.
  - `hold`: `errors>2` OU `fallback_rate>25%` OU `avg_total_interactive_ms>5000` OU `feedback_avg_rating<3`.

---

## Segurança

- Toda query no front filtra por `tenant_id` resolvido via `useCurrentUser`.
- RLS na tabela de feedback restringe leitura a Owner/Admin do tenant ou ao próprio autor.
- RPCs com `security definer` + `set search_path = public` + validação de tenant/role.
- Closer **não** acessa Admin Center (já garantido pelo `isOrgAdmin` na página).
- Feedback usa `auth.uid()` na RPC; `user_id` injetado server-side.
- Sem service role no client. Sem update/delete em logs.

---

## Arquivos impactados (resumo)

Migrations:
- `supabase/migrations/<ts>_sprint_6_5_observability_and_feedback.sql` (novo)

Services:
- `src/services/crm/dynamicDashboardRuntimeLogs.ts` (estende)
- `src/services/crm/dynamicDashboardFeedback.ts` (novo)
- `src/services/crm/closerDashboardPilot.ts` (estende)

Hooks:
- `src/hooks/dashboard/useCloserDashboardObservability.ts` (novo)
- `src/hooks/dashboard/useDynamicDashboardFeedback.ts` (novo)
- `src/hooks/dashboard/useCloserDashboardPilot.ts` (estende)

Componentes (novos):
- `src/components/settings/adminCenter/closerDashboard/` (10 arquivos listados acima)
- `src/components/dashboard/closer/CloserDashboardFeedbackCard.tsx`

Componentes (alterações mínimas):
- `src/components/settings/adminCenter/AdminCenterPage.tsx` (adiciona Tabs)
- `src/components/dashboard/runtime/DynamicDashboardRuntimeGate.tsx` (faseamento de performance)
- `src/components/dashboard/dynamic/DynamicDashboardShell.tsx` (repassa `mode` e callbacks)
- `src/components/dashboard/closer/CloserDashboard.tsx` (renderiza FeedbackCard em runtime, dispara `onDataReady`)

---

## Riscos

- Mudança no constraint `action` do log: feita com DROP+ADD idempotente, sem perda de dados.
- Faseamento de performance: medições parciais retornam `null` em vez de quebrar; log nunca falha o render.
- Limite de 3 enforçado tanto na UI (botão desabilitado) quanto na RPC (defesa em profundidade).
- Sem alteração em `dynamic_user_context_enabled`, `function_automations_enabled` ou na flag global do tenant durante rollback em massa de Closers.

---

## Validação após implementação

Rodar as 6 queries de validação do prompt e os 14 testes manuais. Build TypeScript deve passar limpo. Confirmar que usuários não-Closer continuam recebendo o dashboard legado, que a 4ª ativação é bloqueada com mensagem clara, e que o rollback em massa devolve todos ao legado em uma operação.
