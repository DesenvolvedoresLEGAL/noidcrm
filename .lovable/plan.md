

## Sprint 2.9 — QA Forense, Reconciliação Final, Readiness e Preparação para IA

### Contexto confirmado
- `report_reconcile_v2` hoje tem **5 checks** (precisa **12** + tolerâncias por tipo)
- `report_reconciliation_logs` já existe (Sprint 2.6); só preciso garantir compatibilidade
- 3 coverage views existem: monetary, history (com `stage_history_coverage_pct` + `owner_history_coverage_pct` + `qualification_history_coverage_pct`), loss (com `complete_coverage_pct` + `any_coverage_pct`)
- `v_reporting_opportunities_v2` já tem todos os campos necessários para o dataset de IA
- `useReportsV2Flag` hoje é boolean por aba — preciso evoluir para `'legacy_only' | 'hybrid_rollout' | 'v2_only'` mantendo retro-compatibilidade
- Painel admin atual está desatualizado (só mostra 6 sub-flags da Fase 1) — não vou refatorá-lo nesta sprint, só criar o novo `ReportsHealthAdminPanel`

### Plano de execução

**FASE 1 — Migration (1 arquivo grande)**
1. **Expandir `report_reconciliation_logs`** se necessário (já tem todos os campos, só validar)
2. **`v_report_confidence_score_v2`** — junta as 3 coverage views por org. `overall_confidence_score` = média ponderada (monetary 30% + stage_history 20% + owner_history 10% + qual_history 15% + loss_complete 15% + loss_any 10%)
3. **`v_report_legacy_retirement_readiness_v2`** — uma linha por (org, report_key) para 13 abas. Lê confidence + último reconcile do `report_reconciliation_logs`. `readiness_status` derivado dos critérios da spec; `readiness_score` 0-100; `reasons` em JSONB
4. **`v_ai_reports_context_v2`** — projeção da `v_reporting_opportunities_v2` com `opportunity_health` calculado via CASE (lost/won/at_risk_stalled ≥14d / attention ≥7d / healthy) + `overdue_close_date_flag` (close_date_prevista < now() AND status='open')
5. **`v_ai_reports_summary_context_v2`** — agrega por org: won_revenue/active_pipeline/losses/forecast/confidence_score + último `reconcile_status` (subquery em `report_reconciliation_logs`)

Todas com `security_invoker = true` e RLS via `organization_id = get_user_organization_id()`.

**FASE 2 — Edge functions (2 arquivos)**
6. **Reescrever `report_reconcile_v2`** com 12 checks + tolerâncias diferenciadas (`tolerance_monetary=0.01`, `tolerance_pct=0.05`, `tolerance_count=0`). Aceita `options.persist=true` (default false) para gravar em `report_reconciliation_logs`. Mantém `overallStatus`. Busca paralela: summary + processed + forecast + closer + losses + team + origins + stage_balance.
7. **`report_health_v2`** (novo) — lê `v_report_confidence_score_v2` + `v_report_legacy_retirement_readiness_v2` + invoca `report_reconcile_v2` internamente. Retorna `{confidence, coverage, reconcile, readiness, warnings}`.

**FASE 3 — Modos de flag (2 arquivos)**
8. **Atualizar `useReportsV2Flag`** — payload agora aceita `mode: 'legacy_only'|'hybrid_rollout'|'v2_only'` por aba E mantém boolean para retro-compat. Conversão: boolean `true` → `v2_only`, boolean `false` → `legacy_only`. Campos novos opcionais no payload em chave `modes: Record<SubKey, Mode>`.
9. **Helper `getReportTabMode(tab, master, sub, modes)`** em `src/lib/reports/getReportTabMode.ts` — retorna `'legacy_only'|'hybrid_rollout'|'v2_only'`. `isReportTabV2Enabled` continua funcionando (true se mode === 'v2_only' ou (hybrid + master ligado)).

**FASE 4 — Hooks + helpers UI (6 arquivos)**
10. `src/hooks/useReportHealthV2.ts` — invoca `report_health_v2` via `callReportEdgeFunction`
11. `src/hooks/useReportReconcileV2.ts` — invoca `report_reconcile_v2`
12. `src/hooks/useReportLegacyReadinessV2.ts` — lê `v_report_legacy_retirement_readiness_v2` direto via Supabase client
13. `src/lib/reports/confidenceLabels.ts` — `getConfidenceLabel(score)` → `{label, tone}` (Excelente ≥90 / Alta ≥75 / Parcial ≥55 / Baixa <55)
14. `src/lib/reports/readinessLabels.ts` — `getReadinessLabel(status)` (`ready`/`almost_ready`/`not_ready`)
15. `src/lib/reports/reconcileLabels.ts` — `getReconcileLabel(severity)` + `getReconcileOverallLabel(status)`

