// kairos-apollo-reveal-status-sync (KAI.18.15)
// Polling OFICIAL do resultado assíncrono do Apollo:
//   GET https://api.apollo.io/api/v1/webhook_result/{request_id}  → 0 créditos.
// NUNCA repete chamada paga (people/match). Só o webhook ou o webhook_result
// podem produzir estado terminal de telefone.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import {
  AWAITING_WEBHOOK_REASON,
  computePhoneQuality,
  extractProviderCredits,
  finalizeField,
  isAwaitingWebhook,
  isValidApolloAsyncRequestId,
} from "../_shared/apollo-reveal-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const MAX_ATTEMPTS = 12;
const WEBHOOK_RESULT_URL = "https://api.apollo.io/api/v1/webhook_result";

function nextRetryIso(seconds: number) {
  return new Date(Date.now() + Math.max(30, Math.min(seconds, 900)) * 1000).toISOString();
}

async function keepPending(sb: any, jobId: string, retryAfterSeconds: number, note: string, attempt: number) {
  await sb.from("enrichment_jobs").update({
    status: "pending_provider",
    reconciliation_required: false,
    next_retry_at: nextRetryIso(retryAfterSeconds),
    skip_reason: note,
    locked_at: null,
    locked_by: null,
    completed_at: null,
  }).eq("id", jobId);
  return { outcome: "still_pending", note, attempt };
}

/**
 * KAI.18.16 — recuperação SEM crédito: reprocessa payloads já pagos (job.response
 * e apollo_reveal_audit.raw_response) com o classificador compartilhado.
 * Só conclui `revealed`; nunca conclui not_found por aqui.
 */
