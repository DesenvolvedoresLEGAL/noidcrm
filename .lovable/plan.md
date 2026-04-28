# Sprint 5: Dynamic Dashboard Shell + Admin Center Entry

Criar um chassi visual reutilizável que renderiza qualquer profile de `crm_dashboard_profiles` e expor o Admin Center como uma área administrativa em Configurações. O dashboard real do NOID, sidebar global, login, rotas críticas e feature flags **não são alterados**.

## Estado já validado no banco

- 8 organizações × 17 profiles cada (validado).
- `dashboard_admin_placeholder` já tem `name = "Admin Center"`, `metadata.is_admin_center = true` e widgets `crm_health`, `integrations`, `data_quality`.
- Flags `dynamic_dashboards_enabled`, `dynamic_user_context_enabled`, `function_automations_enabled` continuam `false`.
- Resolver com `owner_override` operacional.

Conclusão: **nenhuma migração nova é necessária**. Trabalho 100% frontend.

## Componentes que serão criados

Estrutura nova em `src/components/dashboard/dynamic/`:

```text
DynamicDashboardShell.tsx     -> orquestra header + grid + estados
DynamicDashboardHeader.tsx    -> nome, descrição, escopo, badges
DynamicDashboardGrid.tsx      -> grid responsivo (1/2/3/4 cols)
DynamicWidgetRenderer.tsx     -> card neutro por widget + ícone por key
DynamicDashboardState.tsx     -> loading/empty/error/legacy/unsupported/forbidden
```

Cada componente é puro, recebe props tipadas e nunca busca dados reais (sem queries de pipeline, receita, propostas, leads, forecast).

### Comportamento do `DynamicDashboardShell`

- `profile = null` → estado `empty` ("O dashboard padrão continuará sendo usado").
- `profile.layout.type = "legacy"` → estado `legacy`.
- `profile.layout.type = "placeholder"` ou `"dynamic_placeholder"` → header + grid de widgets placeholder.
- Layout desconhecido → estado `unsupported` (não quebra a tela).
- JSON inválido em widgets → cada widget é renderizado defensivamente; widgets desconhecidos viram badge "Não implementado".
- `mode` = `preview | admin_center | future_runtime` controla apenas badges/avisos no header.

### Badges no header

- `Preview` (sempre em modo preview).
- `Placeholder` (sempre — não há dados reais).
- `Admin Center` (se `metadata.is_admin_center`).
- `Owner Cockpit` (se `resolution.resolution_source === 'owner_override'`).
- `Fallback` (se `resolution.fallback_used`).

## Hook novo

`src/hooks/dashboard/useDynamicDashboardShell.ts`

- Recebe `profile` e opcionalmente `resolution`.
- Normaliza: `layoutType`, `widgets[]`, `isLegacy`, `isPlaceholder`, `isAdminCenter`, `isUnsupported`, `badges[]`, `safeTitle`, `safeDescription`.

## Service e hooks ampliados

`src/services/crm/dashboardProfiles.ts`:
- Adicionar `getDashboardProfileByKey(tenantId, key)`.
- Adicionar `getAdminCenterProfile(tenantId)` (busca `dashboard_admin_placeholder`).
- Garantir filtro `tenant_id` + `is_active = true` em ambos.

`src/hooks/dashboard/useDashboardResolver.ts`:
- Adicionar `useDashboardProfileByKey(profileKey)`.
- Adicionar `useAdminCenterProfile()`.
- Tipos atualizados (já existe `owner_override` em `DashboardResolutionSource`).

## Modal de Preview enriquecido

Atualizar `src/components/settings/dashboardResolver/DashboardPreviewModal.tsx`:
- Manter aviso fixo, dados do usuário, resolução, candidatos.
- Substituir o bloco atual de widgets por `<DynamicDashboardShell mode="preview" profile={...} resolution={...} />`.
- Sem botão de ativar.

Criar componente novo `DashboardResolutionDetails.tsx` extraindo o bloco de "fonte/fallback/uso real" para reuso.

## Admin Center

Estrutura nova em `src/components/settings/adminCenter/`:

```text
AdminCenterCard.tsx       -> card de entrada (CTA "Abrir Admin Center")
AdminCenterPage.tsx       -> página completa do Admin Center
AdminCenterExplainer.tsx  -> card "Admin não é cargo. É permissão."
```

### Onde aparece

