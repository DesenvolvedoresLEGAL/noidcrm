// PERF 0.6D — Hook secundário para JSONBs pesados do score financeiro/ERP
// (`scoring_factors`, `score_fatores`). Carregado sob demanda nas abas que
// precisam dos detalhes expandidos. O hook principal `useAccountDetails`
// não devolve mais esses campos para reduzir o payload por carregamento.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AccountFinancialDetails {
  scoring_factors: Record<string, unknown> | null;
  score_fatores: Record<string, unknown> | null;
}

export function useAccountFinancialDetails(accountId: string | undefined, enabled = true) {
  return useQuery<AccountFinancialDetails | null>({
    queryKey: ['account-financial-details', accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const { data, error } = await supabase
        .from('accounts')
        .select('scoring_factors, score_fatores')
        .eq('id', accountId)
        .maybeSingle();
      if (error) throw error;
      return {
        scoring_factors: (data?.scoring_factors as Record<string, unknown> | null) ?? null,
        score_fatores: (data?.score_fatores as Record<string, unknown> | null) ?? null,
      };
    },
    enabled: !!accountId && enabled,
    staleTime: 60_000,
  });
}
