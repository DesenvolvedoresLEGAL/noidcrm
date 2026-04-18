import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReportStageConversionV2 } from '@/types/reportingV2';

interface Args {
  organizationId?: string | null;
  pipelineId?: string | null;
  enabled?: boolean;
}

export function useReportStageConversionV2({ organizationId, pipelineId, enabled = true }: Args) {
  return useQuery({
    queryKey: ['report-stage-conversion-v2', organizationId, pipelineId],
    enabled: enabled && !!organizationId,
    staleTime: 60_000,
    queryFn: async (): Promise<ReportStageConversionV2[]> => {
      let q = (supabase as any)
        .from('v_report_stage_conversion_v2')
        .select('*')
        .eq('organization_id', organizationId);
      if (pipelineId) q = q.eq('pipeline_id', pipelineId);
      const { data, error } = await q.order('transition_count', { ascending: false });
      if (error) throw error;
      return (data as ReportStageConversionV2[]) ?? [];
    },
  });
}
