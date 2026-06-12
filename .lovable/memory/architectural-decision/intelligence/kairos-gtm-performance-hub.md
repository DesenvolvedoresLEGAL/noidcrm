---
name: Kairós GTM Performance Hub (KAI.17)
description: Interpreta atribuição de receita em decisões — view kairos_gtm_performance_summary + kairos_gtm_recommendations + 2 edges + cron 04:00 BRT. Apenas lê fontes oficiais; nunca altera Forecast/OTE/Receita.
type: architectural-decision
---

# Kairós GTM Performance Hub (KAI.17)

**Princípio:** KAI.16 atribui receita; KAI.17 interpreta e recomenda. Nunca cria nova verdade financeira.

## Database
- View `kairos_gtm_performance_summary`: junta `kairos_qualified_queue` + `kairos_revenue_attribution` + `apollo_enrichment_audit`. Grupos: org/event/icp/batch/owner/sdr/department/source_type.
- View `kairos_apollo_performance_summary`: agrega apollo audit por org/icp/batch.
- Tabela `kairos_gtm_recommendations` (idempotente via `dedup_key` único por org). Severity, status, metric_snapshot JSONB.
- Função `fn_kairos_compute_gtm_performance(org)` retorna totals JSON.

## Edge functions
- `kairos-compute-gtm-performance`: itera orgs, chama RPC, retorna totals.
- `kairos-generate-gtm-recommendations`: lê summary, detecta padrões (event_focus, low_conversion_source, apollo_coverage_issue, sdr_bottleneck, proposal_bottleneck, department_winner), upsert via dedup_key.

## Cron
- `kairos-compute-gtm-performance-daily` — 04:00 BRT (07:00 UTC).
- `kairos-generate-gtm-recommendations-daily` — 04:05 BRT.

## UI
Aba **📊 GTM Performance** no Kairós Hub (após Revenue Attribution):
- KpiBar (receita válida, capturados, SDR Ready, vendas, R$/crédito Apollo).
- Funil GTM com volume + conversão por etapa.
- Gargalos automáticos (heurística por etapa: ≥30% perda = warning, ≥70% = crítico).
- Recomendações com ack/resolve/dismiss.
- Rankings por evento/ICP/batch/decisor/SDR, cada um com CSV.
- Botão "Atualizar performance" dispara as duas edges em paralelo.

## Regras invioláveis
- Receita lida apenas via `kairos_revenue_attribution.valid_revenue_amount` (oriunda de `commercial_won_revenue_view`).
- Não altera OTE/Forecast/Vendas Realizadas.
- Recomendações nunca duplicam: `dedup_key` inclui tipo+target+data.
