import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  type InventoryPricingFactorPayload,
} from '@/lib/operations/inventoryPricing';
import {
  activatePricingRule,
  calculatePricingFactor,
  createPricingRule,
  deactivatePricingRule,
  getPricingPressure,
  listPricingRules,
  updatePricingRule,
  type InventoryPricingRule,
} from '@/services/operations/inventoryPricing';

const RULES_KEY = ['inventory', 'pricing', 'rules'] as const;
const PRESSURE_KEY = (days: number) =>
  ['inventory', 'pricing', 'pressure', days] as const;

export function useInventoryPricingRules() {
  return useQuery({
    queryKey: RULES_KEY,
    queryFn: listPricingRules,
    staleTime: 60_000,
  });
}

export function useCreateInventoryPricingRule() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: createPricingRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RULES_KEY });
      toast({ title: 'Regra criada' });
    },
    onError: (e: any) =>
      toast({
        title: 'Não foi possível criar',
        description: e?.message,
        variant: 'destructive',
      }),
  });
}

export function useUpdateInventoryPricingRule() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<InventoryPricingRule> }) =>
      updatePricingRule(id, patch as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RULES_KEY });
      toast({ title: 'Regra atualizada' });
    },
    onError: (e: any) =>
      toast({
        title: 'Não foi possível atualizar',
        description: e?.message,
        variant: 'destructive',
      }),
  });
}

export function useDeactivateInventoryPricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deactivatePricingRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: RULES_KEY }),
  });
}

export function useActivateInventoryPricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: activatePricingRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: RULES_KEY }),
  });
}

export function useInventoryPricingFactor(
  payload: Partial<InventoryPricingFactorPayload>,
  opts?: { enabled?: boolean },
) {
  const enabled =
    (opts?.enabled ?? true) &&
    !!payload.start_date &&
    !!payload.end_date &&
    typeof payload.requested_quantity === 'number' &&
    payload.requested_quantity > 0;

  return useQuery({
    queryKey: ['inventory', 'pricing', 'factor', payload],
    queryFn: () =>
      calculatePricingFactor(payload as InventoryPricingFactorPayload),
    enabled,
    staleTime: 30_000,
  });
}

export function useInventoryPricingPressure(windowDays = 30) {
  return useQuery({
    queryKey: PRESSURE_KEY(windowDays),
    queryFn: () => getPricingPressure(windowDays),
    staleTime: 60_000,
  });
}
