
# Sprint 6 — Dashboard Closer Real v1

Objetivo: plugar dados reais do CRM em um Dashboard Closer renderizado dentro do `DynamicDashboardShell`, exclusivamente em preview Owner/Admin (Configurações > Equipes e Usuários > Contexto CRM). Nada em produção muda: nem dashboard real, nem sidebar, nem rotas, nem flags, nem permissões.

---

## 1. Schema confirmado (auditoria)

Fontes reais identificadas no banco:

- Oportunidades: `public.opportunities` — `organization_id`, `owner_user_id`, `status` (`new|open|won|lost`), `stage_id`, `valor_previsto`, `closed_at`, `won_at`, `next_followup_date`, `last_contact_date`, `deleted_at`, `prob`, `risk_score`.
- Etapas: `public.stages` (`id`, `name`, `pipeline_id`, `order_index`, `probability`).
- Histórico de etapa: `public.opportunity_stage_history` (`changed_at`, `to_stage_id`) → para "deal parado".
- Propostas: `public.proposals` — `organization_id`, `opportunity_id`, `status` (`draft|sent|viewed|accepted|declined|expired`), `value`, `sent_at`, `viewed_at`, `expires_at`, `last_viewed_at`, `views_count`, `accepted_at`, `declined_at`. Owner = `opportunities.owner_user_id` via join.
- Visualizações de proposta: `public.proposal_views` (`proposal_id`, `viewed_at`).
- Atividades: `public.activities` — `organization_id`, `owner_user_id`, `opportunity_id`, `status` (`pending|completed|cancelled`), `scheduled_date`, `completed_at`, `deleted_at`.
- Metas: `public.sales_goals` (mensal, por `user_id` + `period_start/end`, `target_value`) e `public.seller_targets` (`monthly_revenue_target`, `period_month`). Usaremos `sales_goals` como primária e `seller_targets` como fallback.
- Contexto Closer: `public.crm_user_context_view` com `business_function_key='closer'`.

Todas as métricas pedidas têm fonte. Não haverá `unavailable` por ausência de schema; reservaremos esse status apenas para falhas pontuais futuras.

---

## 2. Backend — uma única RPC consolidada

Migração nova:

`public.crm_get_closer_dashboard_data(p_tenant_id uuid, p_user_id uuid, p_period text default 'current_month', p_start_date date default null, p_end_date date default null) returns jsonb`

- `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`.
- Validações iniciais (raise EXCEPTION em caso de violação):
  1. `auth.uid()` pertence a `p_tenant_id` (via `organization_members` ativo).
  2. Caller é Owner ou Admin do tenant (`user_is_org_admin(p_tenant_id)` OU role `owner`); senão, só pode consultar o próprio `user_id`.
  3. `p_user_id` pertence ao tenant.
  4. `p_user_id` tem `business_function_key='closer'` em `crm_user_context_view`. Se não, retorna JSON com `{ "error": "not_a_closer" }` mas sem raise (para o shell renderizar mensagem amigável).
- Resolve janela `[start_ts, end_ts]` a partir de `p_period`:
  - `current_month`: mês corrente até agora.
  - `last_7_days` / `last_30_days`: now() − N dias.
  - `current_quarter`: trimestre vigente.
  - `custom`: usa `p_start_date`/`p_end_date`.
- Calcula em CTEs todas as métricas e devolve `jsonb` no contrato exigido (user, context, period, kpis, lists, availability, metadata).

Mapeamento das métricas:

