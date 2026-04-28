## Sprint 6.4 — Substituição Controlada da Home do Closer Piloto

### Objetivo

Quando o Closer piloto abrir a home do CRM (`/dashboard`), renderizar automaticamente o novo Dashboard Closer no lugar do dashboard legado, mantendo:
- Fallback imediato para o dashboard legado em qualquer falha de elegibilidade ou erro.
- Botão de retorno manual ao dashboard atual (preferência de sessão).
- Auditoria completa de runtime (allow / fallback / erro / escolhas do usuário).
- Zero impacto sobre SDR, CS, Manager, Admin, Owner ou usuários não piloto.

Sem redirect global, sem alteração de sidebar, login, RLS, automações ou notificações.

---

### Arquitetura do gate

A substituição acontece **dentro** de `src/pages/Dashboard.tsx`, envolvendo o resultado de `renderDashboard()` (que hoje devolve `RepDashboard`, `AEDashboard`, etc.) com um wrapper:

```text
Dashboard.tsx
 └── <DynamicDashboardRuntimeGate legacyDashboard={renderDashboard()} />
        ├── loading → skeleton curto
        ├── elegível + sem modo legado de sessão → DynamicDashboardShell(CloserDashboard)
        ├── não elegível → legacyDashboard
        └── erro de runtime → legacyDashboard + log runtime_error
```

Nenhum componente legado é alterado, movido ou reescrito.

---

### Backend (1 migração)

**Tabela** `public.crm_dynamic_dashboard_runtime_logs`
- Colunas conforme especificação (id, tenant_id, user_id, profile_key, event_type, guard_allowed, fallback_used, fallback_reason, load_ms, error_message, metadata, created_at).
- CHECK em `event_type` (`runtime_allowed`, `runtime_fallback`, `runtime_error`, `user_chose_legacy_dashboard`, `user_returned_to_dynamic_dashboard`).
- Índices `(tenant_id, user_id, created_at desc)` e `(tenant_id, event_type, created_at desc)`.
- RLS habilitado. Policy de SELECT apenas para `is_tenant_admin_or_owner(tenant_id)`. Sem INSERT/UPDATE/DELETE direto pelo client.

**RPC** `public.crm_log_dynamic_dashboard_runtime_event(...)` — `security definer`, `set search_path = public`.
- Valida que `auth.uid()` pertence ao tenant via `crm_user_context_view`.
- Permite o próprio usuário registrar eventos de si mesmo; admin/owner podem registrar para qualquer usuário do tenant.
- Trunca `error_message` para 500 chars; nunca propaga stack trace para fora.
- Retorna `jsonb { success: true, id }`.
- `revoke all from public; grant execute to authenticated`.

Nenhuma alteração em `crm_feature_flags`, `crm_user_contexts`, `crm_business_functions`, `organization_members`, `user_roles`, propostas, oportunidades, atividades, metas. Flags continuam `false` até ativação manual operacional.

---

### Frontend

**Novo hook** `src/hooks/dashboard/useDynamicDashboardRuntimeGate.ts`
- Usa `useCurrentUser()` para `tenantId` e `userId` (sempre `auth.uid()`, nunca aceita override).
- Reaproveita `useDynamicDashboardGuard(tenantId, userId)`.
- Lê `metadata.requires_review` de `crm_user_contexts` e nega se `true`.
- Estado de sessão: lê `sessionStorage['noid_use_legacy_dashboard_session']`.
- Retorna: `{ isLoading, shouldRenderDynamic, fallbackReason, resolvedProfile, resolution, context, flags, error, useLegacyForSession, setUseLegacyForSession, refresh }`.
- `setUseLegacyForSession(true|false)` grava/remove em sessionStorage, dispara invalidate da query e chama RPC `crm_log_dynamic_dashboard_runtime_event` com `user_chose_legacy_dashboard` ou `user_returned_to_dynamic_dashboard`.

