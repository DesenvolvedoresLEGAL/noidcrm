import { supabase } from '@/integrations/supabase/client';
import { ensureProposalPricingReady } from './proposalPricingGuard';

const c = supabase as any;

const ERP_BLOCK_MESSAGE =
  'Não foi possível enviar ao ERP. Existem valores divergentes na proposta. Recalcule a proposta antes de continuar.';

/**
 * ERP Billing Bridge — PRICE 1.2
 *
 * Toda saída para o ERP passa por:
 *  1) `ensureProposalPricingReady` (bloqueia divergência);
 *  2) edge function `erp-create-charge` / `erp-sync-charge-status`, que usam
 *     SEMPRE `pricing_erp_amount` (ou `approved_amount` se aprovada) e enviam
 *     `pricing_breakdown_snapshot` + `approval_snapshot`. Cálculo local proibido.
 *
 * Enquanto `HUMAN_ERP_*` não está configurado, o adapter cai em mock determinístico
 * dentro da edge function (não há mock no cliente).
 */
export async function createPixChargeFromPaymentIntent(
  paymentIntentId: string,
): Promise<{ ok: boolean; pix_qr_code?: string; pix_copy_paste?: string; message?: string; provider?: string }> {
  try {
    await ensureProposalPricingReady(await getProposalIdFromIntent(paymentIntentId));
  } catch {
    return { ok: false, message: ERP_BLOCK_MESSAGE };
  }

  const { data, error } = await supabase.functions.invoke('erp-create-charge', {
    body: { payment_intent_id: paymentIntentId },
  });
  if (error) return { ok: false, message: error.message ?? ERP_BLOCK_MESSAGE };
  if (!data?.ok) {
    return {
      ok: false,
      message: data?.blocked ? ERP_BLOCK_MESSAGE : (data?.error_message ?? 'Falha ao gerar cobrança no ERP.'),
    };
  }
  return {
    ok: true,
    provider: data.provider,
    pix_qr_code: data.pending_provider ? undefined : data.pix_qr_code,
    pix_copy_paste: data.pending_provider ? undefined : data.pix_copy_paste,
    message: data.message
      ?? (data.pending_provider
        ? 'Cobrança registrada. Provider financeiro pendente de configuração.'
        : 'Cobrança gerada no Human ERP.'),
  };
}

export async function syncPaymentStatus(
  paymentIntentId: string,
): Promise<{ ok: boolean; message: string; validation?: unknown }> {
  try {
    await ensureProposalPricingReady(await getProposalIdFromIntent(paymentIntentId));
  } catch {
    return { ok: false, message: ERP_BLOCK_MESSAGE };
  }
  const { data, error } = await supabase.functions.invoke('erp-sync-charge-status', {
    body: { payment_intent_id: paymentIntentId },
  });
  if (error) return { ok: false, message: error.message ?? 'Falha ao sincronizar com ERP.' };
  return {
    ok: !!data?.ok,
    message: data?.ok
      ? (data.validation ? 'Pagamento processado.' : 'Sincronização registrada.')
      : (data?.reason ?? 'Falha ao sincronizar com ERP.'),
    validation: data?.validation,
  };
}

export async function createComplementaryCharge(
  paymentIntentId: string,
): Promise<{ ok: boolean; message?: string; payment_intent_id?: string }> {
  const proposalId = await getProposalIdFromIntent(paymentIntentId);
  if (proposalId) {
    try {
      await ensureProposalPricingReady(proposalId);
    } catch {
      return { ok: false, message: ERP_BLOCK_MESSAGE };
    }
  }
  // RPC dedicada já passa pelo guard server-side.
  const { data, error } = await c.rpc('create_complementary_payment_intent', {
    p_original_payment_intent_id: paymentIntentId,
  });
  if (error) throw error;
  return data as any;
}

export async function getChargeStatus(erpChargeId: string): Promise<{ status: string }> {
  return { status: erpChargeId ? 'pending' : 'unknown' };
}

async function getProposalIdFromIntent(paymentIntentId: string): Promise<string> {
  const { data } = await c
    .from('proposal_payment_intents')
    .select('proposal_id')
    .eq('id', paymentIntentId)
    .maybeSingle();
  return data?.proposal_id;
}
