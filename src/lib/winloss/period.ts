/**
 * WL-FILTERS-07 — Advanced Period & Comparison Engine (Win/Loss Intelligence Hub).
 *
 * Fonte oficial de recorte temporal do Hub: `opportunities.closed_at`
 * (fallback legado `updated_at` → `created_at`, já implementado em `useWinLossData`).
 * Este motor NÃO redefine métricas — apenas resolve intervalos e deltas.
 */
import {
  startOfDay, endOfDay, subDays,
  startOfMonth, endOfMonth, addMonths,
  startOfQuarter, endOfQuarter,
  startOfYear, endOfYear,
  format,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type WinLossPeriodType =
  | 'today' | '7d' | '15d' | 'month' | 'quarter' | 'semester' | 'year' | 'custom';

export type WinLossComparisonMode = 'none' | 'previous_period' | 'previous_year' | 'custom';

export interface WinLossRange {
  start: Date;
  end: Date;
  label: string;
  type: WinLossPeriodType;
}

/** Tipos que suportam navegação histórica ‹ › mantendo o tipo de período. */
export const NAVIGABLE_TYPES: WinLossPeriodType[] = ['month', 'quarter', 'semester', 'year'];

export function isNavigable(type: WinLossPeriodType): boolean {
  return NAVIGABLE_TYPES.includes(type);
}

export const PERIOD_LABELS: Record<WinLossPeriodType, string> = {
  today: 'Hoje',
  '7d': '7d',
  '15d': '15d',
  month: 'Mês',
  quarter: 'Trimestre',
  semester: 'Semestre',
  year: 'Ano',
  custom: 'Personalizado',
};

export const PERIOD_LABELS_LONG: Record<WinLossPeriodType, string> = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  '15d': 'Últimos 15 dias',
  month: 'Mês',
  quarter: 'Trimestre',
  semester: 'Semestre',
  year: 'Ano',
  custom: 'Personalizado',
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function semesterStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() < 6 ? 0 : 6, 1, 0, 0, 0, 0);
}

function semesterEnd(d: Date): Date {
  const s = semesterStart(d);
  return endOfMonth(addMonths(s, 5));
}

export function shortDate(d: Date): string {
  return format(d, 'dd MMM', { locale: ptBR }).replace('.', '');
}

export function fullDate(d: Date): string {
  return format(d, 'dd/MM/yyyy');
}

export function rangeLabelForType(type: WinLossPeriodType, start: Date, end: Date): string {
  switch (type) {
    case 'today':
      return 'Hoje';
    case '7d':
      return 'Últimos 7 dias';
    case '15d':
      return 'Últimos 15 dias';
    case 'month':
      return cap(format(start, "MMMM yyyy", { locale: ptBR }));
    case 'quarter':
      return `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`;
    case 'semester':
      return `${start.getMonth() < 6 ? '1º' : '2º'} Semestre ${start.getFullYear()}`;
    case 'year':
      return `${start.getFullYear()}`;
    case 'custom':
    default:
      return `${shortDate(start)} – ${shortDate(end)}`;
  }
}

/** Rótulo compacto para header mobile (ex.: Jul/26, Q2/26, 2026). */
export function compactRangeLabel(range: WinLossRange): string {
  switch (range.type) {
    case 'month':
      return cap(format(range.start, 'MMM/yy', { locale: ptBR }).replace('.', ''));
    case 'quarter':
      return `Q${Math.floor(range.start.getMonth() / 3) + 1}/${format(range.start, 'yy')}`;
    case 'semester':
      return `S${range.start.getMonth() < 6 ? 1 : 2}/${format(range.start, 'yy')}`;
    case 'year':
      return `${range.start.getFullYear()}`;
    case 'custom':
      return `${shortDate(range.start)} – ${shortDate(range.end)}`;
    default:
      return range.label;
  }
}

/**
 * Resolve o intervalo principal.
 * `anchor` define o período histórico selecionado para tipos navegáveis.
 */
export function resolvePeriodRange(
  type: WinLossPeriodType,
  options?: { anchor?: Date; customStart?: Date; customEnd?: Date; now?: Date },
): WinLossRange {
  const now = options?.now ?? new Date();
  const anchor = options?.anchor ?? now;

  let start: Date;
  let end: Date;

  switch (type) {
    case 'today':
      start = startOfDay(now);
      end = endOfDay(now);
      break;
    case '7d':
      start = startOfDay(subDays(now, 6));
      end = endOfDay(now);
      break;
    case '15d':
      start = startOfDay(subDays(now, 14));
      end = endOfDay(now);
      break;
    case 'month':
      start = startOfMonth(anchor);
      end = endOfMonth(anchor);
      break;
    case 'quarter':
      start = startOfQuarter(anchor);
      end = endOfQuarter(anchor);
      break;
    case 'semester':
      start = semesterStart(anchor);
      end = semesterEnd(anchor);
      break;
    case 'year':
      start = startOfYear(anchor);
      end = endOfYear(anchor);
      break;
    case 'custom':
    default: {
      const cs = options?.customStart ?? startOfMonth(now);
      const ce = options?.customEnd ?? now;
      start = startOfDay(cs);
      end = endOfDay(ce);
      break;
    }
  }

  return { start, end, label: rangeLabelForType(type, start, end), type };
}

