## Sprint E.1.1 — Apollo Control & Audit (Padrão NOID)

Adiciona governança, transparência e ROI ao enriquecimento Apollo: preview de custo antes de rodar, modal de confirmação, histórico auditável por prospect, relatório exportável de decisores e proteções contra abuso.

### 1. Banco de Dados (migration)

**ALTER `enrichment_jobs`** (campos de auditoria/controle):
- `estimated_credits INT` — quanto foi previsto antes da chamada
- `trigger_source TEXT` (`user` | `system` | `automation`)
- `skip_reason TEXT` — motivo padronizado (`already_enriched`, `low_score`, `low_quality`, `dm_already_found`, `no_domain`, `rate_limited`, `daily_limit`)
- `response_summary JSONB` — `{contacts_found, emails_found, phones_found, top_seniority}`

**Índice**: `idx_enrichment_jobs_prospect_created (prospect_id, created_at DESC)`

**RLS**: já existe SELECT por organização — manter. Adicionar policy de INSERT/UPDATE só via service role (já é o padrão atual via edge function).

### 2. Edge Functions

**Nova: `preview-apollo-enrichment`**
- Input: `{ prospect_id }`
- Carrega prospect, último `enrichment_runs.quality_label`, `prospect_scores.priority_score`, último `enrichment_jobs` Apollo
- Aplica os mesmos guards do `run-apollo-enrichment`
- Retorna:
  ```
  {
    eligible, reason,
    estimated_credits: 2,
    domain, company_name,
    score, quality_label,
    already_enriched, last_job_at,
    warning  // ex.: "Prospect já possui contatos enriquecidos"
  }
  ```
- Não consome crédito Apollo, não escreve nada (puro read).

**Atualizar: `run-apollo-enrichment`**
- Aceita `trigger_source` no body (default `user`).
- Substitui o `skip()` atual: passa a gravar `skip_reason` padronizado e `estimated_credits` no row.
- Ao concluir, calcula e grava `response_summary`:
  - `contacts_found`, `emails_found` (com email != null), `phones_found`, `top_seniority`
- Anti-spam: bloqueia se houver job `done` ou `running` nas últimas **24h** para o mesmo prospect → skip `already_enriched`.
- Rate-limit por workspace: rejeita se >20 jobs Apollo nos últimos 60s → skip `rate_limited`.
- Emite eventos via `track-event` existente: `apollo_enrichment_started`, `apollo_enrichment_completed`, `decision_maker_found` (quando `decision_makers_found > 0`).

### 3. Frontend — Confirmação

**Novo: `src/components/playbook/enrichment/ApolloConfirmModal.tsx`** (usa `Dialog`)
- Aberto pelo botão "Enriquecer (Apollo)" no `ProspectContactsTab`.
- Chama `preview-apollo-enrichment` ao abrir, mostra:
  - Empresa + domínio
  - Score atual + quality label (badges)
  - Status: **Elegível** / **Não elegível** (com `reason`)
  - Estimativa: **2 créditos**
  - Warning amarelo se `already_enriched`
- Footer: `[Cancelar]` + `[Confirmar enriquecimento]` (disabled se `!eligible`).
- Ao confirmar → chama `runApolloEnrichment(prospect_id)` (já existe).

**Atualizar `ProspectContactsTab`**: trocar chamada direta por abrir `ApolloConfirmModal`.

### 4. Histórico no Drawer

**Nova aba "Histórico"** em `ProspectDetailDrawer` (entre Contatos e Enrichment).

**Novo: `src/components/playbook/enrichment/EnrichmentJobsTable.tsx`**
- Hook `useEnrichmentJobs(prospectId)` — query em `enrichment_jobs` por `prospect_id`, order desc.
- Tabela (`Table` shadcn):
  - Data | Provider | Status (badge colorido) | Créditos | Origem (`trigger_source`) | Motivo skip | Resultado (resumo)
- Linha expansível mostrando `response_summary` formatado + `request`/`response` JSON colapsado.

### 5. Relatório `/reports` — "Decisores Enriquecidos"

**Novo wrapper**: `src/components/reports/wrappers/EnrichedDecisionMakersWrapper.tsx`

**Adicionar em `ReportTabs`** novo item: `enriched-decision-makers` (label "Decisores Enriquecidos", ícone `Users`).

**Adicionar em `Reports.tsx`** novo case no `renderReport`.

**Conteúdo**:
- KPIs no topo: total de prospects enriquecidos, taxa de decisor encontrado, score médio, créditos consumidos no período.
- Tabela de contatos (`enriched_contact_profiles` join `prospects`):
  - company_name, domain, decision_maker_name, role, seniority, email, email_status, phone, linkedin, contact_score, provider, enriched_at
- Filtros locais: período (usa filtros globais de Reports), score mínimo, provider, status.
- Botão **Exportar CSV** (helper local `exportToCSV`).

### 6. Proteções

- Anti-spam (24h) — server-side em `run-apollo-enrichment`.
- Rate-limit workspace (20/min) — server-side.
- UI: botão "Confirmar" do modal vira loading + disabled enquanto a mutation roda.
- Hook `useEnrichedContacts.enrich` continua invalidando contatos; adicionar invalidação de `enrichment_jobs` query.

### Critérios de aceite

- Usuário vê custo estimado antes de rodar Apollo.
- Segunda chamada em 24h vira `skipped` com `skip_reason=already_enriched`.
- Aba Histórico lista todos os jobs com motivo claro.
- Relatório `/reports → Decisores Enriquecidos` exporta CSV com colunas pedidas.
- Eventos `apollo_enrichment_*` aparecem em `system_events`.

### Detalhes técnicos

**Arquivos novos**:
- `supabase/migrations/<ts>_apollo_audit_controls.sql`
- `supabase/functions/preview-apollo-enrichment/index.ts`
- `src/components/playbook/enrichment/ApolloConfirmModal.tsx`
- `src/components/playbook/enrichment/EnrichmentJobsTable.tsx`
- `src/hooks/useEnrichmentJobs.ts`
- `src/services/enrichment/apolloPreview.ts`
- `src/components/reports/wrappers/EnrichedDecisionMakersWrapper.tsx`
- `src/hooks/reports/useEnrichedDecisionMakersReport.ts`

**Arquivos editados**:
- `supabase/functions/run-apollo-enrichment/index.ts` — skip_reason, response_summary, anti-spam 24h, rate-limit, track-event, trigger_source.
- `src/components/playbook/ProspectContactsTab.tsx` — abre modal em vez de chamar direto.
- `src/components/playbook/ProspectDetailDrawer.tsx` — nova aba "Histórico".
- `src/components/reports/ReportTabs.tsx` — novo tab.
- `src/pages/Reports.tsx` — novo case.
- `src/services/enrichment/apolloService.ts` — passa `trigger_source: 'user'`.

**Memória a atualizar** (`mem://architectural-decision/intelligence/apollo-decision-maker-enrichment`): registrar guards de 24h, rate-limit 20/min, modal de confirmação e histórico auditável.

### Riscos

- Migration `ALTER TABLE` em prod: campos nullable, sem default destrutivo — seguro.
- Rate-limit por workspace é janela móvel via query — adequado para volume baixo atual; se crescer, mover para Redis/edge cache.
- Eventos `track-event` dependem da função existente; verificar payload aceito antes de enviar.
