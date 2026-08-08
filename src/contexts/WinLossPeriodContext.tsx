/**
 * WL-FILTERS-07 — SSoT temporal do Win/Loss Intelligence Hub.
 * A URL é a fonte única: period, anchor, start, end, compare, cstart, cend.
 * Todas as abas/KPIs derivam daqui — nunca de estado local paralelo.
 */
import React, { createContext, useCallback, useContext, useMemo, ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  resolvePeriodRange, resolveComparisonRange, shiftAnchor, canShiftForward,
  isNavigable, toISODate, parseISODate,
  type WinLossPeriodType, type WinLossComparisonMode, type WinLossRange,
} from '@/lib/winloss/period';

interface WinLossPeriodContextValue {
  periodType: WinLossPeriodType;
  anchor: Date;
  range: WinLossRange;
  comparisonMode: WinLossComparisonMode;
  comparisonRange: WinLossRange | null;
  isComparing: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isNavigablePeriod: boolean;
  setPeriodType: (type: WinLossPeriodType) => void;
  setCustomRange: (start: Date, end: Date) => void;
  navigate: (dir: -1 | 1) => void;
  goToCurrent: () => void;
  setComparisonMode: (mode: WinLossComparisonMode) => void;
  setCustomComparison: (start: Date, end: Date) => void;
}

const Ctx = createContext<WinLossPeriodContextValue | undefined>(undefined);

const VALID_PERIODS: WinLossPeriodType[] = ['today', '7d', '15d', 'month', 'quarter', 'semester', 'year', 'custom'];
const VALID_COMPARES: WinLossComparisonMode[] = ['none', 'previous_period', 'previous_year', 'custom'];

export function WinLossPeriodProvider({
  children,
  defaultPeriod = 'year',
}: {
  children: ReactNode;
  defaultPeriod?: WinLossPeriodType;
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const periodType = useMemo<WinLossPeriodType>(() => {
    const raw = searchParams.get('period') as WinLossPeriodType | null;
    return raw && VALID_PERIODS.includes(raw) ? raw : defaultPeriod;
  }, [searchParams, defaultPeriod]);

  const anchor = useMemo(() => parseISODate(searchParams.get('anchor')) ?? new Date(), [searchParams]);
  const customStart = useMemo(() => parseISODate(searchParams.get('start')), [searchParams]);
  const customEnd = useMemo(() => parseISODate(searchParams.get('end')), [searchParams]);

  const comparisonMode = useMemo<WinLossComparisonMode>(() => {
    const raw = searchParams.get('compare') as WinLossComparisonMode | null;
    return raw && VALID_COMPARES.includes(raw) ? raw : 'none';
  }, [searchParams]);

  const compareStart = useMemo(() => parseISODate(searchParams.get('cstart')), [searchParams]);
  const compareEnd = useMemo(() => parseISODate(searchParams.get('cend')), [searchParams]);

  const range = useMemo(
    () => resolvePeriodRange(periodType, {
      anchor,
      customStart: customStart ?? undefined,
      customEnd: customEnd ?? undefined,
    }),
    [periodType, anchor, customStart, customEnd],
  );

  const comparisonRange = useMemo(
    () => resolveComparisonRange(range, comparisonMode, {
      customStart: compareStart ?? undefined,
      customEnd: compareEnd ?? undefined,
    }),
    [range, comparisonMode, compareStart, compareEnd],
  );

  const patchParams = useCallback((patch: Record<string, string | null>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(patch).forEach(([k, v]) => {
        if (v == null || v === '') next.delete(k);
        else next.set(k, v);
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setPeriodType = useCallback((type: WinLossPeriodType) => {
    patchParams({
      period: type,
      anchor: isNavigable(type) ? toISODate(new Date()) : null,
      start: null,
      end: null,
    });
  }, [patchParams]);

  const setCustomRange = useCallback((start: Date, end: Date) => {
    patchParams({
      period: 'custom',
      anchor: null,
      start: toISODate(start),
      end: toISODate(end),
    });
  }, [patchParams]);

  const navigate = useCallback((dir: -1 | 1) => {
    if (!isNavigable(periodType)) return;
    patchParams({ anchor: toISODate(shiftAnchor(periodType, range.start, dir)) });
  }, [patchParams, periodType, range.start]);

  const goToCurrent = useCallback(() => {
    patchParams({ anchor: toISODate(new Date()) });
  }, [patchParams]);

  const setComparisonMode = useCallback((mode: WinLossComparisonMode) => {
    patchParams({
      compare: mode === 'none' ? null : mode,
      cstart: mode === 'custom' ? searchParams.get('cstart') : null,
      cend: mode === 'custom' ? searchParams.get('cend') : null,
    });
  }, [patchParams, searchParams]);

  const setCustomComparison = useCallback((start: Date, end: Date) => {
    patchParams({ compare: 'custom', cstart: toISODate(start), cend: toISODate(end) });
  }, [patchParams]);

  const value = useMemo<WinLossPeriodContextValue>(() => ({
    periodType,
    anchor,
    range,
    comparisonMode,
    comparisonRange,
    isComparing: !!comparisonRange,
    isNavigablePeriod: isNavigable(periodType),
    canGoBack: isNavigable(periodType),
    canGoForward: canShiftForward(periodType, range.start),
    setPeriodType,
    setCustomRange,
    navigate,
    goToCurrent,
    setComparisonMode,
    setCustomComparison,
  }), [
    periodType, anchor, range, comparisonMode, comparisonRange,
    setPeriodType, setCustomRange, navigate, goToCurrent, setComparisonMode, setCustomComparison,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWinLossPeriod() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWinLossPeriod must be used within a WinLossPeriodProvider');
  return ctx;
}
