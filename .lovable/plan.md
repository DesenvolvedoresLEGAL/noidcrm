

## Sprint 2.4 — Loss Intelligence V2

### Schema confirmado
- `loss_reasons`: tem `audience` (`seller`/`client`/`both`), `category`, **sem coluna `slug/key`** — uso `name + audience` como chave lógica
- `win_loss_records`: tem `reason_id`, `client_reason_id`, `win_reason_id`, **NÃO tem `updated_at` nem `deleted_at`** — uso só `created_at` p/ ranking
- `opportunities`: tem `loss_reason_id`, `client_loss_reason_id`, `requires_seller_classification`, `lost_at`, `closed_at`, `deleted_at` ✅
- `win_reasons`: tabela separada (já existe) — usada p/ labels de win_loss_record.win_reason_id
- **Não existe `client_loss_reasons`** — `client_loss_reason_id` aponta p/ `loss_reasons` filtrado por `audience IN ('client','both')`
- **27 oportunidades perdidas** sem `loss_reason_id` (de 114 total) — backfill alvo

### Plano de execução

**FASE 1 — Migration única (DDL aditivo + 1 trigger + 1 backfill):**

1. **Bucket legado por organização** — INSERT idempotente em `loss_reasons` p/ cada org distinta:
   - `name='Não classificado - legado'`, `category='Sem Classificação'`, `audience='seller'`, `is_active=true`
   - `name='Classificação obrigatória pendente'`, `category='Pendência Operacional'`, `audience='seller'`, `is_active=false` (oculto do dropdown padrão; só p/ enforcement)
   - Detecção de existência via `WHERE NOT EXISTS (... name + organization_id)`

2. **Trigger function `enforce_loss_reason_on_lost()`** + trigger `BEFORE UPDATE`:
   - Se `OLD.status != 'lost' AND NEW.status = 'lost' AND NEW.requires_seller_classification = true AND NEW.loss_reason_id IS NULL` → `RAISE EXCEPTION 'Classificação de perda obrigatória: informe loss_reason_id antes de marcar como perdida.'`
   - `SECURITY DEFINER` + `SET search_path = public`

3. **Backfill conservador** — UPDATE em opportunities perdidas sem motivo, atribuindo o id do bucket "Não classificado - legado" da própria org. Nunca sobrescreve `loss_reason_id IS NOT NULL`.

4. **6 views** (todas `security_invoker=true`):

   - **`v_win_loss_records_normalized_v2`** — DISTINCT ON `(opportunity_id)` ORDER BY `created_at DESC`. Mapeia: `reason_id → win_loss_reason_id`, `client_reason_id → win_loss_client_reason_id`, expõe `category` (derivado via lookup ao loss_reason), `competitor`, `discount_given`, `sales_cycle_days`, `decision_makers`, `lessons_learned`. Sem `updated_at` (não existe).
   
   - **`v_loss_classification_v2`** — JOIN `v_opportunities_hygiene_base` (status='lost') + `v_win_loss_records_normalized_v2`. Computa:
     - `consolidated_loss_reason_id = COALESCE(opp.loss_reason_id, wlr.win_loss_reason_id)`
     - `loss_reason_source = 'seller_loss_reason' | 'win_loss_record' | 'unclassified'`
     - `loss_classification_status` (7 valores conforme spec)
     - `loss_coverage_bucket = 'complete' | 'partial' | 'missing'`
   
   - **`v_lost_deals_v2`** — `v_loss_classification_v2` + LEFT JOIN `loss_reasons` 3x (seller/client) + `win_reasons` 1x p/ enriquecer com `*_name` e `*_category`.
   
   - **`v_loss_classification_coverage_v2`** — agregação por org com 8 campos de cobertura.
   
   - **`v_loss_reason_rollup_v2`** — agregação p/ rankings: `loss_reason_key` (uso `loss_reasons.id::text`), `loss_reason_name`, `loss_reason_category`, `loss_reason_source`, `loss_classification_status`, `lost_count`, `with_client_reason_count`.
   
   - **`v_lost_deals_amounts_v2`** — JOIN `v_lost_deals_v2` + `v_opportunity_amounts_v2` (Sprint 2.2) expondo `commercial_amount_current`, `amount_source`, `reference_proposal_id`, `reference_proposal_status`, `commercial_amount_updated_at`.

