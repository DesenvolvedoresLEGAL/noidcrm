import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { revealContact, type RevealDataType, type RevealResult } from '@/services/intelligence/apolloInvisible';
import { supabase } from '@/integrations/supabase/client';

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

// KAI.15.1 HOTFIX — client-side polling for async phone reveal (webhook).
// Terminal states resolve immediately; requested/pending polls up to ~90s
// then falls back to "falha" toast so the loading state never lives forever.
async function pollUntilTerminal(contactId: string, prospectId: string, qc: any, who: string) {
  const maxTries = 15; // ~90s
  for (let i = 0; i < maxTries; i++) {
    await new Promise((r) => setTimeout(r, 6000));
    const { data } = await (supabase as any)
      .from('enriched_contact_profiles')
      .select('phone_reveal_status, phone, phone_source_type')
      .eq('id', contactId)
      .maybeSingle();
    qc.invalidateQueries({ queryKey: ['enriched-contacts', prospectId] });
    const s = data?.phone_reveal_status;
    if (!s || ['revealed', 'not_found', 'rejected_company_phone', 'failed', 'skipped'].includes(s)) {
      if (s === 'revealed') toast.success(`Telefone revelado para ${who}.`);
      else if (s === 'rejected_company_phone' || data?.phone_source_type === 'company_main') {
        toast.warning(`Telefone da empresa rejeitado para ${who} — não foi salvo.`);
      } else if (s === 'not_found') toast.warning(`Apollo não encontrou telefone individual para ${who}.`);
      else if (s === 'failed') toast.error(`Falha ao revelar telefone para ${who}.`);
      return;
    }
  }
  // Give up — rely on server-side cron cleanup (5min). Show soft failure toast.
  toast.error(`Sem retorno do Apollo em 90s para ${who}. Tente novamente em alguns minutos.`);
  qc.invalidateQueries({ queryKey: ['enriched-contacts', prospectId] });
}

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
      } else if ((res as any).status === 'rejected_company_phone' || (res as any).company_phone_rejected) {
        toast.warning(`Telefone da empresa rejeitado para ${who} — não foi salvo.`);
      } else if (res.status === 'pending') {
        toast.info(`Telefone solicitado para ${who}. Buscando entrega do Apollo…`, { duration: 6000 });
        void pollUntilTerminal(vars.contactId, vars.prospectId, qc, who);
      } else if (res.status === 'skipped') {
        toast.info(res.reason ?? 'Dado já revelado anteriormente.');
      } else if (res.status === 'not_found') {
        toast.warning(`Apollo não encontrou ${label} individual para ${who}.`);
      } else if (res.status === 'failed') {
        toast.error(res.reason ?? `Falha ao revelar ${label}.`);
      }
    },
    onError: (err: any, vars) => {
      toast.error(err?.message || 'Erro ao revelar dado');
      qc.invalidateQueries({ queryKey: ['enriched-contacts', vars.prospectId] });
    },
  });
}
