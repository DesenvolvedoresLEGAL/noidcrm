# Sprint 6.3 — Piloto Controlado do Dashboard Closer + Pace Diário

Ativar o novo Dashboard Closer para **1 Closer piloto por tenant** com rollback imediato, opt‑in via botão no dashboard legado (sem redirecionamento automático), e adicionar bloco **Pace Diário** logo após a Central do Dia.

---

## Parte 1 — Banco de dados (1 migration)

**Arquivo:** `supabase/migrations/<timestamp>_sprint_6_3_pilot_and_pace.sql`

### 1.1 Tabela de auditoria de piloto
```sql
create table public.crm_dynamic_dashboard_pilot_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  target_user_id uuid not null,
  changed_by uuid not null,
  action text not null check (action in
    ('enable_pilot','disable_user_pilot','disable_tenant_dynamic_dashboard','rollback')),
  previous_global_flag boolean,
  new_global_flag boolean,
  previous_user_flag boolean,
  new_user_flag boolean,
  reason text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table ... enable row level security;
-- SELECT: somente Owner/Admin do tenant (is_tenant_admin_or_owner)
-- INSERT: bloqueado no client (apenas via RPC SECURITY DEFINER)
-- UPDATE/DELETE: bloqueado
create index on ... (tenant_id, created_at desc);
```

### 1.2 RPCs (SECURITY DEFINER, search_path = public)

- **`crm_enable_closer_dashboard_pilot(p_tenant_id, p_target_user_id, p_reason)`**
  Validações: caller pertence ao tenant; caller é Owner/Admin; target ativo no tenant; `business_function_key='closer'`; `requires_review=false`; permission/department/function não nulos. Atualiza `crm_user_contexts.is_dashboard_dynamic_enabled=true` apenas para o target. Faz UPSERT em `crm_feature_flags` ligando `dynamic_dashboards_enabled=true` apenas para `tenant_id` atual. Insere log `enable_pilot` capturando flags antes/depois. Retorna jsonb `{success, target_user_id, tenant_id, flags, rollback_hint}`.

- **`crm_disable_closer_dashboard_pilot(p_tenant_id, p_target_user_id, p_reason)`**
  Owner/Admin + mesmo tenant. Seta `is_dashboard_dynamic_enabled=false` apenas para o target. Log `disable_user_pilot`. **Não** mexe na flag global.

- **`crm_disable_tenant_dynamic_dashboards(p_tenant_id, p_reason)`**
  Owner/Admin + mesmo tenant. Seta `dynamic_dashboards_enabled=false` no tenant. Log `disable_tenant_dynamic_dashboard`. **Não** desliga `function_automations_enabled`. **Não** liga `dynamic_user_context_enabled`.

Todas com `GRANT EXECUTE ... TO authenticated`.

### 1.3 RPC `crm_get_closer_dashboard_data` — adicionar `pace`

Estender o RPC existente para calcular e retornar a chave `pace` no JSON:

- Fonte de meta: reusar a lógica atual (`sales_goals` -> `seller_targets`) + considerar `ote_seller_configs` + `ote_levels` (`monthly_goal`, `goal_type='revenue'`) que já alimentam o RepPACE legado. Se houver meta por nível OTE para o usuário, usar `custom_goal_override` ou `ote_levels.monthly_goal`. Registrar `goal_source` no metadata.
- Dias úteis: segunda a sexta, **sem feriados** na v1 → `business_days_rule = 'monday_to_friday_no_holidays_v1'`. Se `holidays` retornar linhas para o tenant no mês atual, usar e marcar `'calendar_table'`.
- Cálculos (sempre **mês atual**, independente de `p_period`):
  - `business_days_total`, `business_days_elapsed` (incluir hoje se útil), `business_days_remaining`
  - `expected_pace_today = goal/total * elapsed`
  - `pace_gap_value = realized - expected`
  - `remaining_to_goal = max(goal - realized, 0)`
  - `required_daily_rate = remaining_to_goal / NULLIF(remaining,0)` (fallback `remaining_to_goal` se `remaining=0`)
  - `current_daily_average = realized / NULLIF(elapsed,1)`
  - `pace_percent = realized/expected*100`
- Status:
  - `pace_percent >= 105` → `Acima do pace` / `success`
  - `>= 95` → `No pace` / `info`
  - `>= 75` → `Atrasado` / `attention`
  - `< 75` → `Crítico` / `critical`
