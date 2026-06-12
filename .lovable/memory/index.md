# Memory: index.md
Updated: now

# Project Memory

## Core
- Revenue metrics strictly use net value (Total - Discount). Never use gross legacy fields.
- Soft-deleted items (`deleted_at IS NOT NULL`) are universally excluded from metrics and forecasts.
- `closed_at` is the immutable source of truth for won/lost deal dates, never overwritten.
- Opportunity titles must be strictly UPPERCASE (`trg_opportunity_title_upper`).
- Multitenancy terminology uses 'Organization' exclusively. Never use 'Workspace'.
- Deal handoff/duplication must deep clone everything while resetting status to `draft`.
- Workflow rules must never automatically move deals to 'Pré-Aprovação' (manual verbal consent only).
- Forecast scenarios use centralized unified math (`calculateForecastScenarios()`).
- Security Definer RPCs must enforce `search_path = public` to prevent malicious schema overriding.
- Location custom fields only auto-save on `onBlur` or `Enter` to prevent Google Places conflicts.
- Win Rate usa fórmula única: won/(won+lost), apenas pipeline_type='sales', data via closed_at, sem soft-deleted.
- Edge functions de IA usam OpenAI direto (`OPENAI_API_KEY`). Wrapper centralizado em `supabase/functions/_shared/ai-client.ts`. Lovable AI só como fallback.
- Qualquer prompt que sugira datas DEVE injetar `dateContextPrompt()` (Hoje é YYYY-MM-DD, America/Sao_Paulo). Validação server-side rejeita datas no passado.
- Filtros/selects operacionais de usuários SEMPRE leem de `crm_active_users_view` (via `useOrganizationUsers` ou `useActiveUsers`). Inativos/excluídos só em telas administrativas.
- Sugestões IA por oportunidade (field_update, next_action) persistem em `ai_suggestions` com `context_signature`. UI lê do banco; OpenAI só roda em clique manual com `force_refresh=true`.
- `close_date_prevista` é manual-only: nunca alterado por auto-apply IA, sync de proposta, trigger DB ou workflow. Sugestões ficam pending até aceite manual.
- Valor comercial de oportunidade ganha = `proposals.approved_amount` quando `opportunities.accepted_proposal_id` existir. Nunca usar `total_amount`/`valor_previsto` como fonte principal nesse caso. Helper: `resolveApprovedCommercialAmount` (TS) e `resolve_approved_commercial_amount` (SQL). View canônica: `commercial_won_revenue_view`.
- `commercial_won_revenue_view` é a ÚNICA fonte oficial de receita realizada (Forecast, Dashboard, BI, Relatórios, Ranking, Comissão, Avulsa, Novo MRR, Kairós Attribution). Forecast "Fechado", Dashboard CEO (Avulsa/MRR/Run Rate/contagem) e `v_report_forecast_v2.closed_revenue` usam `valid_revenue_amount` (LÍQUIDO de cancelamentos) — nunca `commercial_amount` bruto. Divergência > R$ 0,01 = `REVENUE_SOURCE_MISMATCH`. Comissão usa `commission_eligibility_view`; `review_required=true` → `commission_status='blocked_review_required'` (nunca paga automático).
- Resultados/OTE/Comissão usam atribuição histórica imutável: view `commercial_won_revenue_historical_view` (vendedor no momento do ganho via `opportunity_owner_history`) e `opportunity_qualification_history` (SDR no momento da qualificação). Transferência de propriedade NÃO reescreve performance histórica. Usuários inativos com produção no período aparecem com badge "Inativo".
- Kairós atribui origem GTM à receita oficial via `kairos_revenue_attribution` (linha por opportunity_id). Nunca duplica receita nem altera Forecast/OTE/Vendas Realizadas.
- Kairós GTM Performance Hub (KAI.17) interpreta atribuição em decisões via view `kairos_gtm_performance_summary` + `kairos_gtm_recommendations` (dedup_key idempotente). Cron 04:00/04:05 BRT. Apenas leitura de fontes oficiais — nunca altera Forecast/OTE/Receita.

