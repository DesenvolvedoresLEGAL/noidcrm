# Relatórios V2 — Documentação operacional

> Versão Sprint 2.11. Documento operacional para times de Produto, Eng, Dados e IA.

## ⚡ Resumo executivo (Sprint 2.10 + 2.11)

**Problema histórico:** CEO Dashboard mostrava R$ X, Reports V2 mostrava R$ Y diferente, mesmo para a "mesma" métrica.

**Causa raiz:**
1. **Rigor monetário sem fallback** — Reports V2 só contava receita de propostas aceitas. Organizações que fecham deals sem registrar proposta apareciam com R$ 0 em até 58% das won.
2. **Janelas temporais diferentes** — CEO Dashboard = mês corrente, Reports V2 = histórico completo. Sem aviso visual, parecia bug.
3. **Sem reconcile cross-módulo** — não havia check garantindo que CEO == Reports.

**Correção (Sprint 2.10/2.11):**
- ✅ Cascata monetária: `accepted_proposal_net` → `latest_commercial_proposal_net` → `opportunity_valor_previsto` (`valor_previsto + mrr_value*12`) → `zero_fallback`.
- ✅ Função RPC `get_unified_won_revenue_v2(org, start, end)` — consumida por CEO Dashboard (mês) E Reports V2 (período arbitrário).
- ✅ View `v_unified_won_revenue_v2` (all-time) idem.
- ✅ Reconcile expandido para **14 checks** — inclui `unified_won_revenue_vs_summary` e `unified_won_count_vs_summary` (CEO ↔ Reports).
- ✅ Banner explicativo em `GeneralOverviewV2` deixando claro que escopo é histórico (não mês).
- ✅ Tooltip de composição: "X via proposta + Y via valor previsto = Total".

## 1. Arquitetura em 3 camadas

```
┌─────────────────────────────────────────────────────────────┐
│ UI (React)                                                  │
│  - src/components/reports/v2/*  (telas V2 oficiais)         │
│  - src/components/reports/wrappers/* (rollback por aba)     │
│  - useReportsV2Flag + getReportTabMode (rollout granular)   │
└──────────────────────────┬──────────────────────────────────┘
                           │ React Query → callReportEdgeFunction
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Edge Functions canônicas (V2)                               │
│  - report_summary_v2, report_processed_v2,                  │
│    report_losses_v2, report_origins_v2,                     │
│    report_forecast_v2, report_team_v2, report_closer_v2,    │
│    report_sdr_v2, report_handoff_v2,                        │
│    report_stage_balance_v2, report_stage_conversion_v2,     │
│    report_accumulated_v2                                    │
│  - QA: report_reconcile_v2 (12 checks), report_health_v2    │
└──────────────────────────┬──────────────────────────────────┘
                           │ Postgres views canônicas
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Views canônicas (V2)                                        │
│  - v_reporting_opportunities_v2 (base unificada)            │
│  - v_report_*_v2 (uma por relatório)                        │
│  - v_opportunity_amount_coverage_v2 (cobertura monetária)   │
│  - v_opportunity_history_coverage_v2 (cobertura histórica)  │
│  - v_loss_classification_coverage_v2 (cobertura de perdas)  │
│  - v_report_confidence_score_v2 (score consolidado)         │
│  - v_report_legacy_retirement_readiness_v2 (prontidão)      │
│  - v_ai_reports_context_v2 + v_ai_reports_summary_context_v2│
└─────────────────────────────────────────────────────────────┘
```

## 2. Fontes oficiais por camada

| Métrica/Sinal              | Fonte oficial (V2)                        |
|----------------------------|--------------------------------------------|
| Receita ganha              | `v_report_summary_v2.won_revenue`         |
| Pipeline ativo             | `v_report_summary_v2.active_pipeline_*`   |
| Receita por owner          | `v_report_team_v2.won_revenue`            |
| Receita por origem         | `v_report_origins_v2.won_revenue`         |
| Forecast                   | `v_report_forecast_v2.*`                  |
| Perdas                     | `v_report_losses_v2.*`                    |
| Trilha de etapa            | `v_report_stage_balance_v2`               |
| Conversão histórica        | `v_report_stage_conversion_v2`            |
| Score de confiança         | `v_report_confidence_score_v2`            |
| Prontidão por aba          | `v_report_legacy_retirement_readiness_v2` |

## 3. Dataset oficial para IA / agentes

**Use sempre:** `v_ai_reports_context_v2` (linha por oportunidade) e `v_ai_reports_summary_context_v2` (resumo por org).

