import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReportSummaryV2 } from '@/types/reportingV2';

interface Args {
  organizationId?: string | null;
  enabled?: boolean;
}

export function useReportSummaryV2({ organizationId, enabled = true }: Args) {
  return useQuery({
    queryKey: ['report-summary-v2', organizationId],
    enabled: enabled && !!organizationId,
    staleTime: 60_000,
    queryFn: async (): Promise<ReportSummaryV2 | null> => {
      const { data, error } = await (supabase as any)
        .from('v_report_summary_v2')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (error) throw error;
      return (data as ReportSummaryV2) ?? null;
    },
  });
}
