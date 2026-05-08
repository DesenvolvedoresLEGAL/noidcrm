import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orchestrateProposalFinancials } from '@/services/proposals/proposalOrchestrator';
import { proposalKeys } from '@/lib/query-keys';

/**
 * Invalida todos os caches relacionados a uma proposta após orquestração.
 */
export function invalidateProposalCaches(qc: ReturnType<typeof useQueryClient>, proposalId: string) {
  qc.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) });
  qc.invalidateQueries({ queryKey: proposalKeys.lists() });
  qc.invalidateQueries({ queryKey: ['proposal-dynamic-pricing', proposalId] });
  qc.invalidateQueries({ queryKey: ['proposal-dynamic-pricing-snapshot', proposalId] });
  qc.invalidateQueries({ queryKey: ['proposal-dynamic-pricing-events', proposalId] });
  qc.invalidateQueries({ queryKey: ['proposal-payment-latest', proposalId] });
  qc.invalidateQueries({ queryKey: ['proposal-payment-intents', proposalId] });
  qc.invalidateQueries({ queryKey: ['proposal-payment-events', proposalId] });
  qc.invalidateQueries({ queryKey: ['proposal-items-preview', proposalId] });
  qc.invalidateQueries({ queryKey: ['proposal-payment-terms-preview', proposalId] });
  qc.invalidateQueries({ queryKey: ['proposal-details'] });
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