Campos seguros expostos:
- identidade: `opportunity_id`, `pipeline_id`, `stage_id`, `owner_user_id`, `qualified_by_user_id`
- estado: `status`, `origem`, datas (`created_at`, `closed_at`, `won_at`, `lost_at`, `close_date_prevista`)
- valor: `commercial_amount_current`, `net_revenue_final`, `amount_source`
- proposta: `reference_proposal_status`
- histórico: `first_qualification_at`, `days_in_current_stage`
- perdas: `consolidated_loss_reason_id`, `loss_reason_source`, `loss_classification_status`, `loss_coverage_bucket`
- saúde calculada: `opportunity_health` (`won`/`lost`/`at_risk_stalled`/`attention`/`healthy`), `overdue_close_date_flag`

> ❌ Nunca consumir `opportunities` bruto no contexto de IA. Sempre passar pelas views.

## 4. Modos de rollout por aba

`useReportsV2Flag.payload.modes[<tab>]` aceita:
- `legacy_only` — só legacy
- `hybrid_rollout` — V2 quando master ligado, legacy senão
- `v2_only` — só V2 (irreversível operacionalmente)

Helper: `getReportTabMode(tab, master, sub, modes)`.

Critério recomendado para mover para `v2_only`:
- aba marcada como `ready` em `v_report_legacy_retirement_readiness_v2`
- score de confiança ≥ 75
- último reconcile = `consistent` (ou `warning` aceito explicitamente)

## 5. QA forense

### 5.1 Reconciliação (12 checks)

`report_reconcile_v2` compara:
1. `summary.won_revenue` ↔ Σ `closer.won_revenue`
2. `summary.won_revenue` ↔ `forecast.closed_revenue`
3. `summary.lost_count` ↔ Σ `losses.lost_count`
4. `summary.processed_count` ↔ `processed.processed_count`
5. `summary.win_rate_pct` ↔ `processed.win_rate_pct`
6. Σ `team.won_revenue` ↔ `summary.won_revenue`
7. Σ `origins.won_revenue` ↔ `summary.won_revenue`
8. Σ `team.won_count` ↔ `summary.won_count`
9. Σ `origins.won_count` ↔ `summary.won_count`
10. Σ `losses.lost_value` ↔ `summary.lost_value`
11. Σ `stage_balance.active_value` ↔ `summary.active_pipeline_value`
12. Σ `stage_balance.active_count` ↔ `summary.active_pipeline_count`

Tolerâncias:
- monetário: `|delta| ≤ 0.01`
- percentual: `|delta| ≤ 0.05`
- contagem: `delta = 0`

Persistência: opt-in via `options.persist=true` (default `false`). Cron diário deve enviar `persist=true` para popular `report_reconciliation_logs`.

### 5.2 Faixas de confiança

| Score | Label     |
|-------|-----------|
| ≥ 90  | Excelente |
| ≥ 75  | Alta      |
| ≥ 55  | Parcial   |
| < 55  | Baixa     |

### 5.3 Painel admin

Acesse `Configurações → Sistema → Reports V2 — Saúde da plataforma` (ou rota direta `/app/settings/system/reports-health`) para ver score global, coberturas, reconcile e prontidão por aba.

## 6. Playbook de troubleshooting

> "Os números não batem entre dois relatórios."

1. Abra **Reports V2 — Saúde da plataforma**.
2. Veja a seção **Reconciliação (12 checks)**:
   - Algum check com severidade `critical`? → identifique o par divergente (ex.: `team.won_revenue` ≠ `summary.won_revenue`).
   - Algum `warning`? → tolerância levemente excedida; verifique cargas em andamento.
3. Veja **Coberturas oficiais**:
   - Cobertura monetária baixa → muitas oportunidades sem proposta aceita; aceite/atualize as propostas.
   - Cobertura de etapa baixa → trilha histórica incompleta; revisar workflow de movimentação.
   - Cobertura de qualificação baixa → SDRs não estão preenchendo `qualified_by_user_id`.
4. Veja **Prontidão por aba**:
   - `not_ready` → ainda use legacy ou hybrid; **não force v2_only**.
   - `almost_ready` → use `hybrid_rollout` para validar com gestão.
   - `ready` → seguro mover para `v2_only`.
5. Se o problema persistir após coberturas saudáveis, rode o reconcile com `persist=true` e abra ticket com o ID do log gerado.

## 7. Fora do escopo

- Cron automático de reconciliação (Sprint futuro)
- Apagar componentes legacy
- Migração de IA atual para `v_ai_reports_context_v2` (Sprint futuro)
