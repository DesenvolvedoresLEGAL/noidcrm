

## Sprint 2.2 — Camada Canônica de Valores Comerciais

### Schema confirmado (read-only audit)

- **`proposals`**: tem `id, opportunity_id, organization_id, status, total_amount, discount_amount, accepted_at, updated_at, created_at, deleted_at` ✅
- **Statuses reais hoje**: `draft, sent, rejected, accepted`. Spec pede tb `viewed, negotiating, approved_pending` — incluo no IN-list mesmo sem dados atuais (forward-compat).
- **`opportunities`**: tem `valor_previsto, won_at, lost_at, closed_at, close_date_prevista, owner_user_id, qualified_by_user_id, deleted_at` ✅. **Não existe `sdr_user_id`/`closer_user_id`** — uso `owner_user_id` + `qualified_by_user_id` conforme spec.
- **Hygiene base view** existe (Sprint 2.1) — só faltam as colunas comerciais.

### Plano de execução

**FASE 1 — Migration única (DDL aditivo, zero risco):**

1. **View `v_proposals_normalized_v2`** — base monetária por proposta:
   - `gross_amount = total_amount`
   - `discount_amount = COALESCE(discount_amount, 0)`
   - `net_amount = total_amount - COALESCE(discount_amount, 0)`
   - `WHERE deleted_at IS NULL`

2. **View `v_opportunity_accepted_proposal_v2`** — 1 proposta aceita por oportunidade via `DISTINCT ON (opportunity_id)` ORDER BY `accepted_at DESC NULLS LAST, updated_at DESC, created_at DESC`, filtro `status='accepted'`.

3. **View `v_opportunity_latest_commercial_proposal_v2`** — última proposta comercial via `DISTINCT ON (opportunity_id)` ORDER BY `updated_at DESC, created_at DESC`, filtro `status IN ('draft','sent','viewed','negotiating','approved_pending','rejected','accepted')`.

4. **View principal `v_opportunity_amounts_v2`** — JOIN da hygiene base + as 2 views acima, com lógica:

   ```sql
   commercial_amount_current = CASE status
     WHEN 'won'  THEN COALESCE(accepted.net_amount, valor_previsto, 0)
     WHEN 'lost' THEN COALESCE(latest.net_amount,   valor_previsto, 0)
     ELSE             COALESCE(latest.net_amount,   valor_previsto, 0)
   END

   net_revenue_final = CASE WHEN status='won' 
     THEN COALESCE(accepted.net_amount, 0) ELSE 0 END

   amount_source = CASE
     WHEN status='won' AND accepted.net_amount IS NOT NULL THEN 'accepted_proposal_net'
     WHEN latest.net_amount IS NOT NULL                    THEN 'latest_commercial_proposal_net'
     WHEN valor_previsto IS NOT NULL AND valor_previsto>0  THEN 'opportunity_estimated_fallback'
     ELSE                                                       'zero_fallback'
   END

   reference_proposal_id     = CASE source WHEN accepted THEN accepted.id ELSE latest.id END
   reference_proposal_status = idem
   commercial_amount_updated_at = COALESCE(accepted.accepted_at, latest.updated_at, opp.updated_at)
   ```
   
   Inclui todos campos exigidos: `accepted_proposal_*`, `latest_proposal_*`, `has_accepted_proposal`, `has_any_commercial_proposal`, `won_at`, `lost_at`, `close_date_prevista`, etc.

5. **View `v_opportunity_amount_coverage_v2`** — agrega por `organization_id`:
   - `total_opportunities`
   - `using_accepted_proposal_net`, `using_latest_proposal_net`, `using_opportunity_fallback`, `using_zero_fallback`
   - `proposal_based_coverage_pct = (using_accepted + using_latest) / total * 100`

6. **Índices** (idempotentes via `IF NOT EXISTS`):
   - `idx_proposals_org_opportunity_status (organization_id, opportunity_id, status) WHERE deleted_at IS NULL`
   - `idx_proposals_opportunity_updated_at (opportunity_id, updated_at DESC) WHERE deleted_at IS NULL`
   - `idx_proposals_opportunity_accepted_at (opportunity_id, accepted_at DESC) WHERE status='accepted' AND deleted_at IS NULL`
   - `idx_opportunities_org_status_pipeline (organization_id, status, pipeline_id) WHERE deleted_at IS NULL`

7. **`security_invoker=true`** em todas as views (respeita RLS do usuário).

