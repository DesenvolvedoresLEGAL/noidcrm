

## Auditoria de Performance — NOID CRM

Investiguei frontend, banco, RLS, edge functions e jobs. Aqui o diagnóstico **com dados reais** e o plano priorizado.

---

### 🔴 Gargalos CRÍTICOS encontrados

| # | Gargalo | Evidência | Impacto |
|---|---------|-----------|---------|
| 1 | **Code splitting DESABILITADO no build** | `vite.config.ts: inlineDynamicImports: true` força UM bundle único | Todos os ~95 `lazy()` do `App.tsx` são inúteis. JS inicial enorme, TTI muito alto |
| 2 | **RLS hot path com seq scans massivos** | `organization_members`: 72M seq scans / 901M tuples lidas (em 27 linhas!). `teams`: 6M scans em 1 linha. `profiles`: 11M scans / 195M tuples | Toda query do CRM passa por aqui — dezenas de ms desperdiçados em **cada request** |
| 3 | **`entity_snapshots` = 453MB com 218k linhas >30 dias** | Tabela cresce sem limite, sem retenção | Triggers e backups lentos, custo crescente |
| 4 | **Polling agressivo em queries vivas** | 4 queries de `lead-sourcing` com `refetchInterval: 5000` simultâneas + ChatView `2000ms` | Carga contínua no Postgres mesmo sem usuário interagindo |
| 5 | **Bundles pesados carregados eager** | `xlsx`, `jspdf`, `jspdf-autotable`, `@tiptap/*` importados estaticamente em `data-export.ts`, `proposalPdfGenerator.ts` | +800KB no bundle principal (com #1 corrigido) |
| 6 | **Políticas RLS duplicadas/redundantes** | `contacts` tem **11 policies**, `proposals` 10, `activities` 8 (várias com mesmo `qual`) | Cada SELECT avalia N policies; complexidade O(N) por linha |
| 7 | **Cron `process-email-queue` a cada 5 segundos** | 17.280 invocações/dia | Ruído nos logs, custo, e impede usar latência real do pgmq |
| 8 | **`ProposalPublicView.tsx` = 2.217 linhas** + outras 8 páginas >800 linhas | God components, re-renderizam tudo a cada state change | UI travada em telas-chave |

### 🟠 Gargalos ALTOS

- **151 hooks**, muitos buscam `select('*')` (294 ocorrências) — payloads inflados.
- **`useFinanceDashboard`, `useOwnerDashboard`** fazem 5+ queries serializadas no `useEffect`.
- **`Layout.tsx`** monta `RealtimeNotificationListener`, `CelebrationProvider`, `HelpCenterDrawer` em toda página — re-render global em cada notificação.
- **Lucide icons**: 561 imports individuais ✅ (já tree-shakeable, ok).
- **Index `idx_org_members_org`, `idx_org_members_user`** existem mas **planner não usa** — provavelmente devido a `STABLE`/casts em RLS.

---

## Plano de Otimização (em ordem de impacto)

### Fase 1 — Quick Wins (impacto imediato, baixo risco)

**1.1 Restaurar code splitting** (`vite.config.ts`)
- Remover `inlineDynamicImports: true`
- Configurar `manualChunks` por vendor: `react-vendor`, `radix-ui`, `recharts`, `tiptap`, `pdf-libs` (xlsx+jspdf), `framer-motion`
- Esperado: bundle inicial **−60% a −75%**, TTI **−40%**

**1.2 Lazy load das libs pesadas**
- `proposalPdfGenerator.ts`: trocar imports estáticos de `jspdf`/`autotable` por `await import(...)` dentro da função
- `data-export.ts`: idem para `xlsx`/`jspdf`
- `ImportTemplateModal.tsx`: dynamic import de `xlsx`

**1.3 Reduzir polling**
- `useLeadSourcingV2`: trocar `refetchInterval: 5000` por **realtime subscription** em `playbook_runs`/`run_events`/`prospects` (já há infra)
- `useAISupervision`: agrupar 5 queries com `refetchInterval` diferentes em **1 query única** com 30s
- `process-email-queue` cron: **5s → 30s** (pgmq tolera latência)

**1.4 Remover policies RLS duplicadas**
- `contacts`: consolidar 11→3 policies (select/insert/update)
- `proposals`: 10→4
- `activities`: 8→3
- Manter sempre: `org_select`, `org_insert`, `org_update`, `admin_delete` + 1 pública se aplicável

### Fase 2 — Banco (impacto alto, baixo risco)

**2.1 Função SECURITY DEFINER cacheada para `get_user_organization_id`**
- Já existe (`prosecdef:true`), mas precisa de `SET search_path = public` + `STABLE` + cache via `current_setting`
- Adicionar índice de cobertura: `CREATE INDEX CONCURRENTLY idx_org_members_user_org_status_role ON organization_members(user_id, organization_id, status, role) WHERE status='active';`

**2.2 Auto-vacuum agressivo nas tabelas hot**
```sql
ALTER TABLE organization_members SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE profiles SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE user_roles SET (autovacuum_vacuum_scale_factor = 0.05);
```

**2.3 Política de retenção `entity_snapshots`**
- Cron diário deletando snapshots > 90 dias
- Esperado: **453MB → ~80MB**

**2.4 Drop de 20 índices nunca usados** (lista coletada via `pg_stat_user_indexes`)
- `entity_snapshots`, `revenue_events`, `system_events` têm 10+ índices com `idx_scan=0`
- Reduz custo de INSERT em todas as tabelas hot

### Fase 3 — Frontend estrutural

**3.1 Quebrar god components** (top 5)
- `ProposalPublicView` (2217 lh) → splitar em `ProposalHeader`, `ProposalItemsView`, `ProposalAcceptance`, `ProposalSignature`
- `Account.tsx` settings (1432 lh) → tabs lazy
- `AccountEditor`, `ProposalEditor`, `Audit` → mesma estratégia

**3.2 Memoização cirúrgica**
- `Layout.tsx`: extrair `RealtimeNotificationListener` para portal isolado, evitar re-render do `<main>` quando notificação chega
- Tabelas (`OpportunitiesTable`, `LeadsTable`): `React.memo` + `useCallback` em handlers de linha

**3.3 Substituir `select('*')` por colunas explícitas** nos 5 hooks mais consumidos: `useOpportunities`, `useAccounts`, `useContacts`, `useActivities`, `useProposals`

**3.4 Skeletons em rotas carregadas**
- `LazyRoute` já usa `LoadingPage` mas é página inteira em branco — trocar por skeletons específicos por rota

### Fase 4 — Automações assíncronas

**4.1 Padrão "Fire & Forget + Outbox"**
- Hoje: `completeActivity` → chama `process-pending-workflows` síncrono
- Novo: insere em `workflow_outbox` (já existe `process-pending-workflows` no cron 5min) + chama edge function async via `EdgeRuntime.waitUntil`
- Cron de 5min vira **fallback de retry**, não caminho principal

**4.2 Idempotência de jobs**
- Adicionar `dedup_key` em `email_queue`, `notification_events`, `workflow_outbox`
- Unique partial index: `WHERE status='pending'`

**4.3 Logs de duração**
- Tabela `automation_run_log(function, duration_ms, status, error, created_at)` particionada por dia
- Trigger em todas edge functions críticas via wrapper helper

### Fase 5 — UX progressiva

**5.1 Streaming de dados em dashboards**
- `Dashboard` (Owner/CEO): renderizar shell + skeletons → cada KPI aparece quando sua query resolve (já com React Query, basta remover `Promise.all`)

**5.2 Pré-fetch inteligente**
- Hover em link da sidebar → `queryClient.prefetchQuery` da rota destino

**5.3 Service Worker estável**
- Manter `globPatterns` sem HTML (já está) ✅
- Garantir que assets versionados não invalidem cache de fontes

---

## Entregáveis SQL prontos

```sql
-- Índice de cobertura RLS hot path
CREATE INDEX CONCURRENTLY idx_org_members_user_active 
  ON organization_members(user_id, organization_id) 
  INCLUDE (role, status) WHERE status='active';

-- Retenção entity_snapshots
SELECT cron.schedule('cleanup-entity-snapshots', '0 4 * * *', $$
  DELETE FROM public.entity_snapshots WHERE created_at < now() - interval '90 days';
$$);

-- Vacuum agressivo
ALTER TABLE organization_members SET (autovacuum_vacuum_scale_factor=0.05, autovacuum_analyze_scale_factor=0.02);
ALTER TABLE profiles SET (autovacuum_vacuum_scale_factor=0.05);
ALTER TABLE user_roles SET (autovacuum_vacuum_scale_factor=0.05);

-- Drop índices mortos (será listado individualmente após confirmar)
```

---

## Ordem de execução sugerida (sprints curtos)

| Sprint | Foco | Esforço | Ganho esperado |
|--------|------|---------|----------------|
| **A** | Fase 1.1 + 1.2 (split + lazy libs) | 2h | TTI −40%, bundle −60% |
| **B** | Fase 1.3 + 1.4 (polling + RLS dedup) | 2h | DB load −30% |
| **C** | Fase 2 (índice + retenção + vacuum + drop) | 2h | Latência queries −50% nas hot |
| **D** | Fase 3.1-3.3 (god components + memo + colunas) | 4h | Re-renders −70% nas telas pesadas |
| **E** | Fase 4 (automações async + outbox + logs) | 3h | UX não trava em ações pesadas |
| **F** | Fase 5 (streaming dashboards + prefetch) | 2h | Tempo até KPI útil −50% |

**Total: ~15h efetivas** — proponho começar por **Sprint A + B + C** já no próximo loop (são as de maior impacto e baixo risco).

---

## Riscos e mitigação

- **Code splitting**: pode reintroduzir o problema antigo de chunk error → manter `chunkErrorRecovery.ts` ativo (já presente)
- **RLS dedup**: testar cada policy consolidada com usuários de papéis diferentes antes de aplicar em prod
- **Drop índices**: usar `DROP INDEX CONCURRENTLY` e revisar 1 a 1
- **Retenção snapshots**: confirmar que nenhum relatório histórico depende de >90 dias

## Pergunta antes de implementar

Você quer que eu execute na sequência **A → B → C agora** (Sprints de maior impacto, sem mexer em god components ainda), ou prefere outra ordem? Posso também rodar **tudo até a Fase 4** se autorizar — fica em torno de 11h de trabalho concentrado.