- **open_pipeline**: `opportunities` onde `organization_id=tenant`, `owner_user_id=user`, `status IN ('new','open')`, `deleted_at IS NULL`. Soma `valor_previsto` + count.
- **proposals_open**: `proposals` join `opportunities` em `opp.owner_user_id=user`, `proposals.status IN ('sent','viewed')`, `accepted_at IS NULL`, `declined_at IS NULL`. Soma `value` + count.
- **proposals_viewed_count**: `proposals` com `last_viewed_at` dentro do período (mesmo join de owner).
- **overdue_followups**: `activities` com `owner_user_id=user`, `status='pending'`, `scheduled_date < now()`, `deleted_at IS NULL`. Count + lista top 10 por mais antigos.
- **risk_deals**: oportunidades abertas com pelo menos um sinal: (a) sem `last_contact_date` há > 7 dias, (b) `proposals.status IN ('sent','viewed')` há > 3 dias sem resposta, (c) follow-up vencido associado, (d) parado na mesma etapa há > 7 dias via `opportunity_stage_history`, (e) `prob < 30`. Lista top 10 por `valor_previsto desc`.
- **monthly_goal_value**: `sales_goals` onde `user_id=user`, `period_type='monthly'`, mês corrente. Fallback: `seller_targets.monthly_revenue_target` para `period_month` corrente. Sem registro → `null` + `availability.goals='unavailable'`.
- **monthly_revenue_value**: `opportunities` `status='won'`, `closed_at` no período (mês corrente especificamente para o KPI, independente do filtro — manter consistência com a memória "Win Rate usa closed_at"). Soma `valor_previsto`.
- **win_rate_percent**: won/(won+lost) com `closed_at` no período, `owner_user_id=user`, exclui `deleted_at`.
- **average_ticket_value**: revenue/won_count no período. `null` se won_count=0.
- **next_actions**: gerado em CTE com regras determinísticas e prioridade 1–8 (proposta visualizada hoje sem follow-up, proposta vencendo hoje, follow-up vencido, proposta vencida, deal alto valor sem próxima atividade, deal parado >7 dias, proposta vencendo em 48h, proposta enviada sem resposta >3 dias). Top 10 ordenados por prioridade asc + valor desc.
- **Central do Dia** (no JSON em `central_do_dia`):
  - `today_activities_count`, `overdue_followups_count`, `proposals_expiring_today`, `proposals_expiring_48h`, `proposals_expired`, `proposals_viewed_no_followup`, `opportunities_without_next_activity`, `stalled_opportunities`.
  - Listas: `today_agenda` (top 10), `overdue_followups` (top 10), `proposals_action_required` (unifica vencendo/vencidas/visualizadas-sem-followup, top 10), `top_actions_today` (alias do next_actions filtrado por hoje).

Grants:
```
revoke all on function public.crm_get_closer_dashboard_data(uuid,uuid,text,date,date) from public;
grant execute on function public.crm_get_closer_dashboard_data(uuid,uuid,text,date,date) to authenticated;
```

Sem alterações em RLS, policies, tabelas existentes ou flags.

---

## 3. Frontend — service, hook e componentes

### 3.1 Service `src/services/crm/closerDashboard.ts`
- `type CloserDashboardParams` (tenantId, userId, period, startDate?, endDate?).
- `getCloserDashboardData(params)` → chama `supabase.rpc('crm_get_closer_dashboard_data', ...)` e devolve o JSON tipado.

### 3.2 Tipos `src/types/dashboard/closer.ts`
- `CloserDashboardData`, `CloserDashboardKpis`, `CloserCentralDoDia`, `CloserNextAction`, `CloserRiskDeal`, `CloserOverdueFollowup`, `CloserViewedProposal`, `CloserPeriodKey`, `CloserWidgetAvailability`.

### 3.3 Hook `src/hooks/dashboard/useCloserDashboardData.ts`
- React Query (`useQuery`) chaveado por `['closer-dashboard', tenantId, userId, period, customRange]`.
- `enabled` apenas quando: tenantId + userId + caller Owner/Admin no preview (recebido por prop/contexto, sem lógica nova de auth).
- Estado local de `period` + `customRange` + setters.
- Retorna `{ data, isLoading, error, refetch, period, setPeriod, customRange, setCustomRange, isEmpty, unavailableWidgets }`.

### 3.4 Componentes `src/components/dashboard/closer/`
Estrutura enxuta (consolidando alguns arquivos para evitar inflação):
- `CloserDashboard.tsx` (orquestrador: header + filtro + Central do Dia + Próximas Ações + Propostas que exigem ação + Deals em risco + KpiGrid + Pipeline por etapa).
- `CloserDashboardHeader.tsx` + `CloserPeriodFilter.tsx`.
- `CentralDoDiaSection.tsx` (cards + 4 listas internas).
- `CloserKpiGrid.tsx` (8 cards: pipeline, propostas na mesa, propostas visualizadas, follow-ups, risco, meta, win rate, ticket).
- `CloserNextActionsList.tsx`.
- `CloserRiskDealsList.tsx`.
- `CloserProposalsActionList.tsx`.
- `CloserPipelineByStage.tsx` (barras simples com `div` — sem nova lib).
- `CloserDashboardSkeleton.tsx`, `CloserDashboardEmptyState.tsx`, `CloserDashboardErrorState.tsx`, `CloserNotACloserState.tsx`.
- Cards de KPI usam `Card`/`CardContent` do design system existente; formatação monetária via util já existente em `src/lib/utils.ts` se houver, senão `Intl.NumberFormat('pt-BR')`.

