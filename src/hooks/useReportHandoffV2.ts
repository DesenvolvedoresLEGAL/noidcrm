import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReportHandoffV2 } from '@/types/reportingV2';

interface Args {
  organizationId?: string | null;
  enabled?: boolean;
}

export function useReportHandoffV2({ organizationId, enabled = true }: Args) {
  return useQuery({
    queryKey: ['report-handoff-v2', organizationId],
    enabled: enabled && !!organizationId,
    staleTime: 60_000,
    queryFn: async (): Promise<ReportHandoffV2[]> => {
      const { data, error } = await (supabase as any)
        .from('v_report_handoff_v2')
        .select('*')
        .eq('organization_id', organizationId)
        .order('total_handoffs', { ascending: false });
      if (error) throw error;
      return (data as ReportHandoffV2[]) ?? [];
    },
  });
}
