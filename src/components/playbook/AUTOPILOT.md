# Autopilot Batch (KAI.14)

Primeiro agente operacional do Kairós. Processa lotes inteiros (centenas de expositores) sem intervenção humana.

## Pipeline por prospect
1. **Matching CRM** via `kairos-match-company`
2. **Qualified Queue** via `kairos-enqueue-prospect`
3. **Enrichment IA** via `run-enrichment` (se permitido)
4. **Apollo** via `run-apollo-enrichment` (se permitido, score mínimo, domínio válido, sem decisor)
5. **Brief comercial** via `kairos-generate-approach-brief`
6. **SDR Ready** recalculado pelo trigger da Qualified Queue

## Tabelas
- `kairos_batch_runs` — execução (status, totais, créditos, config)
- `kairos_batch_run_items` — itens com estágio, status e priority_rank
- `kairos_batch_logs` — log operacional por ação

## Edge functions
- `kairos-autopilot-start` — cria run + items, estima créditos, dispara processor
- `kairos-autopilot-process` — worker em background (`EdgeRuntime.waitUntil`), respeita pause/cancel
- `kairos-autopilot-control` — pause / resume / cancel

## Regras invioláveis
- NUNCA cria oportunidade/conta/CRM automaticamente
- Saída sempre = Qualified Queue
- Promoção CRM continua manual (`kairos-promote-to-crm`)
- Respeita limite de créditos Apollo configurado

## UI
- Aba `Kairós > Autopilot`: KPIs, lista de runs, modal de configuração, drawer de detalhes
- Botão `🚀 Executar Autopilot` em `LeadResultsTable` (Sourcing)
