# Sprint 3 — UI segura de revisão e edição do contexto de usuários

## Auditoria da tela atual (Equipes e Usuários)

| Item | Onde está hoje |
|---|---|
| Página | `src/pages/settings/TeamsAndUsers.tsx` (Tabs: Usuários / Equipes) |
| Listagem | `src/components/settings/UsersContent.tsx` (sub-tabs: Ativos, Inativos, Excluídos, Aguardando, Histórico) |
| Hook tenant + admin | `useCurrentUser` (`organization`, `isOrgAdmin`) |
| Convite | `InviteUserModal`, `BulkCreateUsersModal` |
| Edição legada | navega para `/app/settings/users/:id/edit` |
| Padrões UI | `Card`, `Tabs`, `Table`, `Badge`, `Select`, `Dialog`, `sonner toast` |
| Filtros | busca + select de função (`org_role`) |

Decisão: **adicionar uma terceira aba "Contexto CRM"** no `TeamsAndUsers.tsx`, ao lado de Usuários/Equipes. Não tocar em `UsersContent.tsx`. Risco mínimo, isolamento total, fácil rollback.

## Estratégia geral

- Aditivo, sem reescrever nada existente.
- Toda escrita protegida por RLS (`is_tenant_admin_or_owner`).
- Nenhuma feature flag é ativada.
- Frontend bloqueia edição para não-admin, mas a segurança real está na RLS.
- Fallback gracioso se `crm_user_context_view` falhar — aba mostra erro discreto, demais abas continuam.

## 1. Banco — migração única

### Tabela `public.crm_user_context_change_logs`
Conforme spec: `id, tenant_id, user_id, changed_by, change_type, previous/new (permission_key, department_key, business_function_key), previous/new status, review_note, metadata jsonb, created_at`. Check constraint em `change_type ∈ {manual_context_update, manual_review_completed, context_created_from_ui}`. Append-only (sem update/delete).

### Índices
- `(tenant_id, user_id)`
- `(tenant_id, created_at desc)`

### RLS
- ENABLE RLS
- SELECT: `is_tenant_admin_or_owner(tenant_id)`
- INSERT: `is_tenant_admin_or_owner(tenant_id)` com `WITH CHECK` validando também `changed_by = auth.uid()`
- Sem policies de UPDATE/DELETE

### RPC `public.crm_save_user_context(payload jsonb) returns jsonb`
SECURITY DEFINER, `search_path = public`. Faz tudo em uma transação:
1. Valida `is_tenant_admin_or_owner(_tenant_id)` — caso contrário, raise.
2. Valida que `business_function.department_id = department_id` informado.
3. Lê contexto anterior (se existir) para resolver previous keys.
4. UPSERT em `crm_user_contexts` por `(tenant_id, user_id)`:
   - Faz `metadata = coalesce(prev.metadata, '{}'::jsonb) || novo_metadata` (merge não destrutivo).
   - Adiciona `last_manual_review_at`, `last_manual_review_by`, `review_source = 'user_context_sprint_3_ui'`.
   - Se mudou permissão/área/função → grava `previous_context` em metadata.
   - Se `mark_as_reviewed = true` → `requires_review = false`.
   - Se contexto novo → `created_by_sprint = 'user_context_sprint_3_ui'`, flags dinâmicas false.
5. INSERT em `crm_user_context_change_logs` com previous/new keys + change_type adequado.
6. Retorna `{context_id, change_type, requires_review}`.

Motivo do RPC: garante atomicidade contexto+log e valida cross-field (função pertence à área) sem confiar no cliente.

### Não fazer no banco
- Sem alterar `organization_members`, `user_roles`, `profiles`, `team_members`.
- Sem mexer em feature flags.
- Sem trigger `updated_at` na tabela de logs (append-only).

## 2. Frontend — novos arquivos

### Hooks (`src/hooks/userContext/`)
- `useUserContextOptions.ts` — busca paralela: `crm_permission_roles`, `crm_departments`, `crm_business_functions` ativas do tenant, ordenadas. React Query, `staleTime: 5min`.
- `useUserContexts.ts` — lista de `crm_user_context_view` filtrada por tenant. Faz LEFT JOIN client-side com membros ativos de `organization_members` para mostrar usuários **sem contexto** também. Retorna `{ rows, byUserId }`. Trata erro retornando `error` sem quebrar.
- `useUserContextStats.ts` — derivado de `useUserContexts`: total, requires_review, sem_contexto, incompletos.
- `useSaveUserContext.ts` — mutation que chama RPC `crm_save_user_context`, invalida `useUserContexts` + `useUserContextStats`, toast sonner sucesso/erro.

### Serviço (`src/services/crm/userContext.ts`)
- `fetchUserContexts(tenantId)`
- `fetchContextOptions(tenantId)`
- `saveUserContext(payload)` → invoca RPC

Padrão idêntico ao resto de `src/services/crm/`.

