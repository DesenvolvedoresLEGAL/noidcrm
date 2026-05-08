import { supabase } from '@/integrations/supabase/client';

const c = supabase as any;

/**
 * ERP Billing Bridge — mock-ready adapter.
 * Quando o gateway/ERP real estiver disponível, substituir essas funções
 * mantendo a mesma interface.
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

  // MOCK: gerar payload determinístico até integração real
  const mockCode = `PIX|PROP:${intent.proposal_id}|VAL:${intent.expected_amount}|TS:${Date.now()}`;
  const payload = {
    generated_at: new Date().toISOString(),
    expected_amount: intent.expected_amount,
    proposal_id: intent.proposal_id,
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
    expected_amount: intent.expected_amount,
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
  // MOCK: sem integração real, apenas registra tentativa
  const { data: intent } = await c
    .from('proposal_payment_intents')
    .select('organization_id, proposal_id')
    .eq('id', paymentIntentId)
    .maybeSingle();
  if (!intent) return { ok: false, message: 'Cobrança não encontrada' };

  await c.from('proposal_payment_events').insert({
    organization_id: intent.organization_id,
    proposal_id: intent.proposal_id,
    payment_intent_id: paymentIntentId,
    event_type: 'payment_received',
    message: 'Sincronização ERP solicitada (mock)',
    metadata: { mock: true, ts: new Date().toISOString() },
  });
  return { ok: true, message: 'Sincronização registrada (mock)' };
}

export async function createComplementaryCharge(
  paymentIntentId: string,
): Promise<{ ok: boolean; message?: string }> {
  // Reusa a RPC dedicada
  const { data, error } = await c.rpc('create_complementary_payment_intent', {
    p_original_payment_intent_id: paymentIntentId,
  });
  if (error) throw error;
  return data as any;
}
