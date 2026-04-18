/**
 * Sprint 2.9 — Modo de execução por aba dos Relatórios V2.
 *
 * Modos:
 *  - 'legacy_only'    → renderizar apenas tela legacy
 *  - 'hybrid_rollout' → V2 quando master ligado; legacy quando não
 *  - 'v2_only'        → renderizar apenas tela V2
 *
 * Retro-compatibilidade: se a flag for boolean (Sprint 2.1+), `true` → 'v2_only',
 * `false` → 'legacy_only'. O payload novo opcional `modes: Record<SubKey, Mode>`
 * tem precedência sobre o boolean.
 */
import type { ReportsV2SubFlags } from '@/hooks/useReportsV2Flag';

export type ReportTabMode = 'legacy_only' | 'hybrid_rollout' | 'v2_only';

export type ReportTabModes = Partial<Record<keyof ReportsV2SubFlags, ReportTabMode>>;

export function getReportTabMode(
  subKey: keyof ReportsV2SubFlags,
  master: boolean,
  sub: ReportsV2SubFlags,
  modes?: ReportTabModes,
): ReportTabMode {
  // Explicit mode wins.
  const explicit = modes?.[subKey];
  if (explicit) return explicit;

  // Boolean fallback (Sprint 2.1 schema).
  if (sub[subKey] === true) {
    // Master ligado + sub true = v2_only; sub true sem master = hybrid (segurança).
    return master ? 'v2_only' : 'hybrid_rollout';
  }
  return 'legacy_only';
}