### Componentes (`src/components/settings/userContext/`)
- `UserContextTab.tsx` — entrypoint. Renderiza:
  - 4 cards de resumo no topo (`UserContextStatsCards`)
  - Filtros: busca, Permissão, Área, Função, Status revisão
  - Tabela `UserContextTable`
  - Estados loading / error / empty
  - Aviso fixo: "Esta tela prepara dashboards e automações futuras. Não altera permissões reais."
- `UserContextStatsCards.tsx` — 4 cards pequenos (com contexto / a revisar / sem contexto / incompletos).
- `UserContextTable.tsx` — colunas: Usuário, Email, Permissão, Área, Função, Status, Revisão, Confiança, Ações (Editar contexto). Mobile-first responsive.
- `UserContextBadges.tsx` — badges padronizados (review status + permissão + área).
- `EditUserContextModal.tsx` — Dialog com:
  - Campos: Permissão*, Área*, Função* (filtrada por área, limpa ao trocar área), Status*, "Marcar como revisado" (checkbox), "Observação da revisão" (textarea opcional)
  - Bloco read-only "Dados legados": legacy_user_type, legacy_commercial_function, mapping_confidence, review_reason, requires_review original
  - Aviso fixo destacado
  - Validação Zod + react-hook-form (já padrão do projeto)
  - Botões: Cancelar / Salvar contexto
  - Bloqueia abertura/edição se `!isOrgAdmin` (defesa em profundidade — RLS é a real)

### Integração
- `src/pages/settings/TeamsAndUsers.tsx` — adicionar terceira `TabsTrigger value="context"` com ícone `ShieldCheck`, label "Contexto CRM", visível apenas para `isOrgAdmin` (manager/user/viewer não veem a aba). Renderiza `<UserContextTab />`.

## 3. Mapas e labels (constantes em `src/components/settings/userContext/labels.ts`)

```ts
PERMISSION_LABELS: { owner, admin, manager, user, viewer }
DEPARTMENT_LABELS: { presales: 'Pré vendas', sales: 'Vendas', cs: 'Customer Success', finance: 'Financeiro', operations: 'Operações', it: 'TI', executive: 'Diretoria' }
FUNCTION_LABELS: SDR, BDR, LDR, AE, Closer, Hunter, CS, Account Manager, Farmer, Financeiro, ADM Financeiro, Operacional, Suporte, Suporte Técnico, Dev, Automação, Diretor, Owner, Visualizador
REVIEW_STATUS: validated | needs_review | incomplete | no_context
```

Labels exibidas vêm primeiro de `crm_*` (`name`) e caem em fallback para o mapa local quando faltar.

## 4. Comportamento esperado

- 19 contextos visíveis para Owner/Admin.
- 6 com badge "Revisar".
- Editar abre modal, troca de área filtra funções, salvar → atualiza linha + log + invalida cache + toast.
- Usuário sem contexto: linha aparece com badge "Sem contexto" e ação "Criar contexto" (mesmo modal, change_type `context_created_from_ui`).
- Erros de RLS / rede: toast de erro, modal permanece aberto, dados intactos.
- Falha da view: aba mostra mensagem "Não foi possível carregar contexto CRM. Tente novamente." sem afetar Usuários/Equipes.

## 5. Validação pós-deploy (queries da spec)
Rodar as 8 queries de validação via `read_query` e reportar resultados no resumo final.

## Garantias

- ❌ Não toca `UsersContent.tsx`, convite, edição legada, dashboard, sidebar, login, rotas.
- ❌ Não altera `organization_members`, `user_roles`, `profiles`, `team_members`.
- ❌ Não ativa `dynamic_user_context_enabled`, `dynamic_dashboards_enabled`, `function_automations_enabled`.
- ✅ RLS protege escrita; service role nunca usado no client.
- ✅ Logs append-only.
- ✅ Merge de metadata não destrutivo.
- ✅ Aba só aparece para Owner/Admin.

## Rollback

```sql
-- Reverter logs
DROP TABLE IF EXISTS public.crm_user_context_change_logs;
-- Reverter RPC
DROP FUNCTION IF EXISTS public.crm_save_user_context(jsonb);
-- Identificar/reverter edições manuais (se necessário, manualmente):
-- SELECT * FROM crm_user_contexts WHERE metadata->>'review_source' = 'user_context_sprint_3_ui';
```
Frontend rollback = remover a aba e os arquivos novos. Zero impacto no resto.

## Riscos

- **Baixo**. Tudo aditivo. Único ponto de atenção: garantir que `crm_save_user_context` valide cross-tenant (defesa contra payload manipulado) — coberto pela checagem `is_tenant_admin_or_owner(_tenant_id)` no início do RPC.
- Se a tabela `crm_user_context_view` mudar de schema futuramente, hook `useUserContexts` precisa ser revisitado — documentado no service.

## Entregáveis ao final

1. Migração SQL (logs + RPC + policies)
2. Hooks + service + componentes listados acima
3. Aba "Contexto CRM" em Equipes e Usuários (Owner/Admin only)
4. Resultado das 8 queries de validação
5. Confirmação: feature flags off, dashboard/login/menu intactos, 19 contextos visíveis, 6 marcados para revisão.
