# Sprint AUTH.1.4 — Observabilidade, testes forenses e zero hard refresh

Sprint pequena, focada em **observabilidade segura** e **validação**. Nada em NRHS, Forecast ou Dashboards privados (já blindados nas sprints anteriores).

## Auditoria prévia de `window.location.*`

Resultado da varredura:

| Arquivo | Linha | Uso | Classificação |
|---|---|---|---|
| `src/lib/auditContext.ts` | 18 | leitura `href` para audit log | SAFE_NON_AUTH_USAGE |
| `src/lib/pwaUtils.ts` | 55-101 | `forceUpdate()` chama `replace`/`reload` | MANUAL_USER_ACTION (botão "Atualizar agora") — manter, mas confirmar que nenhum caller dispara sem clique |
| `src/services/crm/sync.ts` | 112,186 | OAuth Google redirect | EXTERNAL_OAUTH_REDIRECT |
| `src/components/ErrorFallback.tsx` | 96 | botão "Voltar para dashboard" | MANUAL_USER_ACTION |
| `src/components/ErrorBoundary.tsx` | 69 | botão `handleReload` (clique) | MANUAL_USER_ACTION |
| `src/hooks/useSupabaseAuth.ts` | 34 | leitura para auditoria | SAFE_NON_AUTH_USAGE |
| `src/components/ote/GoalSystemModeSelector.tsx` | 37 | reload após salvar config | **DANGEROUS_AUTO_RELOAD** (não-auth, mas ruim de UX — substituir por invalidate de query) |
| `src/hooks/useAppVersion.ts` | 80 | `applyUpdate()` chamado por botão | MANUAL_USER_ACTION |
| `src/pages/settings/Account.tsx` | 588 | reload após mudar idioma/tema | aceitável (clique), manter |
| `src/components/accounts/AccountContactsTab.tsx` | 59,63 | `mailto:` / `tel:` | SAFE_NON_AUTH_USAGE |

**Conclusão:** nenhum reload automático no fluxo crítico de auth. Único `DANGEROUS_AUTO_RELOAD` real é `GoalSystemModeSelector` (não-auth) — trocaremos por `queryClient.invalidateQueries`.

## O que vamos fazer

### Parte 1 — `AuthDebugPanel` (DEV-only)
Criar `src/components/system/AuthDebugPanel.tsx`:
- `if (!import.meta.env.DEV) return null`
- Lê `useCurrentUser()` (já compartilhado, sem query nova)
- Mostra: `authLoading`, `sessionChecked`, `hasSession`, `hasUser`, `userId.slice(0,8)`, `organizationId.slice(0,8)`, `organizationLoading`, `pathname`, `lastAuthEvent`, `lastAuthEventAt`
- **NÃO** expõe token, email completo, sessão
- Posição: `fixed bottom-3 right-3 z-[9999]`
- Montar em `App.tsx` dentro do `<BrowserRouter>` (fora de `ProtectedRoute` para ver auth na pública também)

### Parte 2 — `lastAuthEvent` no `useSupabaseAuth`
Editar `src/hooks/useSupabaseAuth.ts`:
- Adicionar estados `lastAuthEvent: string | null` e `lastAuthEventAt: string | null`
- No `onAuthStateChange`, após `setSession`: `setLastAuthEvent(event); setLastAuthEventAt(new Date().toISOString())`
- Em DEV: `console.info('[AUTH_EVENT]', { event, hasSession: !!session, userId: session?.user?.id?.slice(0,8) ?? null })`
- Expor `lastAuthEvent` e `lastAuthEventAt` no retorno
- Propagar via `useCurrentUser` (já agrega `useSupabaseAuth`)

### Parte 3 — Log de query privada bloqueada
Editar `src/hooks/usePrivateQueryEnabled.ts`:
- Em DEV, quando `extra === true && !enabled`, emitir `console.debug('[PRIVATE_QUERY_BLOCKED]', { hasSession, hasUser, hasOrganization, sessionChecked })`
- Usar `useRef` para evitar log em loop (só logar quando o snapshot mudar)

### Parte 4 — Corrigir único auto-reload não-auth
`src/components/ote/GoalSystemModeSelector.tsx` linha 37: substituir `window.location.reload()` por `queryClient.invalidateQueries({ queryKey: ['ote'] })` + toast. Fora do escopo de auth, mas único `DANGEROUS_AUTO_RELOAD` da varredura.