- Proteções: meta nula/0 ou `business_days_total=0` → retornar `{available:false, status:'Meta não configurada', severity:'warning', reason:'...'}`.
- Sempre adicionar `pace_uses_current_month=true` no `metadata`.

---

## Parte 2 — Frontend

### 2.1 Tipos — `src/types/dashboard/closer.ts`
Acrescentar:
```ts
export type CloserPaceStatus = 'Acima do pace' | 'No pace' | 'Atrasado' | 'Crítico' | 'Meta não configurada';
export type CloserPaceSeverity = 'success' | 'info' | 'attention' | 'critical' | 'warning';
export interface CloserPaceData {
  available: boolean;
  reason?: string;
  goal_value?: number; realized_value?: number; goal_attainment_percent?: number;
  business_days_total?: number; business_days_elapsed?: number; business_days_remaining?: number;
  expected_pace_today?: number; pace_gap_value?: number; remaining_to_goal?: number;
  required_daily_rate?: number; current_daily_average?: number; pace_percent?: number;
  status: CloserPaceStatus; severity: CloserPaceSeverity;
  business_days_rule?: string; why_here?: string;
}
```
Adicionar `pace?: CloserPaceData` em `CloserDashboardData`.

### 2.2 Componentes Pace — `src/components/dashboard/closer/`
- **`CloserPaceSection.tsx`** — Header + status card grande + grid 8 cards + barra de progresso da meta. Trata `available=false` com aviso amigável.
- **`CloserPaceCard.tsx`** — Card reutilizável (label, valor, hint, severity opcional).
- **`CloserPaceStatusBadge.tsx`** — Badge colorido por severity.
- **`CloserPaceProgress.tsx`** — Barra horizontal (realizado vs meta) com marcador de pace esperado hoje.

### 2.3 Inserir Pace no `CloserDashboard.tsx`
Nova ordem: `CentralDoDia` → **`CloserPaceSection`** → `CloserTopActions` → listas → `CloserKpiGrid` → `CloserRiskDealsList`. Manter KPIs intactos (sem duplicar destaque da meta).

### 2.4 Serviço de piloto — `src/services/crm/closerDashboardPilot.ts` (novo)
Wrappers para as 3 RPCs + listagem dos logs (`select * from crm_dynamic_dashboard_pilot_logs ... order by created_at desc limit 50`).

### 2.5 Hooks — `src/hooks/dashboard/useCloserDashboardPilot.ts` (novo)
- `useEnableCloserPilot()`, `useDisableCloserPilot()`, `useDisableTenantDynamicDashboards()` (mutations com invalidação de `crm_feature_flags`, `crm_user_contexts` e `dynamic-dashboard-guard`).
- `usePilotEligibleClosers(tenantId)` — lista usuários com `business_function_key='closer'`, `status='active'`, expondo `requires_review`.
- `useTenantDynamicFlag(tenantId)` — leitura de `crm_feature_flags`.
- `usePilotLogs(tenantId)`.

### 2.6 UI do piloto — `src/components/settings/userContext/CloserPilotSection.tsx` (novo)
Render dentro do `UserContextTab` (acima da tabela atual) com:
- Tenant atual (read‑only).
- Combobox de Closers elegíveis com badge de revisão (Validado / Revisar / Incompleto).
- Status de `dynamic_dashboards_enabled` (tenant) e `is_dashboard_dynamic_enabled` (user).
- Botões: **Habilitar piloto** (desabilitado se `requires_review`), **Desligar piloto deste Closer**, **Desligar dashboard dinâmico neste tenant**.
- Texto de rollback imediato.
- Apenas visível para Owner/Admin (reusar guarda existente do `UserContextTab`).

### 2.7 Botão opt‑in no dashboard legado
- **Hook novo** `src/hooks/dashboard/useCloserPilotEntrypoint.ts`: usa `useCurrentUser` + `useDynamicDashboardGuard(tenantId, userId)` — retorna `{visible: boolean}` apenas se **todas** as condições passarem (global flag, user flag, `bfKey='closer'`, resolver OK, profile resolvido, `requires_review=false`).
- **Componente novo** `src/components/dashboard/closer/CloserPilotEntryButton.tsx`: card discreto com título "Experimentar novo Dashboard Closer", subtexto, botão que `navigate('/app/dynamic-dashboard')`. Renderiza `null` se `visible=false`.
- **Integração** em `RepDashboard.tsx`: inserir o componente logo após `DashboardHeader` (antes do `RepKPICards`). Sem alterar nenhum outro dashboard.

