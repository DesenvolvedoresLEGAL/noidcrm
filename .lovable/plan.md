# Sprint AUTH.1.2 — AuthProvider, restauração de sessão, fim do reload automático

## Causa raiz (encontrada na auditoria)

**Bug #1 — falso logout em cold start (CRÍTICO):** `src/hooks/useCurrentUser.ts` retorna `isAuthenticated: !!data?.user`, onde `data` vem da edge function `get-current-user`. Quando a edge function retorna 5xx (cold start, timeout, qualquer erro não-401), o hook devolve `data = null` → `isAuthenticated = false` → `ProtectedRoute` (App.tsx:271) faz `<Navigate to="/login" />`. **A sessão Supabase está OK, mas o usuário é jogado para fora.** Isso explica perfeitamente "deslogou sozinho" e "login só funciona no F5" (no F5 a edge function já está aquecida).

**Bug #2 — reload automático em controllerchange:** `src/hooks/useAppVersion.ts:98-103` registra `controllerchange` no SW e dispara `window.location.reload()` automaticamente sempre que o SW muda. Isso derruba a UI mid-session.

**Bug #3 — ErrorBoundary recupera chunk error chamando reload:** `src/components/ErrorBoundary.tsx:58` → `attemptChunkRecovery()` → `chunkErrorRecovery.ts:102/109/114` → `skipWaitingAndReload()` / `window.location.reload()` / `forceUpdate()` (que faz `window.location.replace`). Qualquer erro de chunk vira reload automático em loop até esgotar 3 tentativas.

**Bug #4 — global handler dispara recovery sem confirmação:** `chunkErrorRecovery.ts:144,154` chama `attemptChunkRecovery()` em `unhandledrejection` e `error` globais. Como `Failed to fetch` está nos padrões, qualquer fetch falho dispara reload.

**Bug #5 — `forceUpdate()` em pwaUtils limpa storage e dá replace:** `pwaUtils.ts:44-55` apaga chaves do localStorage e troca a URL. Não toca `sb-*` por sorte (só remove `app_version` e `cache_timestamp`), mas o `replace` mata sessão visual.

## Mudanças (10 arquivos)

### 1. `src/hooks/useCurrentUser.ts` — fonte da verdade da auth
- Trocar `isAuthenticated: !!data?.user` por `isAuthenticated: hasSession`. Sessão Supabase = verdade. Perfil é dado, não auth.
- Adicionar flag separada `hasProfile: !!data?.user` para quem precisar.
- Adicionar log DEV `[AUTH_DEBUG]` (sem token/email/sessão).

### 2. `src/App.tsx` — ProtectedRoute robusto
- Não redirecionar para `/login` enquanto `!sessionChecked`.
- Só redirecionar se `sessionChecked && !hasSession` (usar `hasSession` direto).
- Remover redirect quando `userError` ocorre mas `hasSession === true` (mostrar fallback de retry, não kickar).
- Trocar `window.location.reload()` dos dois botões internos por handler que invalida `['current-user']` via queryClient.
- Trocar timeout fallback `reload()` por botão "Tentar novamente" que chama `queryClient.invalidateQueries`.

### 3. `src/hooks/useSupabaseAuth.ts` — ordem correta
- Já está OK (listener registrado antes de getSession). Sem mudanças funcionais; apenas adicionar guard `mountedRef` para evitar setState após unmount durante boot.

### 4. `src/components/ErrorBoundary.tsx` — sem reload automático
- Remover `attemptChunkRecovery()` automático do `componentDidCatch`.
- Em `isChunkLoadError(error)`, marcar `isChunkError: true` no state e mostrar fallback com botão **"Recarregar agora"** (clique = reload manual). Sem auto-reload, sem timer.

### 5. `src/lib/chunkErrorRecovery.ts` — recovery manual
- Manter detecção (`isChunkLoadError`) e `forceHardReset()` (que continua sendo manual via clique).
- **Remover** `attemptChunkRecovery()` automático do conteúdo: virar função que **emite evento** `noid:chunk-error` em vez de recarregar. Mantém assinatura para não quebrar imports.
- Em `setupGlobalChunkErrorHandlers()`: parar de chamar `attemptChunkRecovery()`. Só `console.warn` + `event.preventDefault()` + dispatch do evento. UI decide o que fazer.

