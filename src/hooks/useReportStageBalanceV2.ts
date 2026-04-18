import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReportStageBalanceV2 } from '@/types/reportingV2';

interface Args {
  organizationId?: string | null;
  pipelineId?: string | null;
  enabled?: boolean;
}

export function useReportStageBalanceV2({ organizationId, pipelineId, enabled = true }: Args) {
  return useQuery({
    queryKey: ['report-stage-balance-v2', organizationId, pipelineId],
    enabled: enabled && !!organizationId,
    staleTime: 60_000,
    queryFn: async (): Promise<ReportStageBalanceV2[]> => {
      let q = (supabase as any)
        .from('v_report_stage_balance_v2')
        .select('*')
        .eq('organization_id', organizationId);
      if (pipelineId) q = q.eq('pipeline_id', pipelineId);
      const { data, error } = await q.order('active_count', { ascending: false });
      if (error) throw error;
      return (data as ReportStageBalanceV2[]) ?? [];
    },
  });
}
