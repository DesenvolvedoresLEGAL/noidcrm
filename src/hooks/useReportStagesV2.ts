/**
 * Sprint 2.8 — Hook V2 combinado de Conversão por Estágio (Stage Conversion Report).
 * Orquestra `report_stage_balance_v2` + `report_stage_conversion_v2` em paralelo.
 */
import type { ReportEdgeRequest } from '@/types/reportEdgeV2';
import { useReportStageBalanceV2 } from './useReportStageBalanceV2';
import { useReportStageConversionV2 } from './useReportStageConversionV2';

interface Args {
  organizationId?: string | null;
  request?: ReportEdgeRequest;
  enabled?: boolean;
}

export function useReportStagesV2({ organizationId, request, enabled = true }: Args) {
  const balance = useReportStageBalanceV2({ organizationId, request, enabled });
  const conversion = useReportStageConversionV2({ organizationId, request, enabled });

  return {
    balance: balance.data,
    conversion: conversion.data,
    // Meta principal vem do balance (estado atual é mais representativo).
    meta: balance.meta,
    error: balance.error ?? conversion.error,
    isLoading: balance.isLoading || conversion.isLoading,
    isFetching: balance.isFetching || conversion.isFetching,
    refetch: () => {
      balance.refetch();
      conversion.refetch();
    },
  };
}
