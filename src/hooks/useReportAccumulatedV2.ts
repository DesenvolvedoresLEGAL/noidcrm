import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReportAccumulatedV2 } from '@/types/reportingV2';

interface Args {
  organizationId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  enabled?: boolean;
}

export function useReportAccumulatedV2({ organizationId, fromDate, toDate, enabled = true }: Args) {
  return useQuery({
    queryKey: ['report-accumulated-v2', organizationId, fromDate, toDate],
    enabled: enabled && !!organizationId,
    staleTime: 60_000,
    queryFn: async (): Promise<ReportAccumulatedV2[]> => {
      let q = (supabase as any)
        .from('v_report_accumulated_v2')
        .select('*')
        .eq('organization_id', organizationId);
      if (fromDate) q = q.gte('day', fromDate);
      if (toDate) q = q.lte('day', toDate);
      const { data, error } = await q.order('day', { ascending: true });
      if (error) throw error;
      return (data as ReportAccumulatedV2[]) ?? [];
    },
  });
}
