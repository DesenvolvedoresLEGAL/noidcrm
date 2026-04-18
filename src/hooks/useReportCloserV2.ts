import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReportCloserV2 } from '@/types/reportingV2';

interface Args {
  organizationId?: string | null;
  enabled?: boolean;
}

export function useReportCloserV2({ organizationId, enabled = true }: Args) {
  return useQuery({
    queryKey: ['report-closer-v2', organizationId],
    enabled: enabled && !!organizationId,
    staleTime: 60_000,
    queryFn: async (): Promise<ReportCloserV2[]> => {
      const { data, error } = await (supabase as any)
        .from('v_report_closer_v2')
        .select('*')
        .eq('organization_id', organizationId)
        .order('won_revenue', { ascending: false });
      if (error) throw error;
      return (data as ReportCloserV2[]) ?? [];
    },
  });
}
