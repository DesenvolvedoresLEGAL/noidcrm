import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orchestrateProposalFinancials } from '@/services/proposals/proposalOrchestrator';
import { proposalKeys } from '@/lib/query-keys';
import { invalidateOpportunity } from '@/lib/cache-invalidation';

/**
 * Tries to discover the opportunity_id linked to a proposal by inspecting
 * the React Query cache (proposal detail / lists / details). Used so that
 * after a proposal save we can also refresh the opportunity card/value
 * without forcing the caller to know the opportunity_id.
 */
function findOpportunityIdForProposal(
  qc: ReturnType<typeof useQueryClient>,
  proposalId: string,
): string | null {
  const detail = qc.getQueryData<any>(proposalKeys.detail(proposalId));
  if (detail?.opportunity_id) return detail.opportunity_id as string;

  // Look across any cached proposal lists / details bundles
  const candidates = qc.getQueriesData<any>({ queryKey: proposalKeys.all });
  for (const [, data] of candidates) {
    if (!data) continue;
    const arr = Array.isArray(data) ? data : data?.proposals ?? [];
    const hit = arr.find?.((p: any) => p?.id === proposalId);
    if (hit?.opportunity_id) return hit.opportunity_id as string;
  }

  // proposal-details bundle (used by some screens)
  const detailsBundles = qc.getQueriesData<any>({ queryKey: ['proposal-details'] });
  for (const [, data] of detailsBundles) {
    if (data?.proposal?.id === proposalId && data?.proposal?.opportunity_id) {
      return data.proposal.opportunity_id as string;
    }
  }
  return null;
}

/**
 * Invalida todos os caches relacionados a uma proposta após orquestração.
 * Também invalida a oportunidade vinculada (card kanban, detalhe, valor)
 * para refletir os novos valores de forma instantânea.
 */
export function invalidateProposalCaches(
  qc: ReturnType<typeof useQueryClient>,
  proposalId: string,
  opportunityId?: string | null,
) {
  qc.invalidateQueries({ queryKey: proposalKeys.detail(proposalId), refetchType: 'all' });
  qc.invalidateQueries({ queryKey: proposalKeys.lists(), refetchType: 'all' });
  qc.invalidateQueries({ queryKey: ['proposal-dynamic-pricing', proposalId], refetchType: 'all' });
  qc.invalidateQueries({ queryKey: ['proposal-dynamic-pricing-snapshot', proposalId], refetchType: 'all' });
  qc.invalidateQueries({ queryKey: ['proposal-dynamic-pricing-events', proposalId], refetchType: 'all' });
  qc.invalidateQueries({ queryKey: ['proposal-payment-latest', proposalId], refetchType: 'all' });
  qc.invalidateQueries({ queryKey: ['proposal-payment-intents', proposalId], refetchType: 'all' });
  qc.invalidateQueries({ queryKey: ['proposal-payment-events', proposalId], refetchType: 'all' });
  qc.invalidateQueries({ queryKey: ['proposal-items-preview', proposalId], refetchType: 'all' });
  qc.invalidateQueries({ queryKey: ['proposal-payment-terms-preview', proposalId], refetchType: 'all' });
  qc.invalidateQueries({ queryKey: ['proposal-details'], refetchType: 'all' });

  // Sync the linked opportunity (kanban card value, detail header valor avulso/previsão).
  const oppId = opportunityId ?? findOpportunityIdForProposal(qc, proposalId);
  invalidateOpportunity(qc, oppId);
}

export function useOrchestrateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ proposalId, reason }: { proposalId: string; reason?: string }) =>
      orchestrateProposalFinancials(proposalId, reason),
    onSuccess: (_data, vars) => {
      invalidateProposalCaches(qc, vars.proposalId);
    },
  });
}
