import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  resolveApprovedCommercialAmount,
  type ResolveApprovedAmountResult,
} from '@/lib/proposals/resolveApprovedCommercialAmount';

/**
 * Resolve o valor comercial aprovado canônico de uma oportunidade.
 * Quando a oportunidade tem `accepted_proposal_id`, busca a proposta aprovada
 * e retorna `approved_amount` (ou fallbacks). Caso contrário, devolve apenas
 * o valor_previsto como legado.
 */
export function useApprovedCommercialAmount(opportunity?: {
  id?: string;
  accepted_proposal_id?: string | null;
  valor_previsto?: number | null;
} | null) {
  const proposalId = opportunity?.accepted_proposal_id ?? null;

  const { data: proposal } = useQuery({
    queryKey: ['approved-proposal-resolver', proposalId],
    enabled: !!proposalId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select(
          'id, approved_amount, approved_payment_schedule, approval_snapshot, total_amount, currency',
        )
        .eq('id', proposalId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const resolved: ResolveApprovedAmountResult = resolveApprovedCommercialAmount({
    opportunity: opportunity ?? null,
    proposal: proposal ?? null,
  });

  return {
    ...resolved,
    proposal,
    isInherited: !!proposalId,
  };
}
