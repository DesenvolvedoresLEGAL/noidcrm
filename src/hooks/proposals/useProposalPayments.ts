import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  createComplementaryIntent,
  createPaymentIntent,
  getLatestPaymentIntent,
  listPaymentEvents,
  listPaymentIntents,
  validateManualPayment,
} from '@/services/proposals/proposalPaymentsService';
import {
  createPixChargeFromPaymentIntent,
  syncPaymentStatus,
} from '@/services/proposals/erpBillingBridgeService';
import type { PaymentIntentSource } from '@/lib/proposals/proposalPayments';

const INTENTS_KEY = (id: string) => ['proposal-payment-intents', id] as const;
const LATEST_KEY = (id: string) => ['proposal-payment-latest', id] as const;
const EVENTS_KEY = (id: string) => ['proposal-payment-events', id] as const;

export function useProposalPaymentIntents(proposalId?: string | null) {
  return useQuery({
    queryKey: INTENTS_KEY(proposalId ?? ''),
    queryFn: () => listPaymentIntents(proposalId!),
    enabled: !!proposalId,
    staleTime: 15_000,
  });
}

export function useLatestPaymentIntent(proposalId?: string | null) {
  return useQuery({
    queryKey: LATEST_KEY(proposalId ?? ''),
    queryFn: () => getLatestPaymentIntent(proposalId!),
    enabled: !!proposalId,
    staleTime: 15_000,
  });
}

export function useProposalPaymentEvents(proposalId?: string | null) {
  return useQuery({
    queryKey: EVENTS_KEY(proposalId ?? ''),
    queryFn: () => listPaymentEvents(proposalId!),
    enabled: !!proposalId,
    staleTime: 15_000,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>, proposalId: string) {
  qc.invalidateQueries({ queryKey: INTENTS_KEY(proposalId) });
  qc.invalidateQueries({ queryKey: LATEST_KEY(proposalId) });
  qc.invalidateQueries({ queryKey: EVENTS_KEY(proposalId) });
  qc.invalidateQueries({ queryKey: ['proposal', proposalId] });
  qc.invalidateQueries({ queryKey: ['proposal-dynamic-pricing', proposalId] });
}

export function useCreatePaymentIntent(proposalId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (source: PaymentIntentSource = 'crm_manual') =>
      createPaymentIntent(proposalId, source),
    onSuccess: (res) => {
      invalidateAll(qc, proposalId);
      if (res?.ok) {
        toast({ title: 'Cobrança gerada pelo valor vigente' });
      } else {
        toast({
          title: 'Cobrança bloqueada',
          description: res?.message,
          variant: 'destructive',
        });
      }
    },
    onError: (e: any) =>
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });
}

export function useGeneratePixCharge(proposalId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (intentId: string) => createPixChargeFromPaymentIntent(intentId),
    onSuccess: (res) => {
      invalidateAll(qc, proposalId);
      toast({ title: res?.message ?? 'Pix gerado' });
    },
    onError: (e: any) =>
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });
}

export function useValidateManualPayment(proposalId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (params: {
      paymentIntentId: string;
      paidAmount: number;
      paidAt: string;
      paymentReference?: string | null;
    }) =>
      validateManualPayment(
        params.paymentIntentId,
        params.paidAmount,
        params.paidAt,
        params.paymentReference,
      ),
    onSuccess: (res) => {
      invalidateAll(qc, proposalId);
      const map: Record<string, string> = {
        paid_exact: 'Pagamento corresponde ao valor vigente',
        paid_partial: `Pagamento parcial. Diferença pendente`,
        paid_over: 'Pagamento maior que o valor vigente',
      };
      toast({ title: map[res.status] ?? 'Pagamento validado' });
    },
    onError: (e: any) =>
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });
}

export function useCreateComplementaryIntent(proposalId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (originalIntentId: string) => createComplementaryIntent(originalIntentId),
    onSuccess: (res) => {
      invalidateAll(qc, proposalId);
      toast({
        title: res?.ok ? 'Cobrança complementar criada' : (res?.message ?? 'Sem ação'),
        variant: res?.ok ? 'default' : 'destructive',
      });
    },
    onError: (e: any) =>
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });
}

export function useSyncErpStatus(proposalId: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (intentId: string) => syncPaymentStatus(intentId),
    onSuccess: (res) => {
      invalidateAll(qc, proposalId);
      toast({ title: res?.message ?? 'Sincronizado' });
    },
  });
}