### 6. `src/hooks/useAppVersion.ts` — sem reload em controllerchange
- Remover `window.location.reload()` do listener `controllerchange`.
- Em vez disso, setar `needsUpdate: true`. UpdateBanner (já existe) mostra o aviso; usuário decide quando atualizar.

### 7. `src/lib/pwaUtils.ts` — proteger storage Supabase
- Em `clearAllCaches`: já só limpa `caches`, OK.
- Em `forceUpdate`: adicionar guard que **nunca remove** chaves `sb-*` ou contendo `supabase` do localStorage. As únicas chaves removidas hoje são `app_version` / `cache_timestamp` — manter, mas adicionar comentário e função `safeClearAppStorage()` defensiva.
- `skipWaitingAndReload` continua usando reload — mas só é chamado por handler manual agora (Bug #3 já desmontado).

### 8. `src/pages/Login.tsx` — confirmar sem reload
- Auditar: trocar qualquer `window.location.*` por `navigate(from, { replace: true })` + `queryClient.clear()`. (Provavelmente já está assim — confirmar.)

### 9. Logout (onde estiver) — limpar React Query
- Adicionar `queryClient.clear()` antes do `navigate('/login', { replace: true })`. Sem reload.

### 10. `src/integrations/supabase/types.ts`
- Não tocar (auto-gerado). Adicionar `hasProfile` no retorno de `useCurrentUser` é seguro pois o hook é tipado in-place.

## Itens fora desta sprint (mantidos)

- Não criar AuthProvider novo: `useSupabaseAuth` + `useCurrentUser` (com fix #1) já cobrem o contrato pedido (`session`, `user`, `loading`, `isAuthenticated`, `hasSession=authBooted`). Criar provider paralelo aumenta superfície sem ganho real e requer refator de 24 consumers.
- Não tocar NRHS, Forecast, Reports, dashboards.
- `BUILD_TIMESTAMP` / version.json polling → fora do escopo (não é causa do logout).

## Reloads — antes vs depois

| Local | Antes | Depois |
|---|---|---|
| `App.tsx` ProtectedRoute timeout | `reload()` | `invalidateQueries(['current-user'])` |
| `App.tsx` userError fallback | `reload()` | `invalidateQueries(['current-user'])` |
| `ErrorBoundary` componentDidCatch | reload automático via attemptChunkRecovery | sem auto; botão "Recarregar agora" |
| `ErrorBoundary` handleReload (botão) | `reload()` | mantido (clique manual = OK) |
| `chunkErrorRecovery` global handlers | `attemptChunkRecovery()` (reloads) | `dispatchEvent('noid:chunk-error')` |
| `chunkErrorRecovery.attemptChunkRecovery` | reloads em cascata | emite evento, retorna false |
| `useAppVersion` controllerchange | `reload()` | `setState({ needsUpdate: true })` |
| `useAppVersion.performUpdate` (botão) | `reload()` (fallback) | mantido (clique manual) |
| `pwaUtils.forceUpdate` | `replace()` + `href=` fallback | mantido, só chamado via clique manual |
| `pwaUtils.skipWaitingAndReload` | `reload()` | mantido, só clique manual |
| `Account.tsx:588` | `reload()` após mudar conta | fora do escopo (ação manual já) |
| `GoalSystemModeSelector:37` | `reload()` após mudar modo | fora do escopo (ação manual já) |

## Risco

Médio. Mexe na fundação de auth que afeta 24 consumers, mas o ponto-chave (`isAuthenticated = hasSession`) é uma mudança isolada e mais permissiva que a anterior — quem antes era considerado autenticado continua sendo; deixa de "deslogar" quem tem sessão mas perfil ainda carregando. ProtectedRoute continua bloqueando rotas de quem não tem sessão.

## Critérios de aceite cobertos

1, 2, 3 ✅ (useSupabaseAuth + useCurrentUser); 4 ✅ (ProtectedRoute usa hasSession+sessionChecked); 5–6 ✅ (Login/Logout sem reload); 7 ✅ (ErrorBoundary); 8 ✅ (chunk); 9 ✅ (version); 10 ✅ (pwaUtils); 11 ✅ (sem token logado); 12 ✅ (build).
