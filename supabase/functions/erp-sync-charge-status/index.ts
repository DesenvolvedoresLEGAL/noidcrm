// PRICE 1.2 — erp-sync-charge-status
// Consulta status atual da cobrança no Human ERP e, se já paga, dispara
// validate_proposal_payment_amount (que aplica regra paid_exact / paid_partial / paid_over).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getErpChargeStatus, isHumanErpConfigured } from '../_shared/humanErpClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const userJwt = req.headers.get('Authorization') ?? '';
  const admin = createClient(supabaseUrl, serviceKey);
  const userClient = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: userJwt } },
  });

  let payload: { payment_intent_id?: string };
  try { payload = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const intentId = payload?.payment_intent_id;
  if (!intentId) return json({ error: 'payment_intent_id is required' }, 400);

  const { data: intent } = await userClient
    .from('proposal_payment_intents').select('*').eq('id', intentId).maybeSingle();
  if (!intent) return json({ error: 'payment_intent_not_found' }, 404);

  // Guard antes de consultar ERP.
  const { data: guard } = await admin.rpc('ensure_proposal_pricing_ready', {
    p_proposal_id: intent.proposal_id,
  });
  if (guard && (guard as any).blocked) {
    return json({ ok: false, blocked: true, reason: (guard as any).reason }, 409);
  }

  const erpChargeId = (intent as any).payment_reference
    ?? (intent.payment_gateway_snapshot as any)?.erp_charge_id;
  if (!erpChargeId) {
    return json({ ok: false, reason: 'no_erp_charge_id' }, 409);
  }

  const result = await getErpChargeStatus(erpChargeId);

  const isPending = result.provider === 'pending_provider' || result.pending_provider === true;

  await admin.from('proposal_erp_sync_logs').insert({
    organization_id: intent.organization_id,
    proposal_id: intent.proposal_id,
    payment_intent_id: intentId,
    provider: result.provider,
    operation: 'sync_status',
    status: result.ok ? (isPending ? 'pending_provider' : 'success') : 'error',
    response_payload: (result.raw_response as any) ?? {},
    http_status: result.http_status ?? null,
    error_code: result.error_code ?? null,
    error_message: result.error_message ?? null,
    latency_ms: result.latency_ms ?? null,
  });

  // Aplica validação SOMENTE quando o ERP real reporta pagamento. NUNCA simula baixa em pending_provider.
  let validation: any = null;
  if (
    !isPending &&
    result.ok &&
    typeof result.paid_amount === 'number' &&
    result.paid_amount > 0 &&
    (result.status === 'paid' || result.status === 'received' || result.status === 'paid_partial' || result.status === 'paid_over')
  ) {
    const { data, error } = await admin.rpc('validate_proposal_payment_amount', {
      p_payment_intent_id: intentId,
      p_paid_amount: result.paid_amount,
      p_paid_at: result.paid_at ?? new Date().toISOString(),
      p_payment_reference: result.payment_reference ?? erpChargeId,
    });
    if (!error) validation = data;
  }

  return json({
    ok: result.ok,
    configured: isHumanErpConfigured(),
    provider: result.provider,
    pending_provider: isPending,
    erp_status: isPending ? 'pending_provider' : result.status,
    paid_amount: isPending ? null : result.paid_amount,
    validation,
    message: isPending
      ? 'Sincronização indisponível. Provider financeiro pendente de configuração.'
      : undefined,
  }, result.ok ? 200 : 502);
});
