/**
 * Sprint 2.3 — Hook canônico de cobertura histórica por organização.
 *
 * Lê `v_opportunity_history_coverage_v2` (RLS já filtra por org).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { HistoryCoverageV2 } from '@/types/historyV2';

export function useHistoryCoverageV2() {
  return useQuery({
    queryKey: ['reports-v2', 'history-coverage'],
    staleTime: 60_000,
    queryFn: async (): Promise<HistoryCoverageV2 | null> => {
      const { data, error } = await supabase
        .from('v_opportunity_history_coverage_v2' as never)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return (data as unknown as HistoryCoverageV2) ?? null;
    },
  });
}
