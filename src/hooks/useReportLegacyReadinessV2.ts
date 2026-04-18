/**
 * Sprint 2.9 — Hook que lê `v_report_legacy_retirement_readiness_v2` direto.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { ReadinessRow } from '@/hooks/useReportHealthV2';

export function useReportLegacyReadinessV2() {
  const { organization } = useCurrentUser();
  const orgId = organization?.id;

  const query = useQuery({
    queryKey: ['report-legacy-readiness-v2', orgId],
    enabled: Boolean(orgId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_report_legacy_retirement_readiness_v2' as never)
        .select('*')
        .eq('organization_id', orgId!);
      if (error) throw error;
      return (data ?? []) as unknown as ReadinessRow[];
    },
  });

  return {
    data: query.data ?? [],
    error: query.error,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
