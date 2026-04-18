import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReportOriginsV2 } from '@/types/reportingV2';

interface Args {
  organizationId?: string | null;
  enabled?: boolean;
}

export function useReportOriginsV2({ organizationId, enabled = true }: Args) {
  return useQuery({
    queryKey: ['report-origins-v2', organizationId],
    enabled: enabled && !!organizationId,
    staleTime: 60_000,
    queryFn: async (): Promise<ReportOriginsV2[]> => {
      const { data, error } = await (supabase as any)
        .from('v_report_origins_v2')
        .select('*')
        .eq('organization_id', organizationId)
        .order('total_count', { ascending: false });
      if (error) throw error;
      return (data as ReportOriginsV2[]) ?? [];
    },
  });
}
