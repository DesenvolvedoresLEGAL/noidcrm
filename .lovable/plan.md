# Sprint AUTH.1.3 — Boot privado, `usePrivateQueryEnabled` e isolamento NRHS

## Auditoria

**Tree atual:**
```
ErrorBoundary
└── QueryClientProvider
    └── ThemeProvider / TooltipProvider / UpdateBanner / Toasters
        └── BrowserRouter
            ├── Public routes ( /login /signup /forgot-password /p/:token /f/:token /docs ... )
            └── Protected routes
                └── ProtectedRoute (useCurrentUser + useOnboardingStatus)
                    └── TrialGuard
                        └── GlobalRealtimeListeners (useRealtimeContacts)
                        └── LazyRoute → page
```

**Achados:**
- `RevenueHygieneDashboard` e os hooks NRHS (`useNRHSAnalytics`, `useNRHSAnalyticsRealtime`, `useNRHSKPIs`) **só montam dentro de `/app/scoring`** (route protegida). Não há mount global. ✅
- O erro `PGRST200` que aparece "na tela de /Entrar" tem 2 causas reais possíveis:
  1. **Cache do React Query** persistido entre logins: query antiga `['nrhs-analytics', orgId, ...]` continua viva e refetch dispara mesmo que o componente esteja desmontado, se outro hook reaproveitar a chave. (Mitigado: já temos `queryClient.clear()` no logout.)
  2. **Service worker com chunk antigo**: NRHS chunk pré-fetched ainda referencia `pipeline_stages` (a v1.4 já foi corrigida para `stage:stages(name)`). Solução: garantir hard guard de `enabled` em todo hook privado, evitando execução com `organization?.id` indefinido / sem sessão.
- `useCurrentOrganization` não aceita `enabled`. Hoje ele usa `useSupabaseAuth().user` e bloqueia se `!user`, OK — mas múltiplos consumers o invocam (cada um cria seu próprio state). Padronizar via `enabled` evita rodar fetch de org com user em estado intermediário.
- Hooks privados que usam `enabled: !!organization?.id` são vulneráveis ao caso "sessão expirou mas `organization` já estava no cache" → continuariam disparando query 401/PGRST200. Faltam guards de `hasSession`.

## Mudanças

### 1. `src/hooks/usePrivateQueryEnabled.ts` (novo)
Helper único, alinhado a `useCurrentUser` (fonte da verdade da sessão = `hasSession`).
```ts
export function usePrivateQueryEnabled(extra: boolean = true) {
  const { hasSession, sessionChecked, user, organization } = useCurrentUser();
  const enabled =
    sessionChecked && hasSession && !!user?.id && !!organization?.id && extra;
  return {
    enabled,
    organizationId: organization?.id ?? null,
    userId: user?.id ?? null,
    organization,
    hasSession,
    sessionChecked,
  };
}
```
Não cria queries novas — só lê state já em cache via `useCurrentUser` (já é singleton via React Query).

### 2. `src/hooks/useCurrentOrganization.ts`
- Manter assinatura atual (24+ consumers).
- Adicionar early-return adicional: se `useSupabaseAuth().loading === true`, manter `loading=true` e não disparar fetch. (Hoje só checa `!user`, que pode dar falso negativo durante boot.)

### 3. `src/hooks/useNRHSAnalytics.ts` (`useNRHSAnalytics` + `useNRHSKPIs`)
- Trocar `enabled: !!organization?.id` por `enabled` derivado de `usePrivateQueryEnabled()`.
- Incluir `organizationId` na queryKey (já está) e adicionar guard `if (!organizationId) return [];` redundante no queryFn.
- Substituir o sub-query `sessionKeys.currentUser()` (que chama `supabase.auth.getUser()`) por uso de `userId` retornado por `usePrivateQueryEnabled` — elimina query duplicada e race.

### 4. `src/hooks/scoring/useNRHSAnalyticsRealtime.ts`
- Atual: `if (!organizationId) return;`. OK, mas adicionar guard `hasSession`:
```ts
const { hasSession, sessionChecked } = useCurrentUser();
useEffect(() => {
  if (!sessionChecked || !hasSession || !organizationId) return;
  ...
}, [organizationId, hasSession, sessionChecked, queryClient]);
```
Evita assinar canal Postgres sem auth (Realtime exige JWT válido — falha vira ruído/log).

### 5. `src/services/crm/nrhs-analytics.ts`
- Já corrigido na v1.4.1 (`stage:stages(name)`). Sem mudanças.
- Adicionar guarda no início de `fetchNRHSDeals`: `if (!organizationId) throw new Error('NRHS: organizationId required')` para falhar cedo e claro se algum chamador escapar.

### 6. `src/components/scoring/nrhs/RevenueHygieneDashboard.tsx`
- Adicionar early-return se `!organization?.id`: skeleton+mensagem "Aguardando contexto..." em vez de renderizar o dashboard com queries em estado indefinido.

### 7. **NÃO criar** `AppBootGate.tsx` separado
A lógica pedida já vive em `ProtectedRoute` (App.tsx) com a Sprint AUTH.1.2: bloqueia render até `sessionChecked`, espera `userLoading`, oferece retry sem deslogar em erro de organização (via `userError`). Adicionar uma camada extra dobra o tempo de boot e duplica responsabilidade. Decisão: **manter ProtectedRoute como o gate**, e `usePrivateQueryEnabled` como o segundo cinto de segurança no nível de hook.

### 8. Limpeza de cache no login (`src/pages/Login.tsx`)
- Antes do `navigate('/app/dashboard')`, chamar `queryClient.clear()` para garantir que cache de qualquer sessão anterior (NRHS, dashboard, forecast) não dispare queries com `organizationId` antigo enquanto o novo perfil carrega.

## Fora de escopo
- Não auditar/refatorar `useForecast`, `useReports`, `useDashboard`, etc. nesta sprint — eles já dependem de `organization?.id` ou rodam apenas em rotas protegidas. Se um problema concreto aparecer, abrimos sprint dedicada.
- Não criar RPC para NRHS+stages — a join `stage:stages(name)` funciona (hotfix 1.4.1).

## Reload / Logout
- Falha de organização **continua** mostrando retry (já implementado em AUTH.1.2). Sem signOut implícito.

## Arquivos alterados
- `src/hooks/usePrivateQueryEnabled.ts` (novo)
- `src/hooks/useCurrentOrganization.ts` (gate de loading)
- `src/hooks/useNRHSAnalytics.ts` (enabled + remove sub-query getUser)
- `src/hooks/scoring/useNRHSAnalyticsRealtime.ts` (gate hasSession)
- `src/services/crm/nrhs-analytics.ts` (guard organizationId)
- `src/components/scoring/nrhs/RevenueHygieneDashboard.tsx` (skeleton se sem org)
- `src/pages/Login.tsx` (queryClient.clear antes de navegar)

## Risco
Baixo. Mudanças são apenas mais restritivas (`enabled` mais rígido). Nenhum hook que hoje executa válido deixa de executar — só impede execuções com input indefinido.
