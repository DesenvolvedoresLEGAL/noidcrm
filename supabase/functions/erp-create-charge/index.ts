// PRICE 1.2 — erp-create-charge
// Gera cobrança real no ERP/banco a partir de um payment_intent existente.
// Regras:
//  - ensure_proposal_pricing_ready DEVE passar (bloqueia divergência).
//  - Payload usa SEMPRE pricing_erp_amount (ou approved_amount se aprovada).
//  - Inclui pricing_breakdown_snapshot e approval_snapshot.
//  - Persiste retorno do ERP no payment_intent.
//  - Loga tudo em proposal_erp_sync_logs.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createErpCharge, isHumanErpConfigured } from '../_shared/humanErpClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

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

  // 1) Carrega intent + valida escopo organizacional via RLS do user client.
  const { data: intent, error: intentErr } = await userClient
    .from('proposal_payment_intents').select('*').eq('id', intentId).maybeSingle();
  if (intentErr) return json({ error: 'intent_lookup_failed', detail: intentErr.message }, 500);
  if (!intent) return json({ error: 'payment_intent_not_found' }, 404);

  // 2) Guard de pricing (recalcula ledger e bloqueia divergência).
  const { data: guard, error: guardErr } = await admin.rpc('ensure_proposal_pricing_ready', {
    p_proposal_id: intent.proposal_id,
  });
  if (guardErr) return json({ error: 'pricing_guard_failed', detail: guardErr.message }, 500);
  if (guard && (guard as any).blocked) {
    await admin.from('proposal_erp_sync_logs').insert({
      organization_id: intent.organization_id,
      proposal_id: intent.proposal_id,
      payment_intent_id: intentId,
      operation: 'create_charge',
      status: 'blocked',
      response_payload: guard as any,
      error_code: 'ledger_divergence',
      error_message: (guard as any).reason ?? 'Divergência no ledger',
    });
    return json({ ok: false, blocked: true, reason: (guard as any).reason, guard }, 409);
  }

  // 3) Carrega proposta (valor canônico + snapshots).
  const { data: proposal } = await admin.from('proposals').select(
    'id, status, organization_id, approved_amount, pricing_erp_amount, pricing_breakdown_snapshot, approval_snapshot, account_id, client_name, client_email, client_phone, client_document'
  ).eq('id', intent.proposal_id).maybeSingle();

  if (!proposal) return json({ error: 'proposal_not_found' }, 404);

  const isApproved = proposal.status === 'accepted' && proposal.approved_amount != null;
  const amount = Number(isApproved ? proposal.approved_amount : (proposal.pricing_erp_amount ?? intent.expected_amount ?? 0));
  if (!(amount > 0)) {
    await admin.from('proposal_erp_sync_logs').insert({
      organization_id: intent.organization_id,
      proposal_id: intent.proposal_id,
      payment_intent_id: intentId,
      operation: 'create_charge',
      status: 'blocked',
      error_code: 'zero_amount',
      error_message: 'pricing_erp_amount/approved_amount está zero',
    });
    return json({ ok: false, blocked: true, reason: 'zero_amount' }, 409);
  }

  // 4) Chama o adapter (real Human ERP ou mock fallback).
  const result = await createErpCharge({
    proposal_id: proposal.id,
    payment_intent_id: intentId,
    organization_id: proposal.organization_id,
    amount,
    currency: intent.currency,
    payment_method: intent.payment_method,
    due_date: intent.expires_at ?? null,
    pricing_breakdown_snapshot: proposal.pricing_breakdown_snapshot,
    approval_snapshot: isApproved ? proposal.approval_snapshot : null,
    customer: {
      name: proposal.client_name,
      email: proposal.client_email,
      phone: proposal.client_phone,
      document: proposal.client_document,
    },
    metadata: { is_approved: isApproved },
  });

  // 5) Persiste retorno + log.
  if (result.ok) {
    await admin.from('proposal_payment_intents').update({
      erp_charge_id: null, // mantemos o uuid local; gravamos o id externo em payment_reference/snapshot
      pix_qr_code: result.pix_qr_code ?? null,
      pix_copy_paste: result.pix_copy_paste ?? null,
      payment_reference: result.erp_charge_id ?? null,
      payment_gateway_snapshot: {
        provider: result.provider,
        erp_charge_id: result.erp_charge_id,
        erp_invoice_id: result.erp_invoice_id,
        due_date: result.due_date,
        status: result.status,
        amount_sent: amount,
        pricing_breakdown_snapshot: proposal.pricing_breakdown_snapshot,
        approval_snapshot: isApproved ? proposal.approval_snapshot : null,
        raw_response: result.raw_response,
        ts: new Date().toISOString(),
      },
    }).eq('id', intentId);

    await admin.from('proposal_payment_events').insert({
      organization_id: proposal.organization_id,
      proposal_id: proposal.id,
      payment_intent_id: intentId,
      event_type: 'pix_generated',
      expected_amount: amount,
      message: result.provider === 'mock'
        ? 'Cobrança gerada (mock — Human ERP não configurado)'
        : 'Cobrança gerada no Human ERP',
      metadata: {
        provider: result.provider,
        erp_charge_id: result.erp_charge_id,
        erp_invoice_id: result.erp_invoice_id,
      },
    });
  }

  await admin.from('proposal_erp_sync_logs').insert({
    organization_id: proposal.organization_id,
    proposal_id: proposal.id,
    payment_intent_id: intentId,
    provider: result.provider,
    operation: 'create_charge',
    status: result.ok ? (result.provider === 'mock' ? 'mock' : 'success') : 'error',
    request_payload: (result.raw_request as any) ?? {},
    response_payload: (result.raw_response as any) ?? {},
    http_status: result.http_status ?? null,
    error_code: result.error_code ?? null,
    error_message: result.error_message ?? null,
    latency_ms: result.latency_ms ?? null,
  });

  return json({
    ok: result.ok,
    provider: result.provider,
    configured: isHumanErpConfigured(),
    payment_intent_id: intentId,
    erp_charge_id: result.erp_charge_id,
    erp_invoice_id: result.erp_invoice_id,
    pix_qr_code: result.pix_qr_code,
    pix_copy_paste: result.pix_copy_paste,
    due_date: result.due_date,
    status: result.status,
    error_code: result.error_code,
    error_message: result.error_message,
  }, result.ok ? 200 : 502);
});
