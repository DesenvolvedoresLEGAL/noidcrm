import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReportLossesV2 } from '@/types/reportingV2';

interface Args {
  organizationId?: string | null;
  enabled?: boolean;
}

export function useReportLossesV2({ organizationId, enabled = true }: Args) {
  return useQuery({
    queryKey: ['report-losses-v2', organizationId],
    enabled: enabled && !!organizationId,
    staleTime: 60_000,
    queryFn: async (): Promise<ReportLossesV2[]> => {
      const { data, error } = await (supabase as any)
        .from('v_report_losses_v2')
        .select('*')
        .eq('organization_id', organizationId)
        .order('lost_count', { ascending: false });
      if (error) throw error;
      return (data as ReportLossesV2[]) ?? [];
    },
  });
}