**Novo componente** `src/components/dashboard/runtime/DynamicDashboardRuntimeGate.tsx`
- Props: `{ legacyDashboard: React.ReactNode }`.
- ErrorBoundary interno em volta do `DynamicDashboardShell` runtime: em qualquer erro, renderiza `legacyDashboard`, registra `runtime_error` com `error_message` enxuto, e exibe toast discreto único.
- Mede `load_ms`: marca `performance.now()` antes do render do shell; ao montar com dados prontos (callback do shell ou efeito após `guard.data?.allowed`), envia `runtime_allowed` com `load_ms`. Adiciona `metadata.warning = 'slow_load'` se > 5000ms.
- Quando o gate decide pelo legado por motivo diferente de "sessão legada manual", registra `runtime_fallback` com `fallback_reason` (mapeado de `GuardDenyReason`).
- Quando renderiza o shell runtime, injeta no `metadata` do log: `entrypoint = dashboard_home_gate`, `render_mode = dynamic_runtime`, `profile_key`, `guard_result = allowed`, `sprint = 6.4`.
- Banner de segurança (`DynamicDashboardSafeBanner` reaproveitado) e botão **Voltar ao dashboard atual** dentro do shell. Esse botão chama `setUseLegacyForSession(true)`.

**Banner no legado para piloto em modo sessão**
- Novo componente leve `src/components/dashboard/runtime/LegacySessionReturnBanner.tsx`.
- Aparece **somente** quando: usuário é piloto elegível **e** `useLegacyForSession === true`.
- Botão **Abrir novo Dashboard Closer** chama `setUseLegacyForSession(false)`.
- Não aparece para fallback automático nem para usuários não elegíveis.

**Plug do gate em `src/pages/Dashboard.tsx`**
- Passa o resultado atual de `renderDashboard()` como `legacyDashboard`.
- Renderiza `<DynamicDashboardRuntimeGate legacyDashboard={...} />` dentro do mesmo `<Layout>`.
- Renderiza `LegacySessionReturnBanner` acima do legado quando aplicável (gate expõe esse estado).

**Atualização de `CloserPilotEntryButton.tsx`**
- Quando o gate já vai renderizar o novo dashboard automaticamente (piloto elegível e sem modo legado de sessão), o botão fica oculto. Hoje só aparece quando `visible=true`; adicionar verificação adicional para esconder se o gate vai automaticamente substituir (fica ativo apenas no caso teórico em que entrypoint manual ainda fizer sentido, mas com gate pronto, o `LegacySessionReturnBanner` cobre o caso de modo legado).

**Atualização de `src/pages/DynamicDashboardPage.tsx`**
- Reaproveitar o mesmo hook `useDynamicDashboardRuntimeGate` para consistência de log (`entrypoint = direct_url` em vez de `dashboard_home_gate`).
- Para acesso direto de não piloto: continuar mostrando `DynamicDashboardFallback` com botão de voltar.

---

### Painel administrativo

Atualizar `src/components/settings/userContext/CloserPilotSection.tsx` (criado na Sprint 6.3) para incluir um card **Runtime do Dashboard Closer**:
- Último acesso runtime (`max(created_at) where event_type='runtime_allowed'`).
- Total de `runtime_allowed`, `runtime_fallback`, `runtime_error` (últimos 30 dias).
- Tempo médio e máximo de `load_ms`.
- Botões já existentes: rollback individual e rollback do tenant.
- Status atual das flags global e individual.

Atualizar `src/components/settings/adminCenter/PilotActivationLog.tsx` ou criar `RuntimeAccessLog.tsx` no Admin Center para listar os últimos 50 eventos de `crm_dynamic_dashboard_runtime_logs` (consulta SELECT já permitida pela policy admin/owner).

Sem gráficos. Tabelas e cards simples.

---

### Telemetria — convenções