**FASE 5 — Componentes admin (4 arquivos)**
16. `src/components/admin/reports/ReportCoverageCards.tsx` — 6 cards (monetary/stage/owner/qual/loss_complete/loss_any) usando dados do `useReportHealthV2`
17. `src/components/admin/reports/ReportReconcileTable.tsx` — tabela dos 12 checks com badges de severidade
18. `src/components/admin/reports/ReportReadinessTable.tsx` — tabela 13 abas × status + razões + score
19. `src/pages/settings/system/sections/ReportsHealthAdminPanel.tsx` — 6 blocos (score geral / coberturas / reconcile / readiness / warnings / flags-rollout). Usa os 3 hooks e os 3 componentes auxiliares.

**FASE 6 — Roteamento (2 arquivos)**
20. `src/pages/settings/system/ReportsHealthAdminPage.tsx` — wrapper SettingsPageWrapper
21. Adicionar rota em `src/App.tsx` ou `src/pages/SettingsLayout.tsx` (verificar onde a página atual de flags está roteada e seguir o mesmo padrão)

**FASE 7 — Documentação + artifact (2 arquivos)**
22. `docs/relatorios-v2-operacional.md` — arquitetura (3 camadas: views→edges→UI), fontes oficiais, dataset oficial IA (`v_ai_reports_context_v2`), playbook de troubleshooting (passo-a-passo: rodar reconcile → ver readiness → ajustar coverage)
23. `/mnt/documents/relatorios-v2-sprint2.9-checklist.md` — artifact final

### Decisões técnicas

- **Reconcile checks (12 total)**: 5 atuais + 7 novos (team_revenue/origins_revenue/team_count/origins_count/losses_value/stage_balance_value/stage_balance_count). Tolerância por tipo: monetary 0.01 absoluto, pct 0.05 absoluto, count 0 absoluto.
- **Persistência**: hoje sempre grava. Vou mudar para opt-in via `options.persist=true` (default false) — evita poluir logs em refreshes de UI; cron diário pode ligar.
- **`overall_confidence_score`**: pesos baseados em criticidade — monetary é peso máximo (sem valor não há receita confiável); loss_any é peso mínimo (parcial é aceitável). Documentado no comment da view.
- **Readiness por aba**: critérios literais da spec, codificados em CASE WHEN dentro da view.
- **Modes de flag**: extensão retro-compat. Nenhum código existente quebra. Novo helper coexiste com `isReportTabV2Enabled`.
- **`v_ai_reports_context_v2`**: filtra `deleted_at IS NULL` (já vem da hygiene_base) e expõe apenas campos seguros — sem PII bruta de cliente.
- **Health endpoint** invoca `report_reconcile_v2` internamente para ter um único ponto de verdade — evita duplicar lógica de checks.
- **Sem refactor do `ReportsV2FlagsSection`**: novo painel é separado (`ReportsHealthAdminPanel`). Painel antigo continua para edição manual de flags; novo é read-only de saúde.
- **RLS em todas as views novas**: `security_invoker = true` para herdar do caller.

### Critérios de aceite

| # | Como atende |
|---|---|
| 1 | FASE 2.6 — reconcile com 12 checks |
| 2 | FASE 2.6 — `options.persist=true` |
| 3 | FASE 1.2 — `v_report_confidence_score_v2` |
| 4 | FASE 1.3 — `v_report_legacy_retirement_readiness_v2` |
| 5 | FASE 2.7 — `report_health_v2` |
| 6 | FASE 5.19 — `ReportsHealthAdminPanel` |
| 7 | FASE 1.4 — `v_ai_reports_context_v2` |
| 8 | FASE 1.5 — `v_ai_reports_summary_context_v2` |
| 9 | FASE 1.3 — readiness por aba |
| 10 | FASE 3.8/9 — 3 modos suportados |
| 11 | Readiness expõe quais abas estão `ready` para `v2_only` |
| 12 | Coverage cards + readiness table mostram parcialidade |
| 13 | FASE 7 — documentação operacional |
| 14 | FASE 1.4/5 — views oficiais para IA |

### Fora de escopo
- ❌ Migrar consumo de IA atual para as novas views (Sprint futuro)
- ❌ Cron automático de reconciliação (Sprint futuro com `daily-backup-cron`)
- ❌ Apagar componentes legacy
- ❌ Refator do painel `ReportsV2FlagsSection`
- ❌ Persistência automática (apenas opt-in)

### Risco
Médio. ~23 arquivos: 1 migration grande + 2 edge functions + 9 frontend (hooks/helpers/componentes) + 2 settings (panel/page) + roteamento + 2 docs. Migration é 100% aditiva (CREATE OR REPLACE VIEW + CREATE TABLE IF NOT EXISTS). Edge function `report_reconcile_v2` é reescrita compatível (mantém formato de resposta + adiciona checks).

### Tempo estimado
~70 min.

