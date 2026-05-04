import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAccountRFMIntelligence,
  recalculateAccountRFM,
  type RFMQueryParams,
  type RFMIntelligence,
} from '@/services/crm/account-rfm';
import { useToast } from '@/hooks/use-toast';

export function useAccountRFMIntelligence(params: RFMQueryParams | null) {
  return useQuery<RFMIntelligence>({
    queryKey: [
      'account-rfm-intelligence',
      params?.organizationId,
      params?.periodStart,
      params?.periodEnd,
      params?.ownerId ?? null,
      params?.segment ?? null,
      params?.search ?? null,
    ],
    queryFn: () => getAccountRFMIntelligence(params!),
    enabled: !!params?.organizationId && !!params?.periodStart && !!params?.periodEnd,
    staleTime: 60_000,
  });
}

export function useRecalculateAccountRFM() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: recalculateAccountRFM,
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['account-rfm-intelligence'] });
      toast({
        title: 'RFM recalculado',
        description: `${count} conta(s) atualizadas.`,
      });
    },
    onError: (err: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao recalcular RFM',
        description: err.message,
      });
    },
  });
}