### Parte 5 — Validar isolamento de `/login`
`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/`, `/p/:token`, `/f/:token`, `/docs/*` já estão **fora** de `ProtectedRoute` em `App.tsx`. Não há `MainLayout`/`Sidebar`/providers privados envolvendo a árvore de `<Routes>` — só `ThemeProvider`, `TooltipProvider`, `Toaster`, `PostHogProvider`, `QueryClientProvider`. Apenas confirmaremos via grep que nenhum desses dispara query privada e documentaremos no plan.md.

### Parte 6 — Documentar plano de teste
Criar `docs/auth-session-test-plan.md` com os 8 cenários do briefing (template Passos / Esperado / Status), pronto para virar checklist de regressão.

### Parte 7 — Atualizar `.lovable/plan.md`
Registrar entrega da sprint AUTH.1.4 com lista classificada de `window.location.*` e confirmações.

## Arquivos

**Criados**
- `src/components/system/AuthDebugPanel.tsx`
- `docs/auth-session-test-plan.md`

**Editados**
- `src/hooks/useSupabaseAuth.ts` (lastAuthEvent + log DEV)
- `src/hooks/useCurrentUser.ts` (propagar lastAuthEvent/lastAuthEventAt)
- `src/hooks/usePrivateQueryEnabled.ts` (log DEV bloqueado, com ref anti-spam)
- `src/App.tsx` (montar `<AuthDebugPanel />`)
- `src/components/ote/GoalSystemModeSelector.tsx` (remover reload)
- `.lovable/plan.md`

## Riscos

- **Spam de log:** mitigado com `useRef` comparando snapshot anterior em `usePrivateQueryEnabled`.
- **Painel em produção:** guardado por `import.meta.env.DEV` (compilado fora do bundle prod).
- **Vazamento de PII:** apenas `id.slice(0,8)`; sem token, sem email.
- **`GoalSystemModeSelector`:** se a invalidate não cobrir tudo, usuário pode precisar refrescar manualmente — aceitável (era reload forçado antes).

## Próximos passos pós-sprint

Rodar manualmente os 8 testes de `docs/auth-session-test-plan.md` e marcar status. Se algum falhar, abrir AUTH.1.5 escopada no cenário específico.

---

## Sprint AUTH.1.4 — ENTREGUE

**Criados:**
- `src/components/system/AuthDebugPanel.tsx` — painel DEV-only (fixed bottom-right) com authLoading, sessionChecked, hasSession, hasUser, userId(8), organizationId(8), pathname, lastAuthEvent, lastAuthEventAt. Sem PII.
- `docs/auth-session-test-plan.md` — checklist oficial dos 8 testes de regressão + tabela de classificação `window.location.*`.

**Editados:**
- `src/hooks/useSupabaseAuth.ts` — (sem alteração final; lastAuthEvent foi colocado em useCurrentUser que já é fonte de verdade compartilhada).
- `src/hooks/useCurrentUser.ts` — registra `lastAuthEvent`/`lastAuthEventAt` no `onAuthStateChange`. Log DEV `[AUTH_EVENT]` (event, hasSession, userId.slice(0,8)). Expõe ambos no retorno.
- `src/hooks/usePrivateQueryEnabled.ts` — log DEV `[PRIVATE_QUERY_BLOCKED]` quando `extra=true && !enabled`, com `useRef` anti-spam.
- `src/App.tsx` — monta `<AuthDebugPanel />` dentro do `<BrowserRouter>` (fora de ProtectedRoute).
- `src/components/ote/GoalSystemModeSelector.tsx` — removido único `DANGEROUS_AUTO_RELOAD` da varredura; agora usa `queryClient.invalidateQueries` para 'current-organization', 'current-user', 'ote' e 'organization'.

**Auditoria final `window.location.*`:** 10 ocorrências classificadas, 0 `DANGEROUS_AUTO_RELOAD` no fluxo crítico de auth (ver tabela em `docs/auth-session-test-plan.md`).

**Isolamento `/login`:** confirmado via `App.tsx` — rotas públicas (`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/`, `/p/:token`, `/f/:token`, `/docs/*`) ficam fora de `ProtectedRoute`. A árvore global só monta providers neutros (Theme, Tooltip, Toaster, PostHog, QueryClient). Nenhum `MainLayout`/`Sidebar`/Dashboard/NRHS/Forecast provider é montado nessas rotas.

**Riscos residuais:** nenhum bloqueante. Painel DEV é tree-shaken no build de produção (`import.meta.env.DEV` constante). Logs `[AUTH_EVENT]`/`[PRIVATE_QUERY_BLOCKED]` só em DEV.

**Próximo:** rodar os 8 testes manuais de `docs/auth-session-test-plan.md` e marcar status. Abrir AUTH.1.5 escopada apenas se algum cenário falhar.