/** Navega mantendo o tipo de período. dir = -1 (anterior) | +1 (próximo). */
export function shiftAnchor(type: WinLossPeriodType, anchor: Date, dir: -1 | 1): Date {
  switch (type) {
    case 'month':
      return addMonths(startOfMonth(anchor), dir);
    case 'quarter':
      return addMonths(startOfQuarter(anchor), 3 * dir);
    case 'semester':
      return addMonths(semesterStart(anchor), 6 * dir);
    case 'year':
      return new Date(anchor.getFullYear() + dir, 0, 1);
    default:
      return anchor;
  }
}

/** Bloqueia navegação para períodos integralmente no futuro. */
export function canShiftForward(type: WinLossPeriodType, anchor: Date, now = new Date()): boolean {
  if (!isNavigable(type)) return false;
  const next = shiftAnchor(type, anchor, 1);
  return resolvePeriodRange(type, { anchor: next, now }).start <= now;
}

const DAY_MS = 86_400_000;

/** Resolve o intervalo comparativo. Retorna null quando comparação está desligada. */
export function resolveComparisonRange(
  current: WinLossRange,
  mode: WinLossComparisonMode,
  options?: { customStart?: Date; customEnd?: Date; anchor?: Date; now?: Date },
): WinLossRange | null {
  if (mode === 'none') return null;

  if (mode === 'custom') {
    if (!options?.customStart || !options?.customEnd) return null;
    const start = startOfDay(options.customStart);
    const end = endOfDay(options.customEnd);
    return { start, end, label: `${shortDate(start)} – ${shortDate(end)}`, type: 'custom' };
  }

  if (mode === 'previous_year') {
    if (isNavigable(current.type)) {
      const anchor = new Date(current.start);
      anchor.setFullYear(anchor.getFullYear() - 1);
      const r = resolvePeriodRange(current.type, { anchor, now: options?.now });
      return r;
    }
    const start = new Date(current.start);
    start.setFullYear(start.getFullYear() - 1);
    const end = new Date(current.end);
    end.setFullYear(end.getFullYear() - 1);
    return { start, end, label: `${shortDate(start)} – ${shortDate(end)}`, type: current.type };
  }

  // previous_period
  if (isNavigable(current.type)) {
    const anchor = shiftAnchor(current.type, current.start, -1);
    return resolvePeriodRange(current.type, { anchor, now: options?.now });
  }

  // Rolling / custom / today: janela imediatamente anterior de mesma duração.
  const durationMs = Math.max(current.end.getTime() - current.start.getTime(), 0);
  const end = new Date(current.start.getTime() - 1);
  const start = new Date(end.getTime() - durationMs);
  return {
    start,
    end,
    label: `${shortDate(start)} – ${shortDate(end)}`,
    type: current.type,
  };
}

export const COMPARISON_LABELS: Record<WinLossComparisonMode, string> = {
  none: 'Sem comparação',
  previous_period: 'Período anterior',
  previous_year: 'Mesmo período do ano anterior',
  custom: 'Personalizado',
};

// ─── Deltas ──────────────────────────────────────────────────────────
export type MetricKind = 'number' | 'currency' | 'percent' | 'days';

export interface MetricDelta {
  /** Diferença absoluta (current - previous). */
  diff: number;
  /** Variação relativa em % — null quando base é 0 (nunca dividir por zero). */
  pct: number | null;
  /** Diferença em pontos percentuais — apenas para kind 'percent'. */
  pp: number | null;
  direction: 'up' | 'down' | 'flat';
  /** Semântica de negócio: aumento nem sempre é bom. */
  sentiment: 'positive' | 'negative' | 'neutral';
  /** false quando não há base comparativa utilizável. */
  hasBase: boolean;
  /** Texto pronto: "↑ 23%" / "↑ 8 pp" / "↓ 4 dias". */
  text: string;
}

export function calculateMetricDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
  kind: MetricKind,
  higherIsBetter: boolean,
): MetricDelta {
  const cur = Number(current ?? 0);
  const prev = previous == null ? null : Number(previous);
  const hasBase = prev != null;
  const diff = hasBase ? cur - (prev as number) : 0;

  const direction: MetricDelta['direction'] = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  const sentiment: MetricDelta['sentiment'] =
    direction === 'flat' ? 'neutral' : (direction === 'up') === higherIsBetter ? 'positive' : 'negative';

  let pct: number | null = null;
  let pp: number | null = null;
  let text = '—';

  if (hasBase) {
    if (kind === 'percent') {
      pp = Math.round(diff * 10) / 10;
      const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '=';
      text = direction === 'flat' ? '= 0 pp' : `${arrow} ${Math.abs(pp)} pp`;
    } else if (kind === 'days') {
      const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '=';
      const v = Math.abs(Math.round(diff));
      text = direction === 'flat' ? '= 0 dia' : `${arrow} ${v} ${v === 1 ? 'dia' : 'dias'}`;
      if ((prev as number) !== 0) pct = (diff / Math.abs(prev as number)) * 100;
    } else {
      if ((prev as number) === 0) {
        pct = null;
        text = cur === 0 ? '= 0%' : 'sem base comparativa';
      } else {
        pct = (diff / Math.abs(prev as number)) * 100;
        const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '=';
        text = direction === 'flat' ? '= 0%' : `${arrow} ${Math.abs(Math.round(pct))}%`;
      }
    }
  }

  return { diff, pct, pp, direction, sentiment, hasBase, text };
}

// ─── Serialização URL ────────────────────────────────────────────────
export function toISODate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function parseISODate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}
