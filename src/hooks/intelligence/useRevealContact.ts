import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
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

const TERMINAL = ['revealed', 'not_found', 'rejected_company_phone', 'phone_only_web', 'failed', 'skipped', 'invalidated'];

/**
 * KAI.18.13 — acompanha o estado REAL do campo no banco.
 * Só emite mensagem final após leitura confirmada; nunca deduz sucesso da resposta HTTP.
 */
async function trackFieldUntilTerminal(
  contactId: string,
  prospectId: string,
  qc: ReturnType<typeof useQueryClient>,
  who: string,
  field: 'phone' | 'email',
) {
  const maxTries = 60; // ~6 min — o telefone Apollo é assíncrono (webhook/polling).
  for (let i = 0; i < maxTries; i++) {
    await new Promise((r) => setTimeout(r, 6000));
    const { data } = await (supabase as any)
      .from('enriched_contact_profiles')
      .select('phone, phone_revealed, phone_reveal_status, phone_source_type, email, email_revealed, email_reveal_status')
      .eq('id', contactId)
      .maybeSingle();
    qc.invalidateQueries({ queryKey: ['enriched-contacts', prospectId] });
    if (!data) continue;

    const status = field === 'phone' ? data.phone_reveal_status : data.email_reveal_status;
    const value = field === 'phone' ? data.phone : data.email;
    const revealed = field === 'phone' ? data.phone_revealed : data.email_revealed;
    if (!status || !TERMINAL.includes(status)) continue;

    if (status === 'revealed' && revealed && value) {
      toast.success(field === 'phone' ? `Telefone salvo para ${who}.` : `E-mail salvo para ${who}.`);
    } else if (status === 'rejected_company_phone' || data.phone_source_type === 'company_main') {
      toast.info(`Apollo só encontrou o telefone da empresa para ${who}. Nenhum crédito confirmado.`);
    } else if (status === 'phone_only_web') {
      toast.warning(`Apollo exibe telefone de ${who} no site, mas não entregou pela API. Nenhum crédito confirmado.`);
    } else if (status === 'not_found') {
      toast.info(field === 'phone'
        ? `Apollo não tem telefone individual de ${who}.`
        : `Apollo não tem e-mail individual de ${who}.`);
    } else {
      toast.error(field === 'phone' ? `Falha ao revelar telefone de ${who}.` : `Falha ao revelar e-mail de ${who}.`);
    }
    return;
  }
  toast.info(`Ainda aguardando o Apollo para ${who}. O status é atualizado automaticamente.`);
  qc.invalidateQueries({ queryKey: ['enriched-contacts', prospectId] });
}

export function useRevealContact() {
  const qc = useQueryClient();
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  return useMutation<RevealResult, Error, Vars>({
    mutationFn: ({ contactId, prospectId, requestedDataType, source }) =>
      revealContact({
        contact_id: contactId,
        prospect_id: prospectId,
        requested_data_type: requestedDataType,
        source: source ?? 'manual',
      }),
    onSuccess: (res, vars) => {
      const who = vars.contactName ?? 'contato';
      qc.invalidateQueries({ queryKey: ['enriched-contacts', vars.prospectId] });

      const phone = res.phone;
      const email = res.email;
      const active = [
        phone && phone.status !== 'not_requested' ? { field: 'phone' as const, r: phone } : null,
        email && email.status !== 'not_requested' ? { field: 'email' as const, r: email } : null,
      ].filter(Boolean) as Array<{ field: 'phone' | 'email'; r: NonNullable<typeof phone> }>;

      if (active.length === 0) {
        toast.info(res.reason ?? 'Nada a revelar para este contato.');
        return;
      }

      const savedLabels: string[] = [];
      for (const { field, r } of active) {
        if (r.status === 'revealed' && r.revealed && r.value) {
          savedLabels.push(field === 'phone' ? 'telefone' : 'e-mail');
        } else if (r.status === 'pending_provider' || r.status === 'requested') {
          toast.info(field === 'phone' ? `Buscando telefone de ${who} no Apollo…` : `Buscando e-mail de ${who} no Apollo…`, { duration: 4000 });
          void trackFieldUntilTerminal(vars.contactId, vars.prospectId, qc, who, field);
        } else if (r.status === 'rejected_company_phone') {
          toast.info(`Apollo só encontrou o telefone da empresa para ${who}. Nenhum crédito confirmado.`);
        } else if (r.status === 'phone_only_web') {
          toast.warning(`Apollo exibe telefone de ${who} no site, mas não entregou pela API. Nenhum crédito confirmado.`);
        } else if (r.status === 'not_found') {
          toast.info(field === 'phone'
            ? `Apollo não tem telefone individual de ${who}.`
            : `Apollo não tem e-mail individual de ${who}.`);
        } else if (r.status === 'skipped') {
          toast.info(field === 'phone' ? `Telefone de ${who} já estava revelado.` : `E-mail de ${who} já estava revelado.`);
        } else if (r.status === 'failed') {
          toast.error(r.reason ?? (field === 'phone' ? `Falha ao revelar telefone de ${who}.` : `Falha ao revelar e-mail de ${who}.`));
        }
      }

      if (savedLabels.length === 2) {
        toast.success(`Telefone e e-mail salvos para ${who}.`);
      } else if (savedLabels.length === 1) {
        toast.success(`${savedLabels[0] === 'telefone' ? 'Telefone' : 'E-mail'} salvo para ${who}.`);
      }
    },
    onError: (err: any, vars) => {
      toast.error(err?.message || 'Erro ao revelar dado');
      qc.invalidateQueries({ queryKey: ['enriched-contacts', vars.prospectId] });
    },
  });
}
