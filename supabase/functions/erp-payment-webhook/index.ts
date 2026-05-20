// PRICE 1.2 — erp-payment-webhook
// Recebe eventos do Human ERP/banco. Verifica HMAC, normaliza payload e dispara
// validate_proposal_payment_amount, que aplica paid_exact / paid_partial / paid_over.
// Público (verify_jwt = false). Autenticidade vem do HMAC (HUMAN_ERP_WEBHOOK_SECRET).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyWebhookSignature } from '../_shared/humanErpClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-erp-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const rawBody = await req.text();
  const signature = req.headers.get('x-erp-signature') ?? req.headers.get('X-Erp-Signature');
  const sigOk = await verifyWebhookSignature(rawBody, signature);
  if (!sigOk) return json({ error: 'invalid_signature' }, 401);

  let event: any;
  try { event = JSON.parse(rawBody); } catch { return json({ error: 'invalid_json' }, 400); }

  // Formato esperado:
  // { event: 'payment.received'|'payment.failed', external_id, charge_id, paid_amount, paid_at, payment_reference }
  const externalId: string | undefined = event.external_id ?? event.metadata?.external_id;
  const chargeId: string | undefined = event.charge_id ?? event.id;
  const paidAmount: number | undefined = event.paid_amount != null ? Number(event.paid_amount) : undefined;
  const paidAt: string | undefined = event.paid_at;
  const paymentReference: string | undefined = event.payment_reference ?? event.transaction_id ?? chargeId;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Resolve payment_intent: prefere external_id; senão tenta por payment_reference/charge_id.
  let intentId: string | null = null;
  if (externalId) intentId = externalId;
  if (!intentId && chargeId) {
    const { data } = await admin.from('proposal_payment_intents')
      .select('id').eq('payment_reference', chargeId).maybeSingle();
    intentId = data?.id ?? null;
  }
  if (!intentId) {
    return json({ ok: false, error: 'payment_intent_not_resolved', event }, 404);
  }

  const { data: intent } = await admin.from('proposal_payment_intents')
    .select('id, organization_id, proposal_id').eq('id', intentId).maybeSingle();
  if (!intent) return json({ ok: false, error: 'payment_intent_not_found' }, 404);

  // Log inbound.
  await admin.from('proposal_erp_sync_logs').insert({
    organization_id: intent.organization_id,
    proposal_id: intent.proposal_id,
    payment_intent_id: intentId,
    provider: 'human_erp',
    operation: 'webhook',
    status: 'success',
    request_payload: event,
  });

  const eventName: string = event.event ?? event.type ?? 'payment.received';
  let validation: any = null;
  if (eventName === 'payment.received' || eventName === 'payment.paid' || eventName === 'payment.partial' || eventName === 'payment.over') {
    if (typeof paidAmount !== 'number' || !(paidAmount > 0)) {
      return json({ ok: false, error: 'invalid_paid_amount' }, 400);
    }
    const { data, error } = await admin.rpc('validate_proposal_payment_amount', {
      p_payment_intent_id: intentId,
      p_paid_amount: paidAmount,
      p_paid_at: paidAt ?? new Date().toISOString(),
      p_payment_reference: paymentReference ?? null,
    });
    if (error) return json({ ok: false, error: 'validate_failed', detail: error.message }, 500);
    validation = data;
  } else if (eventName === 'payment.failed' || eventName === 'payment.cancelled') {
    await admin.from('proposal_payment_events').insert({
      organization_id: intent.organization_id,
      proposal_id: intent.proposal_id,
      payment_intent_id: intentId,
      event_type: 'cancelled',
      message: `ERP reportou ${eventName}`,
      metadata: event,
    });
  }

  return json({ ok: true, intent_id: intentId, event: eventName, validation });
});
