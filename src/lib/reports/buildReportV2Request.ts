/**
 * Sprint 2.7 — Conversor canônico dos filtros globais do menu de relatórios
 * para o contrato `ReportEdgeRequest` consumido pelas edge functions V2.
 */
import type { ReportEdgeRequest, ReportEdgeOptions } from '@/types/reportEdgeV2';
import type { ReportFilters } from '@/hooks/useReportFilters';

export interface BuildReportV2RequestArgs {
  organizationId: string;
  filters: ReportFilters;
  effectiveDates: { startDate: string; endDate: string };
  teamVisibility?: {
    enabled: boolean;
    visibleUserIds: string[] | null;
  };
  options?: ReportEdgeOptions;
}

export function buildReportV2RequestFromFilters(
  args: BuildReportV2RequestArgs,
): ReportEdgeRequest {
  const { organizationId, filters, effectiveDates, teamVisibility, options } = args;

  const ownerUserIds =
    filters.users && filters.users !== 'all' ? [filters.users] : undefined;

  return {
    organizationId,
    filters: {
      dateRange: {
        start: effectiveDates.startDate,
        end: effectiveDates.endDate,
      },
      pipelineIds: filters.pipelines?.length ? filters.pipelines : undefined,
      ownerUserIds,
      teamVisibility:
        teamVisibility?.enabled && teamVisibility.visibleUserIds
          ? {
              enabled: true,
              visibleUserIds: teamVisibility.visibleUserIds,
            }
          : undefined,
    },
    options: {
      limit: 100,
      offset: 0,
      sortOrder: 'desc',
      includeMeta: true,
      includeDebug: false,
      ...options,
    },
  };
}
