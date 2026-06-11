## KAI.13 — Qualified Queue

Camada intermediária entre sourcing (Kairós) e CRM. Nenhum prospect entra no CRM sem passar pela fila de qualificação.

### 1. Schema (migration)

**Enum novo** `qualification_status`:
`captured | existing_customer | existing_account | duplicate | enriched | decision_maker_found | contact_revealed | approach_ready | ready_for_sdr | human_review | imported | discarded`

**Tabela nova** `public.kairos_qualified_queue`:
- `id uuid pk`, `organization_id uuid`, `event_id uuid null`, `prospect_id uuid fk prospects`
- `company_name text`, `domain text`, `source text`, `source_type text`
- `relationship_status text` (cliente/conta/oportunidade/novo — espelho de prospects)
- `score int 0-100`, `grade text` (A/B/C/D), `confidence numeric`
- `enrichment_status text`, `decision_maker_status text`, `contact_status text`
- `qualification_status qualification_status default 'captured'`
- `sdr_ready boolean default false`
- `approach_brief jsonb null` (dores, hipóteses, ângulo, mensagem, CTA)
- `owner_id uuid null`, `review_reason text null`, `discard_reason text null`
- `imported_at timestamptz`, `imported_opportunity_id uuid`, `imported_account_id uuid`, `imported_contact_id uuid`
- `created_at`, `updated_at` + trigger updated_at
- GRANTs (authenticated + service_role), RLS por `organization_id` via `crm_user_contexts`
- índices: `(organization_id, qualification_status)`, `(prospect_id)`, `(event_id)`

**Trigger** `trg_kairos_queue_score`: recalcula `score`, `grade`, `sdr_ready` em INSERT/UPDATE conforme regras:
- +20 ICP compatível, +15 domínio corp, +15 decisor, +15 email corp, +10 evento, +10 score IA, +10 confiança fonte, +5 sem duplicidade
- grade: A≥80, B≥60, C≥40, D<40
- `sdr_ready = true` quando: enriquecido + decisor + contato + score ≥ threshold (config 60) + sem duplicidade + sem relacionamento ativo

### 2. Edge functions

- `kairos-enqueue-prospect` — recebe `prospect_id`, calcula relationship via `kairos-match-company`, insere na fila com status inicial (`captured`, `existing_customer`, `duplicate`, `human_review`).
- `kairos-generate-approach-brief` — IA (Lovable AI Gateway / OpenAI conforme padrão do projeto) gera `approach_brief` a partir de `enriched_company_profiles` + `commercial_briefs`; persiste em `kairos_qualified_queue.approach_brief` e marca `approach_ready`.
- `kairos-promote-to-crm` — só aceita itens `ready_for_sdr`; reutiliza RPC `import_prospect_to_pipeline`; atualiza fila para `imported` com refs do CRM; cria activity (task SDR).

### 3. Hooks/services novos

- `src/services/intelligence/qualifiedQueue.ts` — CRUD/listagem/filtros.
- `src/hooks/intelligence/useQualifiedQueue.ts` — lista paginada + filtros (evento, ICP, status, relationship, score, com/sem decisor, sdr_ready, review).
- `src/hooks/intelligence/useQualifiedQueueKpis.ts` — KPIs (capturados, qualificados, ready_for_sdr, em revisão, importados, descartados, taxa aproveitamento).
- `src/hooks/intelligence/useQualifiedQueueActions.ts` — mutations: enriquecer, buscar decisores, revelar contato, gerar brief, enviar SDR (promote), descartar.

### 4. UI nova — `Kairós > Qualified Queue`

Arquivos:
- `src/components/intelligence/queue/QualifiedQueuePanel.tsx` — container.
- `QualifiedQueueKpiBar.tsx` — 7 KPIs.
- `QualifiedQueueFilters.tsx` — barra de filtros.
- `QualifiedQueueTable.tsx` — colunas: Empresa, Evento, ICP, Relacionamento (badge 🟢🟡🟠⚪), Score, Grade, Enriquecimento, Decisor, Contato, Status, Responsável, Data.
- `QualifiedQueueRowActions.tsx` — menu de ações por linha.
- `ApproachBriefDrawer.tsx` — exibe brief IA com botão "Enviar para SDR".

