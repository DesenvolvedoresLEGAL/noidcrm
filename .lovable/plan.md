

## Sprint 2.1 (Versão Estendida) — Plano de Execução

### Contexto: o que já está pronto vs. o que falta

| Item solicitado | Status atual | Ação |
|---|---|---|
| `won_at` / `lost_at` generated columns | ✅ **Já feito** na rodada anterior | Pular |
| Índices de relatórios canônicos | ✅ Parcialmente (3 de 5) | Adicionar os 2 faltantes |
| Tabela `feature_flags` | ⚠️ Existe mas com **nome diferente** (`feature_flags`, não `organization_feature_flags`) e schema reduzido | **Criar `organization_feature_flags`** conforme spec, manter a antiga como compat |
| Seed `reports_v2_enabled` com payload granular | ⚠️ Existe como boolean simples | Reseed na nova tabela com payload `{general:false, losses:false, ...}` |
| Metas de receita (mensal/trimestral/anual) em `organization_settings` | ❌ Não existem como colunas (só JSONB `settings`) | **Adicionar colunas dedicadas** conforme spec |
| View `v_opportunities_hygiene_base` | ❌ | Criar |
| `Math.random()` no FunnelBalance | ✅ Removido na rodada anterior | Já OK |
| Forecast hardcoded `goal = 100000` | ❌ | Remover, ler `monthly_revenue_goal` |
| Closer `avg_sales_cycle_days` fake | ❌ Auditar | Trocar por "—" se sem fonte |
| Handoff `avg_qualification_hours` fake | ❌ Auditar | Trocar por "—" se sem fonte |
| Helper canônico de filtros | ✅ Já feito (`canonicalFilters.ts`) | Estender com `UNRELIABLE_METRICS` enum |
| Helper feature flags | ✅ Já feito (`useFeatureFlag`) | Estender p/ ler payload granular |
| Tela de config — metas mensal/trimestral/anual | ❌ | Adicionar bloco em Configurações da Organização |
| Bloco admin de flags V2 | ❌ | Criar painel com master switch + 6 toggles |
| `reportsAuditStatus.ts` | ❌ | Criar |

### Plano de execução (ordenado para evitar idas e voltas)

**FASE 1 — Migration (1 chamada):**
1. Adicionar 3 colunas de meta em `organization_settings` (mensal/trimestral/anual)
2. Adicionar índices faltantes (`idx_opportunities_org_deleted`, `idx_opportunities_org_status_closed_at`, `idx_opportunities_org_pipeline_status`)
3. Criar `organization_feature_flags` com schema completo + RLS + trigger updated_at
4. Seed `reports_v2_enabled` com payload granular `{general:false, losses:false, forecast:false, closer:false, team:false, stage_metrics:false}` em todas as orgs
5. Criar view `public.v_opportunities_hygiene_base` (`WHERE deleted_at IS NULL` fixo)

**FASE 2 — Auditoria (read-only) das telas afetadas:**
- `RevenueForecast.tsx` — encontrar `100000` hardcoded
- `CloserPerformanceReport.tsx` — encontrar `avg_sales_cycle_days`
- `HandoffReport.tsx` — encontrar `avg_qualification_hours`
- Localizar página/componente de "Configurações da Organização"

**FASE 3 — Frontend (em paralelo):**
1. Estender `canonicalFilters.ts` com `UNRELIABLE_METRICS` enum + `<UnreliableMetric />` component (variação semântica de `UnavailableMetric`, msg fixa "Aguardando base histórica confiável")
2. Atualizar `useFeatureFlag` p/ retornar payload granular: `useReportsV2Flag(report: 'general'|'losses'|...)`
3. **Fix RevenueForecast.tsx** — remover `100000`, ler `monthly_revenue_goal`
4. **Fix CloserPerformanceReport.tsx** — `avg_sales_cycle_days` → "—"
5. **Fix HandoffReport.tsx** — `avg_qualification_hours` → "—"
6. **Criar bloco metas** na tela de config da organização (3 inputs numéricos)
7. **Criar painel admin de flags V2** (master + 6 toggles)
8. Criar `src/lib/reports/reportsAuditStatus.ts` com 14 entradas

**FASE 4 — Validação:**
- Verificar build (`npm run build` ou checagem TS via leitura)
- Confirmar que navegação `/app/reports` continua funcional
- Atualizar artifact `relatorios-v2-sprint2.1-checklist.md` com status estendido

### Decisões técnicas

- **Tabela duplicada (`feature_flags` vs `organization_feature_flags`):** mantenho ambas. A nova é a oficial conforme spec; a antiga fica como deprecated, sem quebrar nada. Hook `useFeatureFlag` será apontado p/ a nova.
- **Metas em colunas dedicadas:** spec é explícita (`monthly_revenue_goal numeric(14,2)`). Isso desbloqueia queries SQL diretas em views canônicas (Sprint 4) sem precisar parsear JSONB.
- **`UnreliableMetric` vs `UnavailableMetric`:** semântica diferente. `Unavailable` = sem dado nesta org. `Unreliable` = métrica estruturalmente impossível até stage_history existir. Reutilizo o componente, varianto a mensagem.
- **`reportsAuditStatus.ts`:** vira **fonte única** consultada por qualquer wrapper futuro de relatório p/ decidir se exibe banner "Em validação".

### Fora de escopo (confirmado pela spec)

- ❌ `stage_history` (Sprint 2.2)
- ❌ Backfill de histórico
- ❌ Refator completo das views V2 (Sprint 4-6)
- ❌ Tornar relatórios atuais "V2-ready" — só guardrails

### Risco

- Baixo. Sem refator de UI principal, sem mudança de contrato de API. Migration é puramente aditiva.
- Build risk: zero (sem mudanças de chunking).

### Tempo estimado

~30 min execução. 1 migration + ~8 arquivos de frontend + 1 update de artifact.

