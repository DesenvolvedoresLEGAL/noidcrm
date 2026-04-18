import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReportSDRV2 } from '@/types/reportingV2';

interface Args {
  organizationId?: string | null;
  enabled?: boolean;
}

export function useReportSDRV2({ organizationId, enabled = true }: Args) {
  return useQuery({
    queryKey: ['report-sdr-v2', organizationId],
    enabled: enabled && !!organizationId,
    staleTime: 60_000,
    queryFn: async (): Promise<ReportSDRV2[]> => {
      const { data, error } = await (supabase as any)
        .from('v_report_sdr_v2')
        .select('*')
        .eq('organization_id', organizationId)
        .order('sqls_generated', { ascending: false });
      if (error) throw error;
      return (data as ReportSDRV2[]) ?? [];
    },
  });
}