Integração:
- `src/pages/intelligence/KairosHub.tsx` — adicionar tab `📥 Qualified Queue` entre `Sourcing` e `Optimization`.

### 5. Redirecionar fluxo de importação atual

- `src/hooks/useProspectImport.ts`:
  - `useImportProspect` / `useBulkImportProspects` deixam de chamar `import_prospect_to_pipeline` direto. Passam a chamar `kairos-enqueue-prospect` (ou inserir na fila se já enriquecido).
  - Toast novo: "Enviado para Qualified Queue".
  - Atalho admin (`forcePromote: true`) só para platform_admin — mantém compat para testes.
- `LeadResultsTable.tsx`: botão "Importar" vira "Enviar para Triagem". Badge de relacionamento já existe — mantém.

### 6. Dashboard executivo — Pipeline de Aquisição

- `src/components/intelligence/queue/AcquisitionPipelineCard.tsx` — funil: Capturados → Qualificados → SDR → Reuniões → Propostas → Vendas (usa `kairos_qualified_queue` + `opportunities` + `commercial_won_revenue_view`).
- Adicionar no Revenue Command Center (`RevenueCommandPage.tsx`) na aba "Hoje na Operação" (ou criar bloco no topo da aba Pessoas) — read-only, não altera métricas oficiais.

### 7. Documentação

- `src/components/playbook/QUALIFIED_QUEUE.md` — explica fluxo, status, regras de score, SDR Ready, human review.
- Atualizar `SOURCING_AUDIT.md` referenciando a nova camada.

### Riscos
- Fluxo de importação muda — usuários acostumados ao botão direto verão "Enviar para Triagem". Mitigar com toast explicativo + tooltip.
- Score calculado em trigger; manter idempotente.
- Sem mudanças em RLS de tabelas existentes, sem mudanças em receita, forecast ou regras financeiras.
- `kairos-promote-to-crm` reutiliza RPC existente → comportamento de CRM intacto.

### Fora do escopo
- Cadências automáticas para SDR (só cria task inicial).
- Reprocessamento histórico de prospects já importados.
- ML para score (regras determinísticas nesta sprint).

### Arquivos criados
- migration (tabela + enum + trigger + RLS + grants)
- `supabase/functions/kairos-enqueue-prospect/index.ts`
- `supabase/functions/kairos-generate-approach-brief/index.ts`
- `supabase/functions/kairos-promote-to-crm/index.ts`
- `src/services/intelligence/qualifiedQueue.ts`
- `src/hooks/intelligence/useQualifiedQueue.ts`
- `src/hooks/intelligence/useQualifiedQueueKpis.ts`
- `src/hooks/intelligence/useQualifiedQueueActions.ts`
- `src/components/intelligence/queue/QualifiedQueuePanel.tsx`
- `src/components/intelligence/queue/QualifiedQueueKpiBar.tsx`
- `src/components/intelligence/queue/QualifiedQueueFilters.tsx`
- `src/components/intelligence/queue/QualifiedQueueTable.tsx`
- `src/components/intelligence/queue/QualifiedQueueRowActions.tsx`
- `src/components/intelligence/queue/ApproachBriefDrawer.tsx`
- `src/components/intelligence/queue/AcquisitionPipelineCard.tsx`
- `src/components/playbook/QUALIFIED_QUEUE.md`

### Arquivos editados
- `src/pages/intelligence/KairosHub.tsx`
- `src/hooks/useProspectImport.ts`
- `src/components/playbook/LeadResultsTable.tsx`
- `src/pages/RevenueCommandPage.tsx`
- `src/components/playbook/SOURCING_AUDIT.md`