### 2.8 Página dinâmica — `DynamicDashboardPage.tsx`
Já existe e já loga runtime view. Atualizar `metadata` enviado para incluir `{sprint:'6.3', entrypoint:'direct_url', pilot_enabled, global_flag, user_flag}` (entrypoint baseado em `location.state?.from === 'legacy_button'` quando vier do botão; fallback `direct_url`). Botão "Voltar ao dashboard atual" já existe no `DynamicDashboardSafeBanner` (apenas navegação, não desliga flags) — manter como está.

### 2.9 Auditoria UI — Admin Center
Reusar `CloserDashboardAuditLog` existente; adicionar nova aba/seção **"Logs de piloto"** (`PilotActivationLog.tsx`) que lista entradas de `crm_dynamic_dashboard_pilot_logs` (action, target, changed_by, reason, flags antes/depois, data).

### 2.10 Tipos Supabase
`src/integrations/supabase/types.ts` será regenerado automaticamente pela migration. Não editar manualmente.

---

## Segurança e regras invioláveis

- `auth.uid()` obrigatório como `targetUserId` no runtime. Preview admin continua aceitando outro target.
- Nenhuma flag global ativada fora do tenant atual do caller.
- `function_automations_enabled` permanece **false**.
- `dynamic_user_context_enabled` permanece **false** (guard atual não exige).
- Sem redirect automático em lugar nenhum (sem `<Navigate>` para `/app/dynamic-dashboard`).
- Sidebar global, login, permissões, dashboards de SDR/CS/Manager/Admin/Owner: **intactos**.
- Sem criação de tarefas, notificações, automações ou alterações em propostas/negócios/atividades.

---

## Critérios de validação (queries entregues no final)

```sql
-- Apenas tenant piloto com flag ligada
select tenant_id, key, enabled from crm_feature_flags where key='dynamic_dashboards_enabled';

-- Apenas o usuário piloto com user flag
select tenant_id, user_id, is_dashboard_dynamic_enabled
from crm_user_contexts where is_dashboard_dynamic_enabled = true;

-- Logs por ação
select action, count(*) from crm_dynamic_dashboard_pilot_logs group by action;

-- Views runtime/preview
select source, period, count(*) from crm_closer_dashboard_views group by source, period;

-- Confirmar function_automations_enabled = false
select count(*) from crm_feature_flags where key='function_automations_enabled' and enabled=true;
```

---

## Entregáveis

1. **Migration** com tabela `crm_dynamic_dashboard_pilot_logs`, 3 RPCs de piloto e RPC `crm_get_closer_dashboard_data` estendida com `pace`.
2. **Componentes novos**: `CloserPaceSection`, `CloserPaceCard`, `CloserPaceStatusBadge`, `CloserPaceProgress`, `CloserPilotEntryButton`, `CloserPilotSection`, `PilotActivationLog`.
3. **Hooks/Serviços novos**: `useCloserDashboardPilot`, `useCloserPilotEntrypoint`, `closerDashboardPilot.ts`.
4. **Edições**: `CloserDashboard.tsx` (ordem + Pace), `closer.ts` (tipos), `RepDashboard.tsx` (botão opt‑in), `UserContextTab.tsx` (seção de piloto), `AdminCenterPage.tsx` (logs de piloto), `DynamicDashboardPage.tsx` (metadata `entrypoint`).
5. Resumo final com instruções de habilitar piloto / rollback individual / rollback de tenant + resultado das queries de validação.

---

## Riscos e mitigação

- **Meta indisponível**: Pace renderiza warning sem quebrar o dashboard.
- **Flag global afetando outros usuários do tenant**: Mitigado pelo botão opt‑in só aparecer com 5 condições combinadas; outros usuários não veem botão e caem no fallback se acessarem URL.
- **Closer trocando de função após habilitar piloto**: Guard recalcula a cada query (`staleTime 30s`); botão e runtime caem automaticamente.
- **Divisão por zero no Pace**: NULLIF + fallbacks explícitos.
