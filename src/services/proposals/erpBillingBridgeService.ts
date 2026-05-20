import { supabase } from '@/integrations/supabase/client';
import { ensureProposalPricingReady } from './proposalPricingGuard';

const c = supabase as any;

const ERP_BLOCK_MESSAGE =
  'Não foi possível enviar ao ERP. Existem valores divergentes na proposta. Recalcule a proposta antes de continuar.';

/**
 * ERP Billing Bridge — mock-ready adapter.
 *
 * PRICE CORE 2.0C: every path that touches the ERP (Pix, sync, complementary,
 * future real-integration payloads) MUST first call
 * `ensureProposalPricingReady` and use `pricing_erp_amount` as the canonical
 * value. The `pricing_breakdown_snapshot` is forwarded as metadata so the ERP
 * can audit the exact split that originated each charge.
 */
export async function createPixChargeFromPaymentIntent(
  paymentIntentId: string,
): Promise<{ ok: boolean; pix_qr_code?: string; pix_copy_paste?: string; message?: string }> {
  const { data: intent, error } = await c
    .from('proposal_payment_intents')
    .select('*')
    .eq('id', paymentIntentId)
    .maybeSingle();
  if (error) throw error;
  if (!intent) return { ok: false, message: 'Cobrança não encontrada' };

  // PRICE CORE 2.0C — block divergence before sending anything to ERP.
  try {
    await ensureProposalPricingReady(intent.proposal_id);
  } catch (e: any) {
    return { ok: false, message: ERP_BLOCK_MESSAGE };
  }

  const { data: proposal } = await c
    .from('proposals')
    .select('pricing_erp_amount, pricing_breakdown_snapshot')
    .eq('id', intent.proposal_id)
    .maybeSingle();
  const erpAmount = Number(proposal?.pricing_erp_amount ?? intent.expected_amount ?? 0);
  const breakdownSnapshot = proposal?.pricing_breakdown_snapshot ?? null;

  // MOCK: gerar payload determinístico até integração real
  const mockCode = `PIX|PROP:${intent.proposal_id}|VAL:${erpAmount}|TS:${Date.now()}`;
  const payload = {
    generated_at: new Date().toISOString(),
    expected_amount: erpAmount,
    proposal_id: intent.proposal_id,
    pricing_breakdown_snapshot: breakdownSnapshot,
    mock: true,
  };

  await c
    .from('proposal_payment_intents')
    .update({
      pix_qr_code: mockCode,
      pix_copy_paste: mockCode,
      payment_gateway_snapshot: payload,
    })
    .eq('id', paymentIntentId);

  await c.from('proposal_payment_events').insert({
    organization_id: intent.organization_id,
    proposal_id: intent.proposal_id,
    payment_intent_id: paymentIntentId,
    event_type: 'pix_generated',
    expected_amount: erpAmount,
    message: 'Pix gerado (mock — aguardando integração financeira)',
    metadata: payload,
  });

  return {
    ok: true,
    pix_qr_code: mockCode,
    pix_copy_paste: mockCode,
    message: 'Cobrança gerada. Aguardando integração financeira.',
  };
}

export async function getChargeStatus(erpChargeId: string): Promise<{ status: string }> {
  return { status: erpChargeId ? 'pending' : 'unknown' };
}

export async function syncPaymentStatus(
  paymentIntentId: string,
): Promise<{ ok: boolean; message: string }> {
  const { data: intent } = await c
    .from('proposal_payment_intents')
    .select('organization_id, proposal_id')
    .eq('id', paymentIntentId)
    .maybeSingle();
  if (!intent) return { ok: false, message: 'Cobrança não encontrada' };

  // PRICE CORE 2.0C — guard before talking to ERP.
  try {
    await ensureProposalPricingReady(intent.proposal_id);
  } catch (e: any) {
    return { ok: false, message: ERP_BLOCK_MESSAGE };
  }

  const { data: proposal } = await c
    .from('proposals')
    .select('pricing_erp_amount, pricing_breakdown_snapshot')
    .eq('id', intent.proposal_id)
    .maybeSingle();

  await c.from('proposal_payment_events').insert({
    organization_id: intent.organization_id,
    proposal_id: intent.proposal_id,
    payment_intent_id: paymentIntentId,
    event_type: 'payment_received',
    message: 'Sincronização ERP solicitada (mock)',
    metadata: {
      mock: true,
      ts: new Date().toISOString(),
      pricing_erp_amount: Number(proposal?.pricing_erp_amount ?? 0),
      pricing_breakdown_snapshot: proposal?.pricing_breakdown_snapshot ?? null,
    },
  });
  return { ok: true, message: 'Sincronização registrada (mock)' };
}

export async function createComplementaryCharge(
  paymentIntentId: string,
): Promise<{ ok: boolean; message?: string }> {
  const { data: intent } = await c
    .from('proposal_payment_intents')
    .select('proposal_id')
    .eq('id', paymentIntentId)
    .maybeSingle();
  if (intent?.proposal_id) {
    try {
      await ensureProposalPricingReady(intent.proposal_id);
    } catch (e: any) {
      return { ok: false, message: ERP_BLOCK_MESSAGE };
    }
  }
  // Reusa a RPC dedicada (já passa pelo guard server-side).
  const { data, error } = await c.rpc('create_complementary_payment_intent', {
    p_original_payment_intent_id: paymentIntentId,
  });
  if (error) throw error;
  return data as any;
}
