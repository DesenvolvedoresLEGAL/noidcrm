import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { revealContact, type RevealDataType, type RevealResult } from '@/services/intelligence/apolloInvisible';

interface Vars {
  contactId: string;
  prospectId: string;
  requestedDataType: RevealDataType;
  contactName?: string;
  source?: 'manual' | 'autopilot' | 'sdr_agent' | 'apollo_invisible';
}

const LABEL: Record<RevealDataType, string> = {
  profile_only: 'perfil',
  email: 'e-mail',
  phone: 'telefone',
  both: 'e-mail e telefone',
};

export function useRevealContact() {
  const qc = useQueryClient();
  return useMutation<RevealResult, Error, Vars>({
    mutationFn: ({ contactId, prospectId, requestedDataType, source }) =>
      revealContact({
        contact_id: contactId,
        prospect_id: prospectId,
        requested_data_type: requestedDataType,
        source: source ?? 'manual',
      }),
    onSuccess: (res, vars) => {
      const label = LABEL[vars.requestedDataType];
      const who = vars.contactName ?? 'contato';
      qc.invalidateQueries({ queryKey: ['enriched-contacts', vars.prospectId] });
      if (res.status === 'revealed') {
        toast.success(`${label} revelado para ${who} (${res.credits_used ?? 1} crédito).`);
      } else if (res.status === 'pending') {
        toast.info(`Telefone solicitado para ${who}. Chega em ~1 min (entrega assíncrona Apollo).`, { duration: 7000 });
        setTimeout(() => qc.invalidateQueries({ queryKey: ['enriched-contacts', vars.prospectId] }), 30_000);
        setTimeout(() => qc.invalidateQueries({ queryKey: ['enriched-contacts', vars.prospectId] }), 90_000);
      } else if (res.status === 'skipped') {
        toast.info(res.reason ?? 'Dado já revelado anteriormente.');
      } else if (res.status === 'not_found') {
        toast.warning(`Apollo não tem ${label} para ${who}.`);
      } else if (res.status === 'failed') {
        toast.error(res.reason ?? `Falha ao revelar ${label}.`);
      }
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao revelar dado'),
  });
}