**FASE 2 — Frontend (4 arquivos novos, zero edição em telas existentes):**

1. `src/lib/reports/amountSources.ts` — enum + labels PT-BR + helper `getAmountSourceLabel(source)`:
   - `accepted_proposal_net` → "Proposta aceita (líquida)"
   - `latest_commercial_proposal_net` → "Proposta comercial mais recente"
   - `opportunity_estimated_fallback` → "Valor estimado da oportunidade"
   - `zero_fallback` → "Sem base monetária"
   - Inclui badge variant (success/info/warning/destructive) p/ uso futuro em UI

2. `src/hooks/useOpportunityAmountsV2.ts` — React Query hook:
   - Aceita filtros opcionais: `{ pipelineIds?, ownerIds?, status?, dateRange? }`
   - SELECT da view `v_opportunity_amounts_v2` filtrado por `organization_id` (RLS já cobre, mas explicito p/ guardrail)
   - Retorna tipado: `OpportunityAmountV2[]`
   - `staleTime: 60s`

3. `src/hooks/useAmountCoverageV2.ts` — hook agregador:
   - SELECT da view `v_opportunity_amount_coverage_v2`
   - Retorna `{ totalOpportunities, usingAcceptedProposalNet, ..., proposalBasedCoveragePct }`
   - Pensado p/ futuro "Reliability Score" badge

4. **Tipos**: `src/types/reportsV2.ts` (novo) com interfaces `OpportunityAmountV2`, `AmountCoverageV2`, `AmountSource`. Tipos derivados também via `Database['public']['Views']` automaticamente regenerados.

**FASE 3 — Atualizar `reportsAuditStatus.ts`:**

Adicionar nova seção `monetaryLayer` documentando que telas que migrarem p/ `useOpportunityAmountsV2` podem promover de `LEGACY_UNSAFE` → `V2_READY` no eixo monetário.

**FASE 4 — Artifact:**

Atualizar `/mnt/documents/relatorios-v2-sprint2.2-checklist.md` com mapa de cobertura: quais relatórios podem migrar agora vs. quais ainda dependem de Sprint 2.3+.

### Decisões técnicas

- **`DISTINCT ON` vs `ROW_NUMBER()`**: uso `DISTINCT ON` (Postgres-native, mais legível e indexável).
- **`security_invoker=true` em todas views**: garante que RLS de `proposals` e `opportunities` se aplica ao consumidor — segurança multitenant preservada sem RLS adicional na view.
- **Forward-compat de status**: incluo `viewed, negotiating, approved_pending` no IN-list mesmo não existindo hoje, conforme spec.
- **Sem `sdr_user_id`/`closer_user_id`**: spec menciona mas schema não tem. Uso `owner_user_id` (closer convencional) + `qualified_by_user_id` (SDR convencional). Documento isso no checklist.
- **Sem refator de telas**: critério de aceite #10 explícito — só infraestrutura.

### Critérios de aceite (mapeamento)

| # | Critério | Como atende |
|---|---|---|
| 1 | View oficial `v_opportunity_amounts_v2` | Migration FASE 1.4 |
| 2 | Won usa proposta aceita líquida | CASE WHEN status='won' THEN accepted.net_amount |
| 3 | Open usa proposta comercial mais recente | CASE ELSE latest.net_amount |
| 4 | Lost usa proposta comercial mais recente | CASE WHEN status='lost' THEN latest.net_amount |
| 5 | `amount_source` claro | 4 valores enum-style |
| 6 | `reference_proposal_id` + `reference_proposal_status` | Computados na view |
| 7 | View de cobertura | `v_opportunity_amount_coverage_v2` |
| 8 | Funciona sem proposta | Fallback `valor_previsto` → `0` |
| 9 | Fallback explícito | `amount_source` distingue cada caso |
| 10 | Nada consulta valor diretamente | Hooks novos só lêem das views |

### Fora de escopo

- ❌ Refator de relatórios (Sprint 6)
- ❌ Edge functions de apuração (Sprint 5)
- ❌ Snapshot histórico financeiro (Sprint 3)
- ❌ Stage history (Sprint 2.3 ou similar)

### Risco

Baixíssimo. 100% DDL aditivo + 4 arquivos novos de frontend (zero edição). Nenhuma tela existente muda comportamento.

### Tempo estimado

~25 min. 1 migration + 4 arquivos novos + 1 update de checklist.