**FASE 2 — Frontend (6 arquivos novos, zero edição em telas):**

1. `src/types/lossV2.ts` — interfaces `LossClassificationV2`, `LostDealV2`, `LossCoverageV2`, `LossReasonRollupV2`, `LostDealAmountV2` + enums `LossReasonSource`, `LossClassificationStatus`, `LossCoverageBucket`
2. `src/lib/reports/lossClassification.ts` — `getLossClassificationStatusLabel(status)` + badge variant
3. `src/lib/reports/lossCoverage.ts` — `getLossCoverageLabel(bucket)` + `getCoverageHealthLabel(pct)` (Excelente/Bom/Parcial/Crítico)
4. `src/lib/reports/lossReasonLabels.ts` — `getLossReasonSourceLabel(source)` + helpers de fallback p/ "Sem motivo registrado"
5. `src/hooks/useLossClassificationCoverageV2.ts` — React Query, lê `v_loss_classification_coverage_v2`
6. `src/hooks/useLostDealsV2.ts` — aceita filtros opcionais `{ pipelineIds?, ownerIds?, dateRange? }`, lê `v_lost_deals_amounts_v2` (já com valores monetários)
7. `src/hooks/useLossReasonRollupV2.ts` — lê `v_loss_reason_rollup_v2`

**FASE 3 — Atualizar `reportsAuditStatus.ts`:** Adicionar `REPORTS_LOSS_LAYER` mapeando que aba "Perdidas" e Win/Loss Hub podem migrar p/ V2.

**FASE 4 — Artifact `relatorios-v2-sprint2.4-checklist.md`** com cobertura esperada pós-backfill (100% das 114 perdas terão consolidated_loss_reason_id, mesmo que via bucket legado).

### Decisões técnicas

- **Sem coluna slug/key em `loss_reasons`**: bucket legado identificado por `name + organization_id + category='Sem Classificação'`. Aceitável e idempotente.
- **`win_loss_records` sem `updated_at`/`deleted_at`**: ranking apenas por `created_at DESC`, sem filtro de soft-delete (não aplicável).
- **`category` em win_loss_records**: derivada via JOIN com `loss_reasons` (não existe coluna direta) — exposta na view normalizada p/ conveniência.
- **Enforcement não-retroativo**: trigger só dispara em `OLD.status != 'lost' AND NEW.status = 'lost'` p/ não bloquear updates de oportunidades já perdidas legadas.
- **`requires_seller_classification` default false**: backfill mantém deals legados editáveis sem trigger reclamar.
- **Integração Sprint 2.2**: `v_lost_deals_amounts_v2` evita que telas façam dois fetches — já vem com valor comercial.

### Critérios de aceite (mapeamento)

| # | Como atende |
|---|---|
| 1 | FASE 1.2 — trigger BEFORE UPDATE bloqueia |
| 2 | FASE 1.1 — bucket "Não classificado - legado" por org |
| 3 | FASE 1.3 — backfill atribui bucket legado às 27 perdas órfãs |
| 4 | FASE 1.4 — `v_win_loss_records_normalized_v2` |
| 5 | FASE 1.4 — `v_loss_classification_v2` |
| 6 | FASE 1.4 — `v_lost_deals_v2` |
| 7 | FASE 1.4 — `v_loss_classification_coverage_v2` |
| 8 | FASE 1.4 — `v_loss_reason_rollup_v2` |
| 9 | FASE 1.4 — `v_lost_deals_amounts_v2` integrada à 2.2 |
| 10 | Views distinguem `seller_loss_reason_id`, `client_loss_reason_id`, `win_loss_reason_id` |

### Fora de escopo

- ❌ Refator da tela de Perdidas (Sprint 6)
- ❌ Edge functions (Sprint 5)
- ❌ Tornar `requires_seller_classification=true` em massa (decisão do gestor, não desta sprint)
- ❌ Sobrescrever classificações já existentes

### Risco

Baixo. DDL aditivo + 1 trigger não-retroativo + backfill conservador idempotente + 6 hooks/types novos. Nenhuma tela existente muda comportamento.

### Tempo estimado

~30 min. 1 migration grande + 7 arquivos frontend + 1 artifact.