async function recoverFromStoredPayload(sb: any, job: any, contact: any): Promise<{ revealed: boolean } | null> {
  try {
    const payloads: any[] = [];
    if (job?.response && typeof job.response === "object") payloads.push(job.response);
    const { data: audits } = await sb
      .from("apollo_reveal_audit")
      .select("id, raw_response")
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: false })
      .limit(5);
    for (const a of audits ?? []) if (a?.raw_response) payloads.push(a.raw_response);
    if (payloads.length === 0) return null;

    const extraCompanyPhones: string[] = [];
    if (contact.prospect_id) {
      const { data: comp } = await sb.from("enriched_company_profiles").select("phone")
        .eq("prospect_id", contact.prospect_id).maybeSingle();
      if (comp?.phone) extraCompanyPhones.push(String(comp.phone));
    }

    const qual = computePhoneQuality(payloads[0], extraCompanyPhones, "apollo", {
      extraPayloads: payloads.slice(1),
    });
    if (!qual.phone) return null;

    const out = await finalizeField(sb, {
      contact_id: contact.id,
      field: "phone",
      outcome: "revealed",
      job_id: job.id,
      value: qual.phone,
      metadata: {
        phone_source: "apollo",
        phone_type: qual.phone_type,
        phone_match_quality: qual.phone_match_quality,
        phone_confidence: qual.phone_confidence,
        phone_source_type: qual.phone_match_quality,
        phone_quality_reason: "recovered_from_existing_payload",
        phone_validation_status: qual.phone_validation_status,
        is_whatsapp_ready: !!qual.is_whatsapp_ready,
        phone_candidates_audit: qual.audit,
      },
      credits_used: null,
      credits_confirmed: null,
      reason: "recovered_from_existing_payload",
    });
    return { revealed: out.status === "revealed" };
  } catch (e) {
    console.warn("recoverFromStoredPayload failed", String(e));
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const internalSecret = req.headers.get("x-internal-secret");
  const accepted = [
    Deno.env.get("INTERNAL_WORKFLOW_SECRET"),
    Deno.env.get("CRON_INTERNAL_SECRET"),
  ].filter((v): v is string => !!v && v.length > 0);
  if (accepted.length === 0 || !internalSecret || !accepted.includes(internalSecret)) {
    console.error("reveal-status-sync unauthorized", {
      has_secret_header: !!internalSecret,
      configured_secrets: accepted.length,
    });
    return json(401, { error: "Unauthorized", reason: "invalid_internal_secret" });
  }

  try {
    const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: jobs, error } = await sb.rpc("fn_claim_apollo_reveal_jobs", {
      p_limit: 20,
      p_worker: "reveal-status-sync",
    });
    if (error) {
      console.error("claim jobs failed", error.message);
      return json(500, { error: "claim_failed" });
    }

    const results: Array<Record<string, unknown>> = [];

    for (const job of (jobs ?? []) as any[]) {
      const field = (job.field ?? "phone") as "phone" | "email";
      const contactId = job.contact_id as string | null;
      const attempt = job.attempt_count ?? 0;

      if (!contactId) {
        await sb.from("enrichment_jobs").update({
          status: "failed", error: "missing_contact_id", reconciliation_required: false,
          completed_at: new Date().toISOString(), locked_at: null, locked_by: null,
        }).eq("id", job.id);
        results.push({ job_id: job.id, outcome: "failed_no_contact" });
        continue;
      }

      const { data: contact } = await sb
        .from("enriched_contact_profiles")
        .select("id, prospect_id, phone, phone_revealed, email, email_revealed, apollo_person_id")
        .eq("id", contactId)
        .maybeSingle();
      if (!contact) {
        await sb.from("enrichment_jobs").update({
          status: "failed", error: "contact_not_found", reconciliation_required: false,
          completed_at: new Date().toISOString(), locked_at: null, locked_by: null,
        }).eq("id", job.id);
        results.push({ job_id: job.id, outcome: "contact_not_found" });
        continue;
      }

      const alreadyPersisted = field === "phone"
        ? !!(contact.phone_revealed && contact.phone)
        : !!(contact.email_revealed && contact.email);
      if (alreadyPersisted) {
        await sb.from("enrichment_jobs").update({
          status: "done", reconciliation_required: false, completed_at: new Date().toISOString(),
          locked_at: null, locked_by: null,
        }).eq("id", job.id);
        results.push({ job_id: job.id, outcome: "already_persisted" });
        continue;
      }

      const awaitingWebhook = isAwaitingWebhook(job);
      const rawRequestId = job.provider_request_id ? String(job.provider_request_id) : null;
      const requestId = isValidApolloAsyncRequestId(rawRequestId) ? rawRequestId : null;

      // KAI.18.16 — ID inválido (hex 24 / UUID / person_id) nunca vai para webhook_result.
      if (rawRequestId && !requestId) {
        await sb.from("enrichment_jobs").update({
          provider_request_id: null,
          skip_reason: "provider_record_id_misclassified_as_request_id",
        }).eq("id", job.id);
      }

      // Expiração / esgotamento: nunca deixa contato eternamente "buscando".
      const expired = job.expires_at ? new Date(job.expires_at).getTime() < Date.now() : false;
      const exhausted = attempt >= MAX_ATTEMPTS;
      if (expired || exhausted) {
        // Antes de encerrar, tenta recuperar do payload já pago (0 créditos).
        const recovered = field === "phone"
          ? await recoverFromStoredPayload(sb, job, contact)
          : null;
        if (recovered?.revealed) {
          results.push({ job_id: job.id, outcome: "revealed", source: "stored_payload_recovery" });
          continue;
        }
        const reason = expired
          ? (awaitingWebhook || !requestId ? "webhook_timeout_without_request_id" : "stale_job_expired")
          : "provider_timeout";
        await finalizeField(sb, {
          contact_id: contactId, field, outcome: "failed", job_id: job.id,
          credits_used: null, credits_confirmed: null, reason,
        });
        results.push({ job_id: job.id, outcome: reason });
        continue;
      }

      // Sem request_id válido: o resultado só pode chegar por webhook. Mantém pendente.
      if (!requestId) {
        if (field === "phone") {
          const recovered = await recoverFromStoredPayload(sb, job, contact);
          if (recovered?.revealed) {
            results.push({ job_id: job.id, outcome: "revealed", source: "stored_payload_recovery" });
            continue;
          }
        }
        results.push(await keepPending(sb, job.id, 120, AWAITING_WEBHOOK_REASON, attempt));
        continue;
      }


      if (!APOLLO_API_KEY) {
        results.push(await keepPending(sb, job.id, 180, "missing_apollo_api_key", attempt));
        continue;
      }

      // ---- Polling oficial (0 créditos) ----
      let status = 0;
      let rawText = "";
      let body: any = {};
      try {
        const r = await fetch(`${WEBHOOK_RESULT_URL}/${encodeURIComponent(requestId)}`, {
          method: "GET",
          headers: { accept: "application/json", "x-api-key": APOLLO_API_KEY },
        });
        status = r.status;
        rawText = await r.text();
        try { body = JSON.parse(rawText); } catch { body = {}; }
      } catch (e) {
        console.error("webhook_result fetch failed", { job_id: job.id, error: String(e) });
        results.push(await keepPending(sb, job.id, 120, "poll_network_error", attempt));
        continue;
      }

      const errorCode = String(body?.error_code ?? body?.error ?? "").toLowerCase();
      const retryAfter = Number(body?.retry_after_seconds ?? NaN);

      if (status === 404 && errorCode.includes("result_pending")) {
        results.push(await keepPending(sb, job.id, Number.isFinite(retryAfter) ? retryAfter : 120, "result_pending", attempt));
        continue;
      }
      if (status === 429) {
        results.push(await keepPending(sb, job.id, Number.isFinite(retryAfter) ? retryAfter : 300, "rate_limited", attempt));
        continue;
      }
      if (status === 400 || status === 404 || status === 410 || status === 401 || status === 403) {
        const reason = status === 400
          ? "invalid_provider_request_id"
          : status === 410 || errorCode.includes("expired")
          ? "provider_request_id_expired"
          : status === 404
          ? "provider_request_id_unknown"
          : "provider_auth_error";

        // KAI.18.17 — o polling é FALLBACK. Se o webhook ainda está dentro da
        // janela oficial, jamais matar o job por erro de polling.
        const createdMs = job.created_at ? new Date(job.created_at).getTime() : 0;
        const webhookAlive = field === "phone" &&
          !!(job.request as any)?.webhook_nonce_hash &&
          createdMs > 0 && Date.now() - createdMs < WEBHOOK_WAIT_TTL_MS;
        if (webhookAlive) {
          results.push(await keepPending(sb, job.id, 120, `poll_unavailable_waiting_webhook:${reason}`, attempt));
          continue;
        }

        await finalizeField(sb, {
          contact_id: contactId, field, outcome: "failed", job_id: job.id,
          credits_used: null, credits_confirmed: null,
          provider_request_id: requestId, reason,
        });
        results.push({ job_id: job.id, outcome: reason });
        continue;
      }

      if (status !== 200) {
        results.push(await keepPending(sb, job.id, 180, `unexpected_status_${status}`, attempt));
        continue;
      }

      // ---- HTTP 200: resultado final ----
      const person = body?.person ?? body?.people?.[0] ?? body?.contact ?? body;
      const providerCredits = extractProviderCredits(body) ?? extractProviderCredits(person);

      if (field === "email") {
        const email = person?.email ?? null;
        const out = await finalizeField(sb, {
          contact_id: contactId, field: "email", outcome: email ? "revealed" : "not_found",
          job_id: job.id, value: email,
          metadata: { email_status: person?.email_status ?? null },
          credits_used: providerCredits, credits_confirmed: providerCredits,
          provider_request_id: requestId, reason: "webhook_result_poll",
        });
        results.push({ job_id: job.id, outcome: out.status, source: "webhook_result" });
        continue;
      }

      const extraCompanyPhones: string[] = [];
      if (contact.prospect_id) {
        try {
          const { data: comp } = await sb.from("enriched_company_profiles").select("phone")
            .eq("prospect_id", contact.prospect_id).maybeSingle();
          if (comp?.phone) extraCompanyPhones.push(String(comp.phone));
        } catch { /* noop */ }
      }

      const qual = computePhoneQuality(person, extraCompanyPhones, "apollo", { extraPayloads: [body] });
      const outcome = qual.phone
        ? "revealed"
        : qual.outcome === "rejected_company_phone"
        ? "rejected_company_phone"
        : "not_found";

      const out = await finalizeField(sb, {
        contact_id: contactId,
        field: "phone",
        outcome,
        job_id: job.id,
        value: qual.phone,
        metadata: {
          phone_source: qual.phone_source,
          phone_type: qual.phone_type,
          phone_match_quality: qual.phone_match_quality,
          phone_confidence: qual.phone_confidence,
          phone_source_type: qual.phone_match_quality,
          phone_quality_reason: qual.reason,
          phone_validation_status: qual.phone_validation_status,
          is_whatsapp_ready: !!(qual.is_whatsapp_ready && qual.phone),
          phone_candidates_audit: qual.audit,
        },
        credits_used: providerCredits,
        credits_confirmed: providerCredits,
        provider_request_id: requestId,
        reason: qual.reason,
      });

      // Preserva o payload pago para reprocessamento futuro sem nova cobrança.
      try {
        await sb.from("enrichment_jobs").update({
          response: { webhook_result: body },
          response_summary: { source: "webhook_result", outcome: out.status, audit: qual.audit },
        }).eq("id", job.id);
      } catch { /* noop */ }

      if (out.status === "revealed" && contact.prospect_id) {
        try { await sb.rpc("resolve_primary_contact", { p_prospect_id: contact.prospect_id }); } catch { /* noop */ }
      }

      results.push({ job_id: job.id, outcome: out.status, source: "webhook_result" });
    }

    console.log("reveal-status-sync done", { processed: results.length });
    return json(200, { ok: true, processed: results.length, results });
  } catch (e) {
    console.error("kairos-apollo-reveal-status-sync error:", e);
    return json(500, { error: "sync_failed", details: String(e) });
  }
});
