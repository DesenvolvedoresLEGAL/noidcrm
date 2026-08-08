---
name: Win/Loss Advanced Period & Comparison Engine (WL-FILTERS-07)
description: Motor temporal do Win/Loss Hub — presets, navegação histórica, período custom e comparação com deltas; SSoT na URL via WinLossPeriodContext.
type: architectural-decision
---

# WL-FILTERS-07 — Period & Comparison Engine

- Motor puro: `src/lib/winloss/period.ts` (resolvePeriodRange, shiftAnchor, canShiftForward, resolveComparisonRange, calculateMetricDelta).
- SSoT temporal: `src/contexts/WinLossPeriodContext.tsx` — estado vive na URL (`period`, `anchor`, `start`, `end`, `compare`, `cstart`, `cend`), permitindo compartilhar/recarregar a análise.
- UI: `WinLossPeriodSelector` (desktop inline, mobile em Drawer) dentro de `WinLossContextSelector`.
- Tipos navegáveis (‹ ›): month, quarter, semester, year. Rolling (today/7d/15d) e custom não navegam.
- Navegação futura bloqueada quando o período inicia depois de agora.
- Comparação: `previous_period` (mesma granularidade para tipos navegáveis; janela anterior de mesma duração para rolling/custom), `previous_year`, `custom`.
- Deltas: percentuais para números/moeda, **pontos percentuais** para taxas, dias para ciclo. Nunca divide por zero (`pct = null` → "sem base comparativa"). Sentimento respeita a métrica: aumento de perdas/ciclo é negativo.
- Campo temporal oficial continua `closed_at` (fallback `updated_at`/`created_at`) em `useWinLossData` — o motor não redefine métricas.
- Testes: `src/test/lib/winlossPeriod.test.ts`.
