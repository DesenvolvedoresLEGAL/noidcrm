import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReportTeamV2 } from '@/types/reportingV2';

interface Args {
  organizationId?: string | null;
  enabled?: boolean;
}

export function useReportTeamV2({ organizationId, enabled = true }: Args) {
  return useQuery({
    queryKey: ['report-team-v2', organizationId],
    enabled: enabled && !!organizationId,
    staleTime: 60_000,
    queryFn: async (): Promise<ReportTeamV2[]> => {
      const { data, error } = await (supabase as any)
        .from('v_report_team_v2')
        .select('*')
        .eq('organization_id', organizationId)
        .order('won_revenue', { ascending: false });
      if (error) throw error;
      return (data as ReportTeamV2[]) ?? [];
    },
  });
}