- **Aba nova** "Admin Center" em `Configurações > Equipes e Usuários`, ao lado de Usuários / Equipes / Contexto CRM.
- Visível **apenas** para Owner/Admin (mesma checagem `isOrgAdmin` já usada na aba Contexto CRM).
- **Não toca na sidebar global** nem cria rota nova.
- Card de entrada `AdminCenterCard` opcional dentro da aba Contexto CRM apontando para a aba Admin Center (curto, contextual).

### Conteúdo da página

1. `AdminCenterExplainer` — card com o texto exato:
   > **Admin não é cargo. É permissão.**
   > Usuários Admin podem gerenciar configurações do CRM, mas o dashboard principal continua seguindo a função operacional da pessoa. Ex.: alguém do Financeiro com permissão Admin continuará vendo o dashboard financeiro quando os dashboards dinâmicos forem ativados.
2. `DynamicDashboardShell` em modo `admin_center`, alimentado por `useAdminCenterProfile()`.
3. Fallbacks:
   - Erro no fetch → "Não foi possível carregar o Admin Center. As configurações atuais continuam funcionando."
   - Profile ausente → "Admin Center ainda não foi configurado para este tenant."
   - Widgets vazios → "Nenhum widget placeholder configurado."

### Permissão

- Frontend: gate `isOrgAdmin`. Não-admins veem `Alert` "Você não tem permissão para visualizar esta área."
- Backend: já protegido por RLS de `crm_dashboard_profiles` (apenas membros do tenant leem; admins/owners gerenciam).

## Arquivos alterados/criados

**Criados:**
- `src/components/dashboard/dynamic/DynamicDashboardShell.tsx`
- `src/components/dashboard/dynamic/DynamicDashboardHeader.tsx`
- `src/components/dashboard/dynamic/DynamicDashboardGrid.tsx`
- `src/components/dashboard/dynamic/DynamicWidgetRenderer.tsx`
- `src/components/dashboard/dynamic/DynamicDashboardState.tsx`
- `src/components/settings/adminCenter/AdminCenterCard.tsx`
- `src/components/settings/adminCenter/AdminCenterPage.tsx`
- `src/components/settings/adminCenter/AdminCenterExplainer.tsx`
- `src/components/settings/dashboardResolver/DashboardResolutionDetails.tsx`
- `src/hooks/dashboard/useDynamicDashboardShell.ts`

**Editados:**
- `src/services/crm/dashboardProfiles.ts` (+ 2 funções)
- `src/hooks/dashboard/useDashboardResolver.ts` (+ 2 hooks)
- `src/components/settings/dashboardResolver/DashboardPreviewModal.tsx` (usa o shell)
- `src/pages/settings/TeamsAndUsers.tsx` (+ aba "Admin Center" gated)

**Não tocados:**
- `src/App.tsx` (sem rotas novas)
- Sidebar global, layouts, login, dashboard real
- Migrações / RLS / RPCs (sem mudança no banco)

## Fora do escopo (explicitamente)

- Nenhuma feature flag é ativada.
- Nenhum dado real (receita, leads, pipeline, forecast, CAC, LTV, clientes) é buscado.
- Nenhuma rota nova na sidebar.
- Sem alteração em `crm_user_contexts`, `crm_feature_flags`, `organization_members`, `user_roles`.
- Sem mudança no resolver ou nos profiles existentes.

## Validação após implementação

Frontend:
1. Owner → Preview → shell renderiza Cockpit Owner com badge `Owner Cockpit` (via `owner_override`).
2. Closer → Preview → shell renderiza "Dashboard Closer" com 3 widgets placeholder.
3. `requires_review` → Preview → shell + alerta amarelo de revisão.
4. Admin/Owner → aba "Admin Center" → renderiza shell com 3 widgets (Saúde do CRM / Integrações / Qualidade de dados) + explainer.
5. Manager/User → não vê aba Admin Center nem botão Preview (gate `isOrgAdmin`).
6. Dashboard real, sidebar, login e rotas → intactos.

SQL pós-uso:
- Profiles por org continuam 17.
- Sem duplicatas em `(tenant, scope_type, scope_key)`.
- Logs de preview ainda com `fallback_used = true`, `fallback_reason = 'dynamic_dashboards_disabled'`.
- Flags continuam `false`.

## Risco

Baixo. Tudo é frontend isolado e gateado por `isOrgAdmin`. Modal de preview já existia; estamos enriquecendo, não substituindo. Nenhuma rota crítica do app é tocada.
