// Sprint REL V2.11 — Hook do relatório Qualidade de Qualificação SDR
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';

export interface QualificationRow {
  sdr_user_id: string | null;
  sdr_name: string;
  sdr_status: string;
  sdr_is_active: boolean;
  sdr_is_deleted: boolean;
  qualified_count: number;
  with_proposal_count: number;
  without_proposal_count: number;
  won_count: number;
  lost_count: number;
  open_count: number;
  valid_revenue_amount: number;
  sql_to_proposal_rate: number;
  proposal_to_won_rate: number;
  sql_to_won_rate: number;
  post_qualification_loss_rate: number;
  avg_hours_qualification_to_proposal: number | null;
  avg_days_qualification_to_close: number | null;
}

export interface QualificationDrilldownRow {
  opportunity_id: string;
  opportunity_title: string | null;
  account_name: string | null;
  qualified_at: string | null;
  sdr_name: string;
  sdr_is_deleted: boolean;
  closer_name: string;
  closer_is_deleted: boolean;
  has_proposal: boolean;
  proposal_number: string | null;
  proposal_status: string | null;
  status: string;
  loss_reason_name: string | null;
  valid_revenue_amount: number;
  has_cancelled_sale: boolean;
  days_since_qualification: number | null;
  days_qualification_to_close: number | null;
  hours_qualification_to_proposal: number | null;
}

export interface QualificationQualityResponse {
  summary: {
    qualified_count: number;
    with_proposal_count: number;
    without_proposal_count: number;
    won_count: number;
    lost_count: number;
    open_count: number;
    valid_revenue_amount: number;
    sql_to_proposal_rate: number;
    proposal_to_won_rate: number;
    sql_to_won_rate: number;
    post_qualification_loss_rate: number;
  };
  rows: QualificationRow[];
  drilldown?: QualificationDrilldownRow[];
  meta: { total_opportunities: number; generated_at: string };
  confidence: 'trusted' | 'partial' | 'warning';
}

export interface QualificationExtraFilters {
  proposalStatus?: 'with' | 'without' | 'any';
  statusFilter?: ('won' | 'lost' | 'open')[];
  includeRemovedUsers?: boolean;
  sdrUserIds?: string[];
  closerUserIds?: string[];
  includeDrilldown?: boolean;
}

export function useQualificationQualityV2(extras: QualificationExtraFilters = {}) {
  const { effectiveDates, filters } = useReportFiltersContext();
  const { loading: visibilityLoading } = useTeamVisibility();

  return useQuery<QualificationQualityResponse>({
    queryKey: [
      'qualification-quality-v2',
      effectiveDates,
      filters.pipelines,
      filters.users,
      extras,
    ],
    enabled: !visibilityLoading,
    queryFn: async () => {
      const sdrUserIds = extras.sdrUserIds?.length
        ? extras.sdrUserIds
        : (filters.users !== 'all' ? [filters.users] : undefined);

      const { data, error } = await supabase.functions.invoke('report-qualification-quality-v2', {
        body: {
          dateRange: { start: effectiveDates.startDate, end: effectiveDates.endDate },
          pipelineIds: filters.pipelines?.length ? filters.pipelines : undefined,
          sdrUserIds,
          closerUserIds: extras.closerUserIds,
          status: extras.statusFilter,
          proposalStatus: extras.proposalStatus ?? 'any',
          includeRemovedUsers: extras.includeRemovedUsers ?? false,
          includeDrilldown: extras.includeDrilldown ?? false,
        },
      });
      if (error) throw error;
      return data as QualificationQualityResponse;
    },
  });
}