Cada evento inserido via RPC carrega no `metadata`:
- `entrypoint`: `dashboard_home_gate` | `direct_url` | `legacy_session_banner`
- `render_mode`: `dynamic_runtime`
- `profile_key`: ex. `dashboard_sales_closer_placeholder`
- `guard_result`: `allowed` | `denied`
- `load_started_at`, `loaded_at`, `load_ms`
- `sprint`: `6.4`

`crm_closer_dashboard_views` continua sendo gravado com `source='runtime'` no caso allowed (mantém compatibilidade com dashboards já existentes).

---

### Critérios de aceite

Funcionais:
1. Closer piloto elegível: home renderiza novo Dashboard Closer automaticamente, com Central do Dia → Pace Diário → Top 10 → propostas → follow-ups → KPIs → deals em risco.
2. Botão **Voltar ao dashboard atual** funciona e persiste apenas na sessão.
3. Botão **Abrir novo Dashboard Closer** aparece no legado apenas em modo sessão manual e funciona.
4. Closer não piloto e usuários não Closer: sem alteração visual.
5. Desligar flag global ou flag individual ou negar resolver: fallback imediato sem erro visível.
6. Erro no novo dashboard: fallback automático + log `runtime_error` + toast discreto.
7. `/app/dynamic-dashboard` continua funcional para piloto e fallback seguro para não piloto.
8. Admin Center mostra runtime allowed, fallback, erros e tempos.

Técnicos:
1. Build e TypeScript passam.
2. Guard usa `auth.uid()`; runtime nunca aceita `targetUserId` externo.
3. RLS preservado, policies novas restritas a admin/owner para SELECT.
4. RPC com `security definer` + `set search_path = public` + grants restritos.
5. `function_automations_enabled` permanece `false`.
6. Nenhuma alteração em propostas, atividades, oportunidades, metas, sidebar, login, organization_members, user_roles.

---

### Rollback

- Operacional: `crm_disable_closer_dashboard_pilot(tenant, user)`, `crm_disable_tenant_dynamic_dashboards(tenant)`, botão de sessão.
- Técnico: remover o wrapper `DynamicDashboardRuntimeGate` do `Dashboard.tsx`. Tabela de logs e RPC permanecem. `/app/dynamic-dashboard` segue intacta.

---

### Arquivos

Criados:
- `supabase/migrations/<timestamp>_sprint_6_4_runtime_logs.sql`
- `src/hooks/dashboard/useDynamicDashboardRuntimeGate.ts`
- `src/components/dashboard/runtime/DynamicDashboardRuntimeGate.tsx`
- `src/components/dashboard/runtime/LegacySessionReturnBanner.tsx`
- `src/services/crm/dynamicDashboardRuntimeLogs.ts` (wrapper da RPC)
- `src/components/settings/adminCenter/RuntimeAccessLog.tsx`

Editados:
- `src/pages/Dashboard.tsx` (envolve com gate; sem mexer no interior do legado)
- `src/pages/DynamicDashboardPage.tsx` (reaproveita hook e log padronizado)
- `src/components/dashboard/closer/CloserPilotEntryButton.tsx` (oculta quando gate substitui)
- `src/components/settings/userContext/CloserPilotSection.tsx` (card runtime)
- `src/components/settings/adminCenter/AdminCenterPage.tsx` (inclui RuntimeAccessLog)
- `src/integrations/supabase/types.ts` (auto-gerado)

---

### Riscos e pendências para Sprint 6.5

- ErrorBoundary depende de erros lançados no shell; falhas silenciosas (timeouts internos da query) caem em `runtime_allowed` com `load_ms` alto — monitorar via `warning='slow_load'`.
- `Dashboard.tsx` continua roteando por papel; gate só atua quando o resultado corrente já seria renderizado (não conflita com SDR/CS/Manager/Owner/Admin porque o guard exige `business_function_key='closer'`).
- Sprint 6.5 pode estender o gate para outros perfis (`sdr`, `cs`) usando o mesmo wrapper, sem reescrever a home.
