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
        description:
          count > 0
            ? `${count} conta(s) atualizada(s).`
            : 'Nenhuma conta com receita fechada no período.',
      });
    },
    onError: (err: Error) => {
      console.error('[recalculateAccountRFM] error:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao recalcular RFM',
        description:
          'Não foi possível recalcular o RFM. Verifique se existem vendas fechadas no período ou consulte os logs.',
      });
    },
  });
}
