import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReportProcessedV2 } from '@/types/reportingV2';

interface Args {
  organizationId?: string | null;
  enabled?: boolean;
}

export function useReportProcessedV2({ organizationId, enabled = true }: Args) {
  return useQuery({
    queryKey: ['report-processed-v2', organizationId],
    enabled: enabled && !!organizationId,
    staleTime: 60_000,
    queryFn: async (): Promise<ReportProcessedV2 | null> => {
      const { data, error } = await (supabase as any)
        .from('v_report_processed_v2')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (error) throw error;
      return (data as ReportProcessedV2) ?? null;
    },
  });
}