### 3.5 Integração com `DynamicDashboardShell`
- Estender props com `targetUserId?: string` e `tenantId?: string` (opcionais; default mantém comportamento atual).
- No corpo do shell, antes de renderizar widgets placeholder:
  - Se `profile?.key === 'dashboard_sales_closer_placeholder'` **e** `tenantId` **e** `targetUserId` presentes → renderizar `<CloserDashboard tenantId targetUserId />` em vez do grid placeholder.
  - Caso contrário (sem targetUserId), manter alerta + grid placeholder atual.
- O alerta "Este shell ainda não exibe dados reais" só aparece quando NÃO estamos no caminho Closer real.

### 3.6 `DashboardPreviewModal`
- Passar `tenantId` e `targetUserId={row?.user_id}` ao `DynamicDashboardShell`.
- Quando profile resolvido for `dashboard_sales_closer_placeholder`:
  - Adicionar Alert info: "Este dashboard usa dados reais do CRM, mas ainda não altera a tela principal do usuário."
  - Se `requires_review`, manter alerta de revisão já existente em `DashboardResolutionDetails`.

Nenhuma outra tela (sidebar, login, Dashboard real, AdminCenterPage) é tocada. AdminCenterPage continua com placeholder admin e não chama o Closer.

---

## 4. Estados, segurança e performance

- Loading: `CloserDashboardSkeleton`.
- Erro RPC: `CloserDashboardErrorState` ("Não foi possível carregar o Dashboard Closer. O dashboard atual do CRM permanece seguro.").
- `data.error === 'not_a_closer'` → `CloserNotACloserState`.
- KPIs com `availability !== 'ready'` → card mostra "Não disponível" + reason.
- `availability.goals='unavailable'` quando não houver `sales_goals` nem `seller_targets`.
- Listas hard-cap em 10 itens (já no SQL via `LIMIT 10`).
- Toda query via RPC (uma round-trip), sem N+1 no frontend.
- Tenant/user validados dentro da RPC; nenhum service-role no client.

---

## 5. Validações finais

- Build/TS verde.
- Flags continuam `false` (verificado por SQL).
- 1 profile `dashboard_sales_closer_placeholder` por tenant (já garantido pela Sprint 4.1.1).
- Smoke test manual: abrir preview de Closer existente → renderiza Central do Dia + KPIs com dados reais; alterar filtro de período → React Query refaz query; abrir preview de não-Closer → mantém placeholder atual; Dashboard real (`/`) inalterado; sidebar inalterada.

---

## 6. Riscos / pendências para Sprint 6.1
- "Deal parado" depende de `opportunity_stage_history`; em tenants sem histórico, sinal cai silenciosamente.
- Win-rate por período pode divergir do CEO Dashboard se filtros customizados forem usados — manteremos a regra global da memória (closed_at, exclui soft-delete, sales pipeline). KPI "Realizado no mês" sempre usa mês corrente para evitar conflito com a unified rule.
- Próxima sprint (6.1) pode introduzir runtime real opt-in via flag e rota `/dashboard/closer-preview` se necessário.

---

## Arquivos a criar/editar

Criar:
- `supabase/migrations/<ts>_crm_get_closer_dashboard_data.sql`
- `src/services/crm/closerDashboard.ts`
- `src/types/dashboard/closer.ts`
- `src/hooks/dashboard/useCloserDashboardData.ts`
- `src/components/dashboard/closer/CloserDashboard.tsx`
- `src/components/dashboard/closer/CloserDashboardHeader.tsx`
- `src/components/dashboard/closer/CloserPeriodFilter.tsx`
- `src/components/dashboard/closer/CentralDoDiaSection.tsx`
- `src/components/dashboard/closer/CloserKpiGrid.tsx`
- `src/components/dashboard/closer/CloserNextActionsList.tsx`
- `src/components/dashboard/closer/CloserRiskDealsList.tsx`
- `src/components/dashboard/closer/CloserProposalsActionList.tsx`
- `src/components/dashboard/closer/CloserPipelineByStage.tsx`
- `src/components/dashboard/closer/CloserDashboardSkeleton.tsx`
- `src/components/dashboard/closer/CloserDashboardEmptyState.tsx`
- `src/components/dashboard/closer/CloserDashboardErrorState.tsx`
- `src/components/dashboard/closer/CloserNotACloserState.tsx`

Editar (mínimo):
- `src/components/dashboard/dynamic/DynamicDashboardShell.tsx` — props `tenantId`/`targetUserId` + branch para Closer.
- `src/components/settings/dashboardResolver/DashboardPreviewModal.tsx` — passar props + alert informativo.
