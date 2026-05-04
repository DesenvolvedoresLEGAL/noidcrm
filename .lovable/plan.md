## Sprint Contas 1.1 — RFM Intelligence

Add a new "RFM Intelligence" tab inside Contas that classifies the account base by Recency, Frequency and Monetary based on closed-won opportunities, with an org-wide snapshot cache, RPCs, recalc action, segment cards, accounts table and concept cards.

### 1. Database (migration)

**Table `account_rfm_snapshots`**
- `id uuid pk`, `organization_id uuid`, `account_id uuid`, `period_start date`, `period_end date`, `owner_id uuid`
- `last_won_date timestamptz`, `won_count int`, `total_revenue numeric`, `avg_ticket numeric`, `recency_days int`
- `r_score smallint`, `f_score smallint`, `m_score smallint`, `rfm_score numeric`
- `rfm_segment text`, `suggested_action text`
- `calculated_at timestamptz`, `created_at`, `updated_at`
- Indexes: `(organization_id)`, `(account_id)`, `(period_start, period_end)`, `(rfm_segment)`
- Unique: `(organization_id, account_id, period_start, period_end)`
- RLS: SELECT same org via `get_user_organization_id()`; INSERT/UPDATE/DELETE only `service_role`, `owner` or `admin` (using `has_role`/`has_org_role`)

**RPC `recalculate_account_rfm(p_organization_id, p_period_start, p_period_end)`**
- Security definer, `search_path=public`. Caller must be admin/owner of org.
- Source = `opportunities` where `organization_id = p_org` AND `deleted_at IS NULL` AND `status = 'won'` AND `closed_at::date BETWEEN p_period_start AND p_period_end` AND `account_id IS NOT NULL`. Revenue = `COALESCE(valor_previsto,0)` (NRHS net rule already enforced upstream; valor_previsto is current source for closed deals — matches existing dashboards).
- Aggregate per account: `won_count`, `total_revenue`, `avg_ticket`, `last_won_date`, `recency_days = p_period_end - last_won_date::date`.
- Compute R/F per spec; M via `percent_rank()` over `total_revenue` per organization.
- `rfm_score = round(((r+f+m)/15.0)*100, 2)`.
- Segment classification applied in priority order (Campeão → VIP → Leal → Novo → Promissor → Atenção → Risco → Hibernando → Perdido).
- `suggested_action` mapped per segment (text).
- UPSERT on unique key. Returns count.

**RPC `get_account_rfm_intelligence(p_organization_id, p_period_start, p_period_end, p_owner_id, p_segment, p_search)`**
- Security definer, validates caller's org. Reads from `account_rfm_snapshots` joined with `accounts` (razao_social/nome_fantasia) and `profiles` (owner full_name).
- Filters: owner_id, segment, search ilike on account name.
- Returns `jsonb` with:
  - `overview`: clientes_analisados, receita_total, ticket_medio, score_rfm_medio, e contagens dos 6 segmentos pedidos (campeoes, vip, leais, em_risco, hibernando, perdidos).
  - `segments`: array dos 9 segmentos com `{ segment, count, revenue, avg_ticket, percent, action }`.
  - `accounts`: array com colunas pedidas.
  - `recommended_actions`: catálogo segmento → ação detalhada.

### 2. Frontend

**Service** `src/services/crm/account-rfm.ts`
- `getAccountRFMIntelligence(params)` — invokes RPC, returns typed payload.
- `recalculateAccountRFM(params)` — invokes RPC.

**Hooks**
- `src/hooks/useAccountRFMIntelligence.ts` — `useQuery` keyed by `[org, period, owner, segment, search]`.
- `src/hooks/useRecalculateAccountRFM.ts` — `useMutation`, invalidates the intelligence query, toast.

**Components** (`src/components/accounts/rfm/`)
- `AccountRFMIntelligencePage.tsx` — orchestrates filters, layout, recalc button (visible only to admin/owner via `useUserRole`).
- `RFMOverviewCards.tsx` — KPIs principais (clientes analisados, receita, ticket médio, score médio, + cards por segmento principal).
- `RFMSegmentationCards.tsx` — grid dos 9 segmentos (qtd, receita, ticket, %, ação).
- `RFMAccountsTable.tsx` — tabela com sort por receita/última contratação/score e filtros locais; usa `Table` shadcn.
- `RFMRecommendedActions.tsx` — lista expansível por segmento com ações.
- `RFMScoreExplanationCard.tsx` — dois cards conceituais (texto exato do brief).
- `RFMFilterBar.tsx` — período (default 365d), responsável (via `useActiveUsers`/`crm_active_users_view`), segmento, busca.

**Empty/loading/error**: skeletons em cards/tabela; estado vazio "Nenhuma venda fechada no período"; toast em erro.

### 3. Integração no menu Contas

Em `src/pages/Accounts.tsx`, envolver o conteúdo atual em `Tabs` com duas abas:
- "Contas" (conteúdo existente intacto)
- "RFM Intelligence" (`<AccountRFMIntelligencePage />`)

Sem alterar lógica/estilo da aba Contas existente.

### 4. Permissões e segurança
- RLS na tabela snapshots conforme acima.
- RPCs `security definer` com `set search_path = public` e checagem de `organization_id` via `get_user_organization_id()`.
- Botão Recalcular RFM oculto se não for admin/owner.

### 5. Critérios atendidos
- Aba existe em Contas, filtros funcionam, 9 segmentos, tabela com R/F/M/score/ação, apenas vendas fechadas, sem oportunidades abertas, recalc funcional, RLS multi-tenant, cards conceituais presentes. Account Score não implementado (apenas RFM como base futura).

### Arquivos a criar
- `supabase/migrations/<ts>_account_rfm_snapshots.sql`
- `src/services/crm/account-rfm.ts`
- `src/hooks/useAccountRFMIntelligence.ts`
- `src/hooks/useRecalculateAccountRFM.ts`
- `src/components/accounts/rfm/AccountRFMIntelligencePage.tsx`
- `src/components/accounts/rfm/RFMOverviewCards.tsx`
- `src/components/accounts/rfm/RFMSegmentationCards.tsx`
- `src/components/accounts/rfm/RFMAccountsTable.tsx`
- `src/components/accounts/rfm/RFMRecommendedActions.tsx`
- `src/components/accounts/rfm/RFMScoreExplanationCard.tsx`
- `src/components/accounts/rfm/RFMFilterBar.tsx`

### Arquivo a editar
- `src/pages/Accounts.tsx` — adicionar Tabs (Contas / RFM Intelligence)

### Riscos
- `closed_at` deve existir em `opportunities` (verificar; fallback `updated_at` quando `status='won'`).
- Cálculo do M via `percent_rank()` exige amostra suficiente; quando houver poucas contas, fallback proporcional.
- Recalc pesado em orgs grandes — RPC roda síncrono; viável para <50k contas. Caso necessário, futuro batch via edge function.