## Memories
- [Kairos GTM Performance Hub](mem://architectural-decision/intelligence/kairos-gtm-performance-hub) — KAI.17: summary view + recommendations table + 2 edges + cron 04:00 BRT. Bottlenecks heurísticos, rankings com CSV, ack/resolve/dismiss.
- [Kairos Revenue Attribution](mem://architectural-decision/intelligence/kairos-revenue-attribution) — KAI.16: tabela + status enum, trigger proposals/opportunities, edge sync idempotente, cron 03:30 BRT, summary view.
- [Kairos Qualified Queue](mem://features/intelligence/kairos-qualified-queue) — KAI.13: kairos_qualified_queue + trigger score/grade/sdr_ready. Importação ao CRM proibida fora de kairos-promote-to-crm. useProspectImport chama kairos-enqueue-prospect.
- [Loss accountability classification](mem://business-rules/winloss/loss-accountability-official-classification) — `loss_reasons.loss_accountability` (commercial/client/operations/market/unknown) é fonte oficial do card Perda por Falha Comercial. Nunca hardcoded no frontend.
- [User deletion historical protection](mem://security/access-control/user-deletion-historical-protection) — delete-user-with-transfer não transfere oportunidades fechadas nem created_by; preserva atribuição histórica.
- [Unified Win Rate](mem://business-rules/crm/unified-win-rate-source-of-truth) — Fonte única: sales only, closed_at, exclui soft-deleted, período por tela.
- [Close date manual-only](mem://business-rules/crm/close-date-prevista-manual-only) — Previsão de fechamento nunca alterada por auto-apply IA, sync proposta ou trigger.
- [Approved commercial amount SoT](mem://business-rules/crm/approved-commercial-amount-source-of-truth) — approved_amount > schedule > snapshot > ledger > valor_previsto. View: commercial_won_revenue_view. Backfill via RPC admin.
- [Revenue SSoT](mem://business-rules/crm/revenue-single-source-of-truth) — commercial_won_revenue_view fonte única; commission_eligibility_view; /admin/revenue-integrity + vitest guardrail REVENUE_SOURCE_MISMATCH.
- [Revenue net of cancellations](mem://business-rules/crm/revenue-net-of-cancellations) — Forecast/Dashboard/v_report_forecast_v2 leem valid_revenue_amount (líquido), excluem is_cancelled_sale=true.
- [AI suggestion cache](mem://architectural-decision/ai/opportunity-suggestions-context-signature-cache) — context_signature hash, cache em ai_suggestions, force_refresh manual only.
- [Apollo Invisible Mode](mem://architectural-decision/intelligence/apollo-invisible-mode) — KAI.15: regras org, eligibility/credits, audit, primary contact via Contact Score.
- [Apollo decision-maker enrichment](mem://architectural-decision/intelligence/apollo-decision-maker-enrichment) — Sprint E.1+E.1.1: triple-guard, anti-spam 24h, rate-limit 20/min.
- [Apollo realtime & governance](mem://architectural-decision/intelligence/apollo-realtime-and-contact-governance) — Sprint E.1.2: dedupe/resolve_primary RPCs + global realtime toasts.
- [ExpoFP provider](mem://architectural-decision/intelligence/expofp-provider-sourcing) — Detect ExpoFP iframe, fetch /data/data.js?v=<v>, bypass Firecrawl.
- [Active Users Source of Truth](mem://architectural-decision/access-control/active-users-source-of-truth) — View `crm_active_users_view` + service/hook únicos.
- [Pre-approval constraint](mem://business-rules/pre-aprovacao-manual-only-verbal-approval) — Never use workflow automation for pre-approval stage.
- [Forecast math](mem://business-rules/forecast-scenarios-unified-probability-based) — Unified probability math.
- [Account duplicate prevention](mem://business-rules/account-semantic-duplicate-prevention-mandatory) — Warn ≥70% similarity, block ≥90% via pg_trgm.
- [Win/Loss Semantic Engine](mem://architectural-decision/winloss/semantic-engine-invisible-overview) — IA semântica como motor invisível da Visão Geral.
- [Release notes automation](mem://features/release-notes/automated-generation) — Edge generate-release-notes-draft; cron sexta 21h UTC.
