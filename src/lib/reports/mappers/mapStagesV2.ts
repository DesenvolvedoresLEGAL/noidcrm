/**
 * Sprint 2.8 — Mapper combinado de Stages V2 (estado atual + fluxo histórico).
 */
import type { ReportStageBalanceV2, ReportStageConversionV2 } from '@/types/reportingV2';
import { mapStageBalanceV2, type StageBalanceView } from './mapStageBalanceV2';
import { mapStageConversionV2, type StageConversionView } from './mapStageConversionV2';

export interface StagesView {
  balance: StageBalanceView;
  conversion: StageConversionView;
}

export function mapStagesV2(
  balance: ReportStageBalanceV2[] | null | undefined,
  conversion: ReportStageConversionV2[] | null | undefined,
): StagesView {
  return {
    balance: mapStageBalanceV2(balance),
    conversion: mapStageConversionV2(conversion),
  };
}
