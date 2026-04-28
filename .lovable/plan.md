## Ajustes Gerais — 6 correções

### 1. Notificações de propostas vencidas em deals já fechados/perdidos

**Causa raiz:** Em `supabase/functions/check-proposal-expiration/index.ts`, o filtro `.eq("opportunity.status", "open")` no embed PostgREST **não filtra a tabela pai** — só remove o objeto embedado. Resultado: propostas de oportunidades `won`, `lost`, soft-deleted, ou de pipelines que não são VENDAS continuam disparando alertas (PROP-2026-00467, 00533, 00548 são `lost`; PROP-2026-00324 é do pipeline OPERACIONAL).

**Correção:**
- Reescrever a query buscando `proposal_id` + filtrar oportunidades em SQL com join real (via RPC ou duas queries: primeiro buscar opportunities `status='open'`, `pipeline_type='sales'`, `deleted_at IS NULL`, depois propostas vinculadas).
- Adicionar filtro **`pipeline_type = 'sales'`** (join com `pipelines`).
- Adicionar verificação no loop: se `opportunity.status !== 'open'` ou `opportunity.deleted_at !== null` → `continue`.
- Mesma correção em `supabase/functions/build-daily-digest/index.ts` para `proposals_due_today`/`proposals_due_tomorrow`.

### 2. Round Robin não funciona + criar mais estratégias de distribuição

**Estado atual:** `claim_next_owner_round_robin` existe e funciona, mas só é invocada via Decision Engine e Workflows. Não há UI em `/settings/pipelines` para configurar distribuição por pipeline. A tabela `pipelines` não tem coluna de estratégia.

**Correção:**
- Migração: adicionar a `pipelines` as colunas:
  - `lead_distribution_strategy TEXT` (`none | round_robin | load_balanced | territory | manual_assignment | random`)
  - `lead_distribution_role TEXT` (`sdr | seller | closer | cs`) — qual papel recebe
  - `lead_distribution_user_ids UUID[]` (pool opcional; se vazio, usa todos ativos do papel)
- Estender RPC: criar `claim_next_owner_v2(pipeline_id, role, strategy)` cobrindo:
  - **round_robin** — alfabético, rotativo (já existe lógica)
  - **load_balanced** — escolhe usuário com menor nº de oportunidades abertas
  - **random** — sorteio entre ativos
  - **territory** — usa `territories` do usuário (já existem na base) cruzando com UF da conta
  - **manual_assignment** — não atribui (deixa nulo, usuário decide)
- UI em `EditPipelineModal.tsx`: nova seção "Distribuição de Leads" com:
  - Select de estratégia
  - Select de papel-alvo (Pré-vendedor / Vendedor / Closer / CS)
  - Multi-select opcional para restringir o pool
- Integração: ao criar oportunidade no pipeline (via formulários, importação, lead ingest), chamar a RPC se `owner_user_id` estiver vazio e a pipeline tiver estratégia configurada.

### 3. Auto-preencher Pré-Vendedor na conta quando pré-vendedor cria oportunidade

**Implementação:** No serviço `createOpportunity` (`src/services/crm/opportunities.ts`):
- Após criar a oportunidade, se o pipeline for do tipo `qualification` (PRE VENDAS) **e** o usuário criador tiver papel SDR/BDR (Pré-vendedor) **e** a conta vinculada não tiver `pre_sales_user_id`:
  - Atualizar `accounts.pre_sales_user_id = user.id` (com `cs_user_id` para closers e `owner_user_id` para vendedores na mesma lógica para `sales`).
- Garantir verificação de `has_role` antes de fixar.

### 4. Persistência dos responsáveis (Pré-vendedor / Vendedor / CS) na conta

**Diagnóstico (já confirmado em DB):** WEBDOX tem `owner_user_id` e `pre_sales_user_id` salvos corretamente no banco. O bug é de **exibição**: o `Select` do `AccountEditor`/`AccountModalTabs` mostra "Selecione" porque `useOrganizationUsers` provavelmente:
- Filtra por `is_active = true`, ocultando usuários antigos.
- Não inclui o ID do usuário salvo se ele não estiver na primeira página de resultados.

