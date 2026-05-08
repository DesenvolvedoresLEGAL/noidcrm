import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  applyDynamicPrice,
  calculateDynamicPrice,
  disableDynamicPricing,
  generateEventAntecedencePricing,
  getDynamicPricing,
  listDynamicPricingEvents,
  saveDynamicPricingRule,
} from '@/services/proposals/proposalDynamicPricing';
import type { DynamicPricingRuleInput } from '@/lib/proposals/dynamicPricing';

const KEY = (id: string) => ['proposal-dynamic-pricing', id] as const;
const EVENTS_KEY = (id: string) => ['proposal-dynamic-pricing-events', id] as const;
const SNAPSHOT_KEY = (id: string) => ['proposal-dynamic-pricing-snapshot', id] as const;

export function useProposalDynamicPricing(proposalId: string | null | undefined) {
  return useQuery({
    queryKey: KEY(proposalId ?? ''),
    queryFn: () => getDynamicPricing(proposalId!),
    enabled: !!proposalId,
    staleTime: 30_000,
  });
}

export function useProposalDynamicPricingSnapshot(
  proposalId: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: SNAPSHOT_KEY(proposalId ?? ''),
    queryFn: () => calculateDynamicPrice(proposalId!),
    enabled: !!proposalId && enabled,
    staleTime: 15_000,
  });
}

export function useProposalDynamicPricingEvents(proposalId: string | null | undefined) {
  return useQuery({
    queryKey: EVENTS_KEY(proposalId ?? ''),
    queryFn: () => listDynamicPricingEvents(proposalId!),
    enabled: !!proposalId,
    staleTime: 30_000,
  });
}

export function useSaveProposalDynamicPricingRule(proposalId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (payload: DynamicPricingRuleInput) =>
      saveDynamicPricingRule(proposalId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(proposalId) });
      qc.invalidateQueries({ queryKey: SNAPSHOT_KEY(proposalId) });
      qc.invalidateQueries({ queryKey: EVENTS_KEY(proposalId) });
      qc.invalidateQueries({ queryKey: ['proposal', proposalId] });
      toast({ title: 'Tabela dinâmica salva' });
    },
    onError: (e: any) =>
      toast({
        title: 'Erro ao salvar',
        description: e?.message,
        variant: 'destructive',
      }),
  });
}

export function useCalculateProposalDynamicPrice(proposalId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: () => calculateDynamicPrice(proposalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(proposalId) });
      qc.invalidateQueries({ queryKey: SNAPSHOT_KEY(proposalId) });
      qc.invalidateQueries({ queryKey: EVENTS_KEY(proposalId) });
      toast({ title: 'Recálculo concluído' });
    },
    onError: (e: any) =>
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });
}

export function useApplyProposalDynamicPrice(proposalId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: () => applyDynamicPrice(proposalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(proposalId) });
      qc.invalidateQueries({ queryKey: SNAPSHOT_KEY(proposalId) });
      qc.invalidateQueries({ queryKey: EVENTS_KEY(proposalId) });
      qc.invalidateQueries({ queryKey: ['proposal', proposalId] });
      toast({ title: 'Valor vigente aplicado à proposta' });
    },
    onError: (e: any) =>
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });
}

export function useDisableProposalDynamicPricing(proposalId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: () => disableDynamicPricing(proposalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(proposalId) });
      qc.invalidateQueries({ queryKey: SNAPSHOT_KEY(proposalId) });
      qc.invalidateQueries({ queryKey: EVENTS_KEY(proposalId) });
      qc.invalidateQueries({ queryKey: ['proposal', proposalId] });
      toast({ title: 'Tabela dinâmica desativada' });
    },
  });
}

export function useGenerateEventAntecedencePricing(proposalId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (force?: boolean) =>
      generateEventAntecedencePricing(proposalId, !!force),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(proposalId) });
      qc.invalidateQueries({ queryKey: SNAPSHOT_KEY(proposalId) });
      qc.invalidateQueries({ queryKey: EVENTS_KEY(proposalId) });
      qc.invalidateQueries({ queryKey: ['proposal', proposalId] });
      toast({ title: 'Tabela dinâmica gerada por antecedência do evento' });
    },
    onError: (e: any) =>
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });
}
