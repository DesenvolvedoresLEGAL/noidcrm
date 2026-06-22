---
name: smart-coverage-engine
description: KAI.18 — Smart Coverage Engine. Diagnostica cobertura NOID (conta/contatos/decisor/telefone/whatsapp/oportunidade/proposta/receita) por prospect antes de gastar Apollo. Score 0-100 + classe + recomendação. Bloqueia Apollo em coverage >= 90.
type: architectural-decision
---

## Decisão
Antes de gastar Apollo/SDR/tempo, o Kairós executa `kairos-analyze-coverage` para cada prospect e diagnostica o que o NOID já sabe daquela empresa.

## Componentes
- **Tabela**: `kairos_coverage_analysis` (cache 24h via signature). Campos: account_exists, contact_status (none|partial|complete), decision_maker_status (found|partial|absent), phone_exists, whatsapp_status (ready|unknown), opportunity_status (open|won|lost|none), proposal_status (sent|viewed|accepted|declined|none), customer_status (active|former|never), coverage_score, coverage_class, missing_items, recommendations, next_best_action, apollo_blocked.
- **Edge function**: `kairos-analyze-coverage` (leitura-only sobre accounts, contacts, opportunities, proposals, enriched_contact_profiles). Match account por CNPJ → domínio → trigram (0.7).
- **Pesos**: Conta 10 + Contato 15 + Decisor 20 + Telefone 20 + WhatsApp 10 + Oportunidade 10 + Proposta 5 + Receita 10 = 100.
- **Classes**: ≥90 complete | 70–89 good | 40–69 partial | 20–39 weak | <20 new.
- **Decisor**: detectado por seniority (c_suite/director/vp/head/owner) OU title hint (head/diretor/vp/gerente/c-level) com depto LEGAL (marketing, eventos, trade, compras, operações, diretoria, comercial).
- **WhatsApp ready**: heurística celular BR (13 dígitos com 55 + DDD + 9, ou 11 dígitos com DDD + 9).

## Gate Apollo
`kairos-apollo-reveal-contact` consulta `kairos_coverage_analysis` antes de chamar Apollo:
- `apollo_blocked=true` (score ≥ 90) → skip com `reason='coverage_complete'`, 0 crédito, emite `revenue_events.apollo_skipped_by_coverage` com `credits_saved`.
- Pedido = `phone` e `phone_exists=true` → skip com `reason='phone_already_in_crm'`.
- Govenança: `apollo_auto_enrichment_rules.block_apollo_when_covered` (default true) + `coverage_block_threshold` (default 90).

## Frontend
- `useCoverageAnalysis(prospectId)` lê última análise; `useRecalculateCoverage()` chama edge com force_refresh.
- `<CoverageBadge>` colorida (🟢🟡🟠🔴) + tooltip com missing_items.
- `<SmartCoverageTab>` no ApproachBriefDrawer: "O que temos" ✅, "O que falta" ❌, "Recomendação" CTA.
- Coluna "Cobertura" na QualifiedQueueTable.

## Snapshots imutáveis
- `kairos_qualified_queue`: `coverage_score`, `coverage_class`, `missing_items`, `next_best_action` (sincronizados na análise).
- `kairos_revenue_attribution`: `coverage_score_at_capture`, `coverage_class_at_capture` (preenchidos no enfileiramento — para análise futura "cobertura alta converte mais?").

## Garantias
- ZERO escrita em accounts/contacts/opportunities/proposals/Forecast/OTE/Revenue Command. Apenas leitura.
- Não cria conta/contato/oportunidade automaticamente. Só recomenda.
- Cache 24h por (prospect_id, signature) — signature = SHA-256 dos flags computados.