**Correção:**
- Garantir que `useOrganizationUsers` (chamado com `[owner, cs, pre_sales]` extras) **sempre carregue esses IDs explicitamente**, mesmo que estejam inativos, com flag `(Inativo)` no label.
- Forçar `reset()` do React Hook Form a rodar **após** os usuários extras serem carregados (atualmente faz reset assim que `account` chega, antes do `users` populado, então o `Select` recebe um valor que não existe na lista de opções).

### 5. Central de Notificações — Tab "Propostas" deve incluir vencidas e visualizadas

**Estado atual:** `useUnifiedInbox` categoriza notificações por `category`. Eventos `proposal_expired`, `proposal_expiring_24h`, `proposal_expiring_48h`, `proposal_viewed` precisam mapear para `category: 'proposals'`.

**Correção:**
- Em `src/hooks/useUnifiedInbox.ts` (e/ou `normalizeInboxItems.ts`), adicionar/garantir mapeamento dos tipos:
  - `proposal_expired`, `proposal_expiring_24h`, `proposal_expiring_48h`, `proposal_viewed`, `proposal_accepted`, `proposal_declined` → `category: 'proposals'`.
- Verificar que o badge da aba conta esses tipos.

### 6. Filtro de Porte em /accounts retorna vazio + KPIs incorretos

**Causa raiz:** `listAccounts` carrega só **60 contas** por página (server-side, ordenado por `razao_social`). O filtro de porte roda **client-side** sobre essa página → WEBDOX (W…) não está nas primeiras 60. Os cards "Médio Porte: 2" também refletem só essas 60. Quando o usuário aplica o filtro Médio Porte, o KPI muda para "0" porque o filtro é aplicado sobre o conjunto já truncado.

**Correção:**
- Estender `listAccounts` para aceitar `porte`, `origem_principal`, `score_financeiro_range` como filtros server-side (`.eq()` / `.gte/lte()`).
- Mover o filtro de porte do `useMemo` client-side para `queryKey` + parâmetro do `listAccounts`, usando `normalizePorte` no banco via mapeamento (ou aceitar a forma canônica direta — confirmar valores em uso na base).
- Para os KPIs por porte, criar query agregada separada (`select porte, count(*)` agrupado) executada uma vez sobre toda a organização (sem paginação), retornando contagens reais por porte canônico.
- Substituir contagens `byPorte` por essas contagens agregadas.

---

## Arquivos impactados (resumo técnico)

**Migrações:**
- Nova migração: colunas em `pipelines` (distribution strategy/role/user_ids) + RPC `claim_next_owner_v2` + RPC `get_accounts_porte_summary(org_id)`.

**Edge Functions:**
- `supabase/functions/check-proposal-expiration/index.ts` — filtro pipeline_type='sales' + status open hard
- `supabase/functions/build-daily-digest/index.ts` — mesmo filtro

**Frontend:**
- `src/services/supabase/accounts.ts` — `listAccounts` aceita `porte`, novos filtros server-side
- `src/pages/Accounts.tsx` — filtros server-side + KPIs via RPC agregada
- `src/pages/AccountEditor.tsx` + `src/components/accounts/AccountModalTabs.tsx` — reset após users carregar; mostrar inativos
- `src/hooks/useOrganizationUsers.ts` — aceitar IDs forçados mesmo inativos
- `src/hooks/useUnifiedInbox.ts` (ou normalizeInboxItems) — mapear tipos de proposta para category 'proposals'
- `src/components/pipelines/EditPipelineModal.tsx` — nova seção "Distribuição de Leads"
- `src/services/crm/pipelines.ts` — passar campos de distribuição
- `src/services/crm/opportunities.ts` — auto-set `pre_sales_user_id`/`owner_user_id`/`cs_user_id` na conta + invocar `claim_next_owner_v2` quando `owner` vazio

## Riscos
- Auto-set de responsáveis na conta pode sobrescrever atribuições intencionais — mitigado: só preenche quando o campo está vazio.
- Round Robin v2 precisa convivências com workflows existentes que já chamam a v1 — manter v1 funcionando.
- Filtro porte server-side exige normalização: porte no banco tem variantes ("MEDIO PORTE", "Médio Porte"); usar `ILIKE` ou expandir o filtro para múltiplas variantes equivalentes via `normalizePorte` reverso.

## Próximos passos após aprovação
Implementar na ordem: (6) → (4) → (1) → (5) → (3) → (2), pois (2) é o maior e os outros desbloqueiam fluxo imediato do usuário.