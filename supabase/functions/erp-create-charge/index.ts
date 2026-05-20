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

  // 5) Persistir retorno + log.
  const isPending = result.provider === 'pending_provider' || result.pending_provider === true;

  if (result.ok) {
    // Snapshot financeiro completo gravado em TODO cenário (real e pending_provider).
    const gatewaySnapshot = {
      provider: result.provider,
      pending_provider: isPending,
      erp_charge_id: result.erp_charge_id ?? null,
      erp_invoice_id: result.erp_invoice_id ?? null,
      due_date: result.due_date ?? null,
      status: result.status ?? null,
      amount_sent: amount,                                       // SEMPRE pricing_erp_amount (ou approved_amount)
      pricing_erp_amount: proposal.pricing_erp_amount,
      pricing_breakdown_snapshot: proposal.pricing_breakdown_snapshot,
      approval_snapshot: isApproved ? proposal.approval_snapshot : null,
      raw_request: result.raw_request,
      raw_response: result.raw_response,
      ts: new Date().toISOString(),
    };

    await admin.from('proposal_payment_intents').update({
      // Sem provider configurado: NUNCA escrever pix nem expor cobrança real.
      pix_qr_code: isPending ? null : (result.pix_qr_code ?? null),
      pix_copy_paste: isPending ? null : (result.pix_copy_paste ?? null),
      payment_reference: isPending ? null : (result.erp_charge_id ?? null),
      status: isPending ? 'pending_provider' : 'pending',
      payment_gateway_snapshot: gatewaySnapshot,
    }).eq('id', intentId);

    await admin.from('proposal_payment_events').insert({
      organization_id: proposal.organization_id,
      proposal_id: proposal.id,
      payment_intent_id: intentId,
      event_type: isPending ? 'payment_intent_created' : 'pix_generated',
      expected_amount: amount,
      message: isPending
        ? 'Cobrança registrada. Provider financeiro pendente de configuração.'
        : 'Cobrança gerada no Human ERP',
      metadata: {
        provider: result.provider,
        pending_provider: isPending,
        erp_charge_id: result.erp_charge_id ?? null,
        erp_invoice_id: result.erp_invoice_id ?? null,
        pricing_erp_amount: proposal.pricing_erp_amount,
        approval_snapshot_present: !!isApproved,
      },
    });
  }

  await admin.from('proposal_erp_sync_logs').insert({
    organization_id: proposal.organization_id,
    proposal_id: proposal.id,
    payment_intent_id: intentId,
    provider: result.provider,
    operation: 'create_charge',
    status: result.ok ? (isPending ? 'pending_provider' : 'success') : 'error',
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
    pending_provider: isPending,
    configured: isHumanErpConfigured(),
    payment_intent_id: intentId,
    erp_charge_id: isPending ? null : (result.erp_charge_id ?? null),
    erp_invoice_id: isPending ? null : (result.erp_invoice_id ?? null),
    // Pix NUNCA retornado em pending_provider (nada de mock público).
    pix_qr_code: isPending ? null : (result.pix_qr_code ?? null),
    pix_copy_paste: isPending ? null : (result.pix_copy_paste ?? null),
    due_date: result.due_date ?? null,
    status: isPending ? 'pending_provider' : (result.status ?? 'pending'),
    error_code: result.error_code ?? null,
    error_message: result.error_message ?? null,
    message: isPending
      ? 'Cobrança registrada. Provider financeiro pendente de configuração.'
      : (result.ok ? 'Cobrança gerada no Human ERP' : (result.error_message ?? 'Falha ao gerar cobrança')),
  }, result.ok ? 200 : 502);
});
