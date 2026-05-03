# Auth Session Test Plan

Checklist oficial de regressão de autenticação (sprints AUTH.1.1 → AUTH.1.4).
Rodar a cada release que toque AuthProvider, ProtectedRoute, Login, Logout,
ErrorBoundary, useCurrentUser, usePrivateQueryEnabled ou rotas públicas.

Premissas:
- Logout só pode ocorrer por: clique do usuário, sessão Supabase ausente após boot, ou `signOut()` confirmado.
- Erro de perfil/organização/edge function/NRHS NUNCA pode virar logout.
- Nenhum reload automático no fluxo crítico de auth.

---

## Teste 1 — Login sem hard refresh
**Passos:**
1. Abrir `/login` em aba limpa.
2. Logar com usuário válido.
3. Observar transição.

**Resultado esperado:** Dashboard carrega via React Router. Nenhum F5/reload disparado. Sem flash de tela branca.

**Status:** ☐ PASSOU ☐ FALHOU

---

## Teste 2 — F5 em rota privada
**Passos:**
1. Estar logado em `/app/forecast` (ou outra rota privada).
2. Pressionar F5.

**Resultado esperado:** Aparece "Restaurando sessão..." brevemente, sessão é restaurada do `localStorage` e o usuário permanece na mesma rota privada. Sem redirect para `/login`.

**Status:** ☐ PASSOU ☐ FALHOU

---

## Teste 3 — Fechar e reabrir aba
**Passos:**
1. Estar logado.
2. Fechar a aba.
3. Abrir nova aba e acessar a URL do CRM.

**Resultado esperado:** Sessão restaurada automaticamente, sem pedir login.

**Status:** ☐ PASSOU ☐ FALHOU

---

## Teste 4 — Logout limpo
**Passos:**
1. Clicar em "Sair" na sidebar.
2. Após redirect para `/login`, clicar em "voltar" do navegador.

**Resultado esperado:** Não exibe dados privados. React Query cache limpo (`queryClient.clear()`). Tela `/login` renderiza normalmente.

**Status:** ☐ PASSOU ☐ FALHOU

---

## Teste 5 — Tela pública sem query privada
**Passos:**
1. Fazer logout.
2. Abrir `/login` com DevTools aberto (Console + Network).
3. Inspecionar requests por 30s.

**Resultado esperado:** Nenhuma chamada para tabelas/edge functions privadas:
`opportunities`, `pipeline_stages`, `nrhs*`, `forecast*`, `reports*`, `dashboard*`,
`activities`, `proposals`, `get-current-user`. Console pode conter
`[PRIVATE_QUERY_BLOCKED]` confirmando o gating.

**Status:** ☐ PASSOU ☐ FALHOU

---

## Teste 6 — NRHS protegido
**Passos:**
1. Logar e acessar Revenue Hygiene.
2. Inspecionar Network e logs `[AUTH_DEBUG]` / `[PRIVATE_QUERY_BLOCKED]`.

**Resultado esperado:** Queries NRHS só rodam quando `hasSession && hasUser && hasOrganization`. Nenhum request com `organization_id=undefined`.

**Status:** ☐ PASSOU ☐ FALHOU

---

## Teste 7 — Edge function falhando
**Passos:**
1. Logar normalmente.
2. Em DevTools Network, bloquear (`Block request URL`) a edge function `get-current-user`.
3. Recarregar uma rota privada.

**Resultado esperado:** Sessão Supabase permanece. Usuário NÃO é enviado para `/login`. Tela mostra erro de carregamento de perfil com botão "Tentar novamente". `AuthDebugPanel` mostra `hasSession=true`.

**Status:** ☐ PASSOU ☐ FALHOU

---

## Teste 8 — Chunk error / nova versão / Service Worker
**Passos:**
1. Em build de produção, derrubar um chunk (renomear/remover) ou disparar evento `controllerchange` do SW.
2. Navegar entre rotas.

**Resultado esperado:** Nenhum reload automático. UI exibe `UpdateBanner` ou fallback de chunk com botão manual "Recarregar". Sessão preservada até o usuário clicar.

**Status:** ☐ PASSOU ☐ FALHOU

---

## Auditoria de `window.location.*` (AUTH.1.4)

| Arquivo | Classificação |
|---|---|
| `src/lib/auditContext.ts` | SAFE_NON_AUTH_USAGE (leitura) |
| `src/lib/pwaUtils.ts` | MANUAL_USER_ACTION (botão "Atualizar agora") |
| `src/services/crm/sync.ts` | EXTERNAL_OAUTH_REDIRECT (Google OAuth) |
| `src/components/ErrorFallback.tsx` | MANUAL_USER_ACTION (clique) |
| `src/components/ErrorBoundary.tsx` | MANUAL_USER_ACTION (clique) |
| `src/hooks/useSupabaseAuth.ts` | SAFE_NON_AUTH_USAGE (leitura para audit log) |
| `src/components/ote/GoalSystemModeSelector.tsx` | ✅ corrigido em AUTH.1.4 — agora usa `invalidateQueries` |
| `src/hooks/useAppVersion.ts` | MANUAL_USER_ACTION (botão "Atualizar") |
| `src/pages/settings/Account.tsx` | MANUAL_USER_ACTION (clique de mudança de idioma/tema) |
| `src/components/accounts/AccountContactsTab.tsx` | SAFE_NON_AUTH_USAGE (`mailto:` / `tel:`) |

**Confirmação:** zero ocorrências `DANGEROUS_AUTO_RELOAD` no fluxo crítico (AuthProvider, ProtectedRoute, Login, Logout, ErrorBoundary, App.tsx, chunkErrorRecovery, useAppVersion, pwaUtils, MainLayout).
