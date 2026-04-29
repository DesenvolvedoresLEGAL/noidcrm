## Sprint E.1 — Apollo Decision-Maker Enrichment (Kairós)

Adicionar enriquecimento de **decisores** via Apollo.io ao pipeline Kairós, reusando o que já existe (tabelas `enriched_contact_profiles`, `contact_enrichment_queue`, `prospect_scores`, `enrichment_runs`) e protegendo crédito.

### Estado atual (descoberto na exploração)
- `enriched_contact_profiles` JÁ EXISTE com workspace_id, prospect_id, account_id, full_name, role_title, seniority, department, email, email_status, phone, linkedin_url, confidence, etc. **Sem provider/score/is_primary**.
- `contact_enrichment_queue` JÁ EXISTE (workspace_id, prospect_id, status, priority).
- `prospect_scores.priority_score` já é gerado (icp + signal + dq + trust − penalty).
- `quality_label` mora em `enrichment_runs` (não em prospects).
- Não há provider Apollo nem coluna `enrichment_status`/`contact_score`/`decision_maker_found` em `prospects`.

### 1. Banco (migration)

Aproveitar tudo que existe; apenas estender:

```sql
-- prospects: flags de enrichment Apollo
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS enrichment_status text,         -- pending | running | done | partial | failed | skipped
  ADD COLUMN IF NOT EXISTS contact_score int,              -- 0..100
  ADD COLUMN IF NOT EXISTS decision_maker_found boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS apollo_enriched_at timestamptz;

-- enriched_contact_profiles: campos Apollo
ALTER TABLE enriched_contact_profiles
  ADD COLUMN IF NOT EXISTS provider text,                  -- 'apollo'
  ADD COLUMN IF NOT EXISTS confidence_score int,           -- 0..100
  ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS apollo_person_id text,
  ADD COLUMN IF NOT EXISTS raw jsonb DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_ectp_prospect_email
  ON enriched_contact_profiles (workspace_id, prospect_id, lower(email))
  WHERE email IS NOT NULL;

-- enrichment_jobs: log/auditoria Apollo (não substitui contact_enrichment_queue)
CREATE TABLE IF NOT EXISTS enrichment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL,
  provider text NOT NULL,                                  -- 'apollo'
  status text NOT NULL DEFAULT 'pending',                  -- pending|running|done|failed|skipped
  credits_used int DEFAULT 0,
  contacts_found int DEFAULT 0,
  decision_makers_found int DEFAULT 0,
  error text,
  request jsonb DEFAULT '{}'::jsonb,
  response jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX idx_enrichment_jobs_ws_provider_prospect
  ON enrichment_jobs(workspace_id, provider, prospect_id);
ALTER TABLE enrichment_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY enrichment_jobs_org_select ON enrichment_jobs FOR SELECT
  USING (workspace_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
```

Service-role faz inserts via edge function; sem policy de insert para client.

### 2. Edge functions

#### `run-apollo-enrichment` (nova)
Input: `{ prospect_id }`. Fluxo:
1. Carrega prospect + último `enrichment_runs.quality_label` + `prospect_scores.priority_score`.
2. **Trigger guard** (anti-custo):
   - aborta se `quality_label !== 'high_confidence'` → status `skipped`
   - aborta se `priority_score < 180` → `skipped`
   - aborta se `decision_maker_found = true` → `skipped`
   - aborta se já existe `enrichment_jobs` provider=apollo status in (`done`,`running`) para o prospect → `skipped` (max 1 chamada)
3. Cria `enrichment_jobs` status=running.
4. Resolve domínio (`normalized_domain` ou `website`).
5. Chama Apollo `mixed_people/search` filtrando `person_titles=[CEO, Founder, Co-Founder, Head, Director, VP, Marketing, Sales, Growth, Events, Manager]` e `q_organization_domains=<domain>`. Limite: 10 pessoas.
6. Para cada pessoa: filtra por título relevante, calcula:
   - `seniority_bonus`: CEO/Founder=30, VP/Head/Director=20, Manager=10, outros=0
   - `contact_score`: email +30, email_status valid +20, linkedin +15, phone +15, seniority_bonus → cap 100
7. Insere em `enriched_contact_profiles` com `provider='apollo'`, `confidence_score`, `apollo_person_id`, `raw`. **Anti-duplicação** via `ON CONFLICT (workspace_id, prospect_id, lower(email)) DO NOTHING`.
8. Marca o de maior score como `is_primary=true`.
9. Atualiza prospect: `decision_maker_found=true se algum decisor`, `contact_score=max`, `enrichment_status='done'|'partial'|'failed'`, `apollo_enriched_at=now()`.
10. Atualiza `enrichment_jobs` com `credits_used`, `contacts_found`, `decision_makers_found`, `response`, `status`, `completed_at`.

CORS standard, valida JWT no header, usa `SERVICE_ROLE_KEY` para writes.

#### `enqueue-apollo-enrichment` (nova, opcional batch)
Lê `contact_enrichment_queue` status=`queued` priority desc, chama `run-apollo-enrichment` para cada (limite N por execução). Pode ser cron diário.

### 3. Apollo API key
Apollo é um direct API (não usa connector gateway). Vou pedir `APOLLO_API_KEY` via `add_secret` antes de implementar a edge function.

### 4. Merge rules (sem sobrescrever contexto interno)
- `summary`, `pains` → continuam vindo do enrichment interno (`enriched_company_profiles`/`commercial_briefs`).
- Apollo escreve **apenas** em `enriched_contact_profiles` (contatos) e atualiza flags em `prospects`. Nunca toca `summary`/`pains`/`company-level fields`.

### 5. Frontend

#### `ProspectDetailDrawer` — nova aba "Contatos"
- Lista contatos de `enriched_contact_profiles` para o prospect.
- Por contato: avatar/initials, full_name, role_title (badge seniority), email + status, telefone, LinkedIn (link), `confidence_score` badge.
- Ações: marcar como principal (toggle `is_primary`, garante apenas 1), copiar email/telefone, "Criar atividade" (prefilla nova activity vinculada à conta/prospect).
- Badge global "🎯 Decisor encontrado" no header do drawer quando `decision_maker_found = true`.
- Botão "Enriquecer com Apollo" se `enrichment_status` é null/failed E elegível (mostra tooltip com motivo se não-elegível).

Hook novo: `useEnrichedContacts(prospectId)` em `src/hooks/useEnrichedContacts.ts` (React Query + Supabase realtime na tabela).

Service: `src/services/enrichment/apolloService.ts` com `runApolloEnrichment(prospectId)` invocando a edge function.

### 6. Critérios de sucesso
- Decisor encontrado em >50% dos prospects elegíveis.
- Email válido (status=valid) >60%.
- Sem duplicidade (idx único `prospect_id+email`).
- Máx 1 chamada Apollo por prospect (job dedupe).
- `contact_score` calculado e exibido.

### Riscos
- **Custo Apollo** mitigado pelo triple-guard (quality_label + priority_score + decision_maker_found + dedupe job).
- Apollo retorna emails "guess" — armazenamos `email_status` para o frontend exibir confiança.
- RLS: service-role bypassa, mas SELECT continua escopado a `organization_members`.
- Sem afetar nada do CRM existente — Apollo é write-only em tabelas dedicadas.

### Próximos passos após aprovação
1. Pedir `APOLLO_API_KEY` via add_secret (única dependência externa).
2. Executar migration.
3. Criar edge functions `run-apollo-enrichment` e `enqueue-apollo-enrichment`.
4. Criar hook + service + nova aba "Contatos" no `ProspectDetailDrawer`.
5. Salvar memory: triggers/score formula/anti-duplication.
