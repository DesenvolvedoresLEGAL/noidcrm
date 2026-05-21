
# Revenue Surfaces Reconciliation — SSoT Migration

## Goal
`commercial_won_revenue_view` becomes the only source for closed revenue across all 9 surfaces. Target reference (01/05/2026 → 21/05/2026): Total R$ 114.840,24 · Avulsa R$ 113.246,24 · Novo MRR R$ 1.594,00 · Vendas 40 · Ticket R$ 2.871,01 · Comissão Elegível R$ 109.846,24 · Settlement R$ 4.994,00.

## New shared infrastructure
1. `src/services/revenue/dateRange.ts` — period resolver (`thisMonth` = 1st → today using `won_at`, `lastMonth`, `custom`). No rolling 30 days. Timezone America/Sao_Paulo.
2. `src/services/revenue/revenueSsotService.ts` — single client over `commercial_won_revenue_view` exposing:
   - `getClosedRevenueSummary({ orgId, start, end, pipelineIds?, sellerIds?, revenueType? })` → total, avulsa, mrr, count, avgTicket, eligible, pendingSettlement
   - `getClosedRevenueRows(...)`
   - `getRevenueBySeller`, `getRevenueByPipeline`, `getRevenueByStage`, `getRevenueByType`
3. `src/hooks/revenue/useRevenueSsot.ts` — React Query wrappers, stable cache keys per surface.
4. `src/components/revenue/RevenueSsotBanner.tsx` — info banner for migrated surfaces; warning variant `"Esta tela ainda não usa a fonte oficial de receita."` for any not yet migrated.

## Per-surface changes (monetary won values only)
1. **Dashboard Owner** (`useOwnerDashboard.ts`) — `closedRevenue`, `closedRevenueOneTime`, `closedRevenueMRR`, `avgTicket`, won count for `conversionRate` → SSoT. Pipeline/forecast/loss blocks untouched.
2. **Forecast** (`useForecastData.ts`) — "Fechado" parcel of Committed/Best Case from SSoT; probabilistic pipeline math unchanged.
3. **Reports → Geral V2** — `wonCount`, `wonRevenue`, `avgWonTicket` from SSoT.
4. **Reports → Processadas V2** — Ganhos count, Valor Total Ganho, Média Ganho from SSoT.
5. **Reports → Estágios V2** — "Ganhamos" totals from SSoT; other stages untouched.
6. **Reports → Forecast V2** — "Receita Fechada" from SSoT.
7. **Reports → Closer V2** — Receita Fechada, Ticket Médio, Receita por vendedor, Deals ganhos from `getRevenueBySeller`.
8. **Reports → Performance Equipe V2** — Revenue por seller/team from `getRevenueBySeller`.
9. **Win/Loss Hub** — "Ganhos", "Valor Ganho", "Ticket Médio Ganho" from SSoT; loss blocks unchanged.

## Revenue Integrity
- `useRevenueIntegrity.ts`: for each surface, read its real production value via the new service hooks AND directly from the legacy path; compare to SSoT.
- Per-sale diff payload: `only_in_surface`, `only_in_ssot`, `amount_diff` with `proposal_number`, `opportunity_id`, `cliente`, `vendedor`, `won_at`, `commercial_amount`, `source`, `motivo`.
- Any |delta| > R$ 0,01 → `REVENUE_SOURCE_MISMATCH`.
- `/admin/revenue-integrity` page lists 9 surfaces with PASS/FAIL chips.

## Guardrails
- ESLint custom rule banning `valor_previsto`, `proposals.total_amount`, `v_opportunity_amounts_v2`, `useUnifiedWonRevenueV2`, `get_unified_won_revenue_v2`, `v_unified_won_revenue_v2`, `report_summary_v2.*won*`, `report_forecast_v2.*fechado*`, `report_closer_v2.*revenue*`, `report_team_v2.*revenue*` in revenue contexts.
- Warning banner on any surface not yet migrated.
- No `DROP VIEW CASCADE`. CREATE OR REPLACE only if any view tweak is needed.

## Hard prohibitions (do not touch)
Pix · ERP · Slack · PDF · `proposals.approved_amount` · `approval_snapshot` · dynamic pricing · accepted proposals · operational clones · proposal recalculation · mass updates · `DROP VIEW CASCADE`.

## Tests (`src/test/revenue/ssot.test.ts`)
Matrix per surface (Dashboard, Forecast, Reports Geral, Processadas, Estágios, Forecast V2, Closer, Performance, Win/Loss, Revenue Integrity) asserting delta ≤ R$ 0,01 vs `commercial_won_revenue_view` for the reference May 2026 window. Preserve the 5 fixed cases (SQUADRA 1.516,32 · OGGI 2.542,35 · DU PRATA 1.894,30 · ORGÂNICA 1.194,00 · NETSEEDS 1.313,40).

## Files to create
- `src/services/revenue/dateRange.ts`
- `src/services/revenue/revenueSsotService.ts`
- `src/hooks/revenue/useRevenueSsot.ts`
- `src/components/revenue/RevenueSsotBanner.tsx`
- `eslint-rules/no-legacy-revenue-source.js` (+ wire into `.eslintrc`)

## Files to edit
- `src/hooks/useOwnerDashboard.ts`
- `src/hooks/useForecastData.ts`
- `src/components/reports/v2/GeneralOverviewV2.tsx`
- `src/components/reports/v2/ProcessedOpportunitiesV2.tsx`
- `src/components/reports/v2/StageConversionReportV2.tsx`
- `src/components/reports/v2/ForecastReportV2.tsx`
- `src/components/reports/v2/CloserPerformanceV2.tsx`
- `src/components/reports/v2/TeamPerformanceV2.tsx`
- `src/hooks/intelligence/useWinLossData.ts` + `WinLossKPIStrip.tsx`
- `src/hooks/admin/useRevenueIntegrity.ts` + `src/pages/admin/RevenueIntegrity.tsx`
- `src/test/revenue/ssot.test.ts`

## Acceptance (May 1–21, 2026)
All 9 surfaces return Total = R$ 114.840,24, Avulsa = R$ 113.246,24, Novo MRR = R$ 1.594,00, Vendas = 40, Ticket = R$ 2.871,01. Revenue Integrity all green. Typecheck and build green.
