import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  listFactorRules,
  upsertFactorRule,
  setFactorRuleStatus,
  type PricingFactorRule,
} from '@/services/proposals/proposalDynamicPricing';

const KEY = ['pricing-factor-rules'] as const;

export function usePricingFactorRules() {
  return useQuery({ queryKey: KEY, queryFn: listFactorRules, staleTime: 60_000 });
}

export function useUpsertPricingFactorRule() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (payload: Partial<PricingFactorRule> & { id?: string }) =>
      upsertFactorRule(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: 'Faixa salva' });
    },
    onError: (e: any) =>
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });
}

export function useSetPricingFactorRuleStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'inactive' }) =>
      setFactorRuleStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: 'Status atualizado' });
    },
  });
}
