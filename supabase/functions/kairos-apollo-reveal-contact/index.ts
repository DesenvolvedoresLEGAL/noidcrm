// kairos-apollo-reveal-contact (KAI.15.1)
// Revela seletivamente apenas o dado solicitado (perfil / telefone / e-mail / ambos)
// via Apollo people/match. Audita em apollo_reveal_audit e atualiza enriched_contact_profiles.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { classifyApolloPhone, computePhoneQuality } from "../_shared/apollo-phone-classifier.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APOLLO_MATCH_URL = "https://api.apollo.io/api/v1/people/match";
const APOLLO_TIMEOUT_MS = 45_000;

type DataType = "profile_only" | "email" | "phone" | "both";

interface Body {
  contact_id: string;
  prospect_id?: string;
  requested_data_type: DataType;
  source?: "manual" | "autopilot" | "sdr_agent" | "apollo_invisible";
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Phone classification moved to _shared/apollo-phone-classifier.ts (KAI.15.1 phone quality guard).

function estimateCredits(dt: DataType): number {
  if (dt === "profile_only") return 0;
  if (dt === "both") return 2;
  return 1;
}

function nextPreferredChannel(phone_revealed: boolean, email_revealed: boolean, linkedin: boolean): string {
  if (phone_revealed) return "whatsapp";
  if (email_revealed) return "email";
  if (linkedin) return "linkedin";
  return "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let safetyContactId: string | null = null;
  let safetyAdmin: any = null;
  let safetyWantsPhone = false;
  let safetyWantsEmail = false;
  try {
    const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!APOLLO_API_KEY) return json(500, { error: "APOLLO_API_KEY not configured" });

    const body = (await req.json().catch(() => ({}))) as Body;
    if (!body?.contact_id) return json(400, { error: "contact_id required" });
    const dataType: DataType = body.requested_data_type ?? "both";
    if (!["profile_only", "email", "phone", "both"].includes(dataType)) {
      return json(400, { error: "invalid requested_data_type" });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    safetyAdmin = admin;
    safetyContactId = body.contact_id;
    safetyWantsPhone = dataType === "phone" || dataType === "both";
    safetyWantsEmail = dataType === "email" || dataType === "both";

    // Resolve user (optional — source=autopilot/apollo_invisible chamam via service role sem JWT)
    const authHeader = req.headers.get("Authorization") ?? "";
    let requestedBy: string | null = null;
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: userRes } = await userClient.auth.getUser();
      requestedBy = userRes?.user?.id ?? null;
    }

    // Load contact
    const { data: contact, error: cErr } = await admin
      .from("enriched_contact_profiles")
      .select(
        "id, prospect_id, workspace_id, first_name, last_name, full_name, email, email_status, phone, linkedin_url, apollo_person_id, email_revealed, phone_revealed, email_reveal_status, phone_reveal_status, profile_credits_used, email_credits_used, phone_credits_used, preferred_channel",
      )
      .eq("id", body.contact_id)
      .maybeSingle();
    if (cErr || !contact) return json(404, { error: "contact_not_found" });

    const prospectId = body.prospect_id ?? contact.prospect_id;
    const { data: prospect } = await admin
      .from("prospects")
      .select("id, organization_id, company_name, normalized_domain, website")
      .eq("id", prospectId)
      .maybeSingle();

    const orgId = prospect?.organization_id ?? contact.workspace_id;
    if (!orgId) return json(400, { error: "organization_not_resolved" });

    // KAI.18 — Smart Coverage gate: bloqueia Apollo se cobertura já está completa
    if (prospectId) {
      try {
        const { data: cov } = await admin
          .from("kairos_coverage_analysis")
          .select("coverage_score, coverage_class, apollo_blocked, phone_exists, expires_at")
          .eq("prospect_id", prospectId)
          .order("analyzed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const fresh = cov && new Date(cov.expires_at).getTime() > Date.now();
        if (fresh && cov.apollo_blocked) {
          const auditId = await writeAudit(admin, {
            organization_id: orgId, prospect_id: prospectId, contact_id: contact.id,
            requested_data_type: dataType, status: "skipped",
            reason: "coverage_complete", requested_by: requestedBy,
            source: body.source ?? "manual",
            email_before: contact.email, phone_before: contact.phone,
          });
          await emitRevenueEvent(admin, orgId, "apollo_skipped_by_coverage", {
            prospect_id: prospectId, contact_id: contact.id,
            coverage_score: cov.coverage_score, credits_saved: estimateCredits(dataType),
          });
          return json(200, { status: "skipped", reason: "coverage_complete", coverage_score: cov.coverage_score, audit_id: auditId });
        }
        // Skip granular: pediu telefone e cobertura já indica phone_exists
        if (fresh && dataType === "phone" && cov.phone_exists) {
          const auditId = await writeAudit(admin, {
            organization_id: orgId, prospect_id: prospectId, contact_id: contact.id,
            requested_data_type: dataType, status: "skipped",
            reason: "phone_already_in_crm", requested_by: requestedBy,
            source: body.source ?? "manual",
            email_before: contact.email, phone_before: contact.phone,
          });
          await emitRevenueEvent(admin, orgId, "apollo_skipped_by_coverage", {
            prospect_id: prospectId, contact_id: contact.id, reason: "phone_already_in_crm", credits_saved: 1,
          });
          return json(200, { status: "skipped", reason: "phone_already_in_crm", audit_id: auditId });
        }
      } catch (e) {
        console.warn("coverage gate skipped:", e);
      }
    }

    // Skip rules
    const wantsEmail = dataType === "email" || dataType === "both";
    const wantsPhone = dataType === "phone" || dataType === "both";

    const emailAlready = contact.email_revealed && !!contact.email;
    const phoneAlready = contact.phone_revealed && !!contact.phone;

    if (dataType === "email" && emailAlready) {
      const auditId = await writeAudit(admin, {
        organization_id: orgId, prospect_id: prospectId, contact_id: contact.id,
        requested_data_type: dataType, status: "skipped",
        reason: "email_already_revealed", requested_by: requestedBy,
        source: body.source ?? "manual",
        email_before: contact.email, phone_before: contact.phone,
      });
      return json(200, { status: "skipped", reason: "email_already_revealed", audit_id: auditId });
    }
    if (dataType === "phone" && phoneAlready) {
      const auditId = await writeAudit(admin, {
        organization_id: orgId, prospect_id: prospectId, contact_id: contact.id,
        requested_data_type: dataType, status: "skipped",
        reason: "phone_already_revealed", requested_by: requestedBy,
        source: body.source ?? "manual",
        email_before: contact.email, phone_before: contact.phone,
      });
      return json(200, { status: "skipped", reason: "phone_already_revealed", audit_id: auditId });
    }
    if (dataType === "both" && emailAlready && phoneAlready) {
      const auditId = await writeAudit(admin, {
        organization_id: orgId, prospect_id: prospectId, contact_id: contact.id,
        requested_data_type: dataType, status: "skipped",
        reason: "all_requested_data_already_revealed", requested_by: requestedBy,
        source: body.source ?? "manual",
        email_before: contact.email, phone_before: contact.phone,
      });
      return json(200, { status: "skipped", reason: "all_requested_data_already_revealed", audit_id: auditId });
    }

    // Build Apollo payload (only flags for what we want)
    const webhookToken = Deno.env.get("APOLLO_WEBHOOK_TOKEN") ?? "";
    const webhookBase = `${SUPABASE_URL}/functions/v1/apollo-phone-webhook`;
    const webhookUrl = `${webhookBase}?contact_id=${encodeURIComponent(contact.id)}${webhookToken ? `&token=${encodeURIComponent(webhookToken)}` : ""}`;

    const payload: Record<string, unknown> = {
      reveal_personal_emails: wantsEmail && !emailAlready,
      reveal_phone_number: wantsPhone && !phoneAlready,
    };
    if (wantsPhone && !phoneAlready) payload.webhook_url = webhookUrl;

    if (contact.apollo_person_id) {
      payload.id = contact.apollo_person_id;
    } else {
      if (contact.first_name) payload.first_name = contact.first_name;
      if (contact.last_name) payload.last_name = contact.last_name;
      if (!payload.first_name && contact.full_name) payload.name = contact.full_name;
      if (prospect?.company_name) payload.organization_name = prospect.company_name;
      const domain = prospect?.normalized_domain ?? (prospect?.website
        ? (() => { try { const u = new URL(prospect.website!.startsWith("http") ? prospect.website! : `https://${prospect.website}`); return u.hostname.replace(/^www\./, ""); } catch { return null; } })()
        : null);
      if (domain) payload.domain = domain;
    }

    // Create job
    const { data: jobRow } = await admin.from("enrichment_jobs").insert({
      workspace_id: contact.workspace_id,
      prospect_id: prospectId,
      contact_id: contact.id,
      provider: "apollo_reveal",
      status: "running",
      trigger_source: body.source ?? "manual",
      requested_data_type: dataType,
      requested_channel: wantsPhone ? "phone" : wantsEmail ? "email" : "profile",
      credits_estimated: estimateCredits(dataType),
      request: { contact_id: contact.id, requested_data_type: dataType },
    }).select("id").maybeSingle();
    const jobId = jobRow?.id ?? null;

    // Call Apollo
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), APOLLO_TIMEOUT_MS);
    let apolloStatus = 0;
    let apolloOk = false;
    let apolloResp: any = null;
    let apolloError: string | undefined;
    try {
      const r = await fetch(APOLLO_MATCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": APOLLO_API_KEY },
        signal: ctrl.signal,
        body: JSON.stringify(payload),
      });
      apolloStatus = r.status;
      apolloOk = r.ok;
      apolloResp = await r.json().catch(() => ({}));
      if (!r.ok) apolloError = apolloResp?.error || apolloResp?.message || `HTTP ${r.status}`;
    } catch (e) {
      apolloError = String(e);
    } finally {
      clearTimeout(timer);
    }

    const nowIso = new Date().toISOString();

    if (!apolloOk) {
      await admin.from("enrichment_jobs").update({
        status: "failed",
        credits_used: 0,
        error: apolloError ?? "Apollo error",
        response: { status: apolloStatus, body: apolloResp },
        completed_at: nowIso,
      }).eq("id", jobId);

      // Update contact statuses for failed reveal
      const upd: Record<string, unknown> = {};
      if (wantsEmail && !emailAlready) upd.email_reveal_status = "failed";
      if (wantsPhone && !phoneAlready) upd.phone_reveal_status = "failed";
      if (Object.keys(upd).length) await admin.from("enriched_contact_profiles").update(upd).eq("id", contact.id);

      const auditId = await writeAudit(admin, {
        organization_id: orgId, prospect_id: prospectId, contact_id: contact.id,
        job_id: jobId, requested_data_type: dataType, status: "failed",
        credits_estimated: estimateCredits(dataType), credits_used: 0,
        reason: apolloError ?? "apollo_error",
        email_before: contact.email, phone_before: contact.phone,
        raw_response: { status: apolloStatus, body: apolloResp },
        requested_by: requestedBy, source: body.source ?? "manual",
      });
      await emitRevenueEvent(admin, orgId, "apollo_reveal_failed", { contact_id: contact.id, requested_data_type: dataType, reason: apolloError });
      return json(200, {
        success: false,
        status: "failed",
        contact_id: contact.id,
        phone_reveal_status: wantsPhone && !phoneAlready ? "failed" : null,
        phone_revealed: !!contact.phone_revealed,
        phone_source_type: null,
        credits_used: 0,
        reason: apolloError ?? "apollo_error",
        audit_id: auditId,
      });
    }

    const person = apolloResp?.person ?? null;
    const revealedEmail = wantsEmail && !emailAlready ? (person?.email ?? null) : null;

    // KAI.15.1 phone quality: only accept person-owned phones. Reject any org/company phone.
    let extraCompanyPhones: string[] = [];
    try {
      const { data: comp } = await admin
        .from("enriched_company_profiles")
        .select("phone")
        .eq("prospect_id", prospectId)
        .maybeSingle();
      if (comp?.phone) extraCompanyPhones.push(String(comp.phone));
    } catch { /* noop */ }
    const phoneQual = wantsPhone && !phoneAlready
      ? computePhoneQuality(person, extraCompanyPhones, "apollo")
      : null;
    const revealedPhone = phoneQual?.phone ?? null;
    const phoneSourceType = phoneQual
      ? (phoneQual.phone_match_quality === "person_mobile" ? "person_mobile"
          : phoneQual.phone_match_quality === "person_direct" ? "person_direct"
          : phoneQual.phone_match_quality === "company_main" ? "company_main"
          : "unknown")
      : "unknown";
    const companyPhoneRejected = !revealedPhone && !!phoneQual?.rejected_company_phone;

    const apolloPersonId = person?.id ?? person?.person_id ?? contact.apollo_person_id ?? null;
    // Phone still pending only when Apollo didn't return anything (person or company).
    const phonePending = wantsPhone && !phoneAlready && !revealedPhone && !companyPhoneRejected;

    const update: Record<string, unknown> = {
      last_reveal_attempt_at: nowIso,
      last_reveal_job_id: jobId,
      reveal_source: body.source ?? "manual",
    };
    let creditsUsed = 0;

    if (wantsEmail && !emailAlready) {
      if (revealedEmail) {
        update.email = revealedEmail;
        update.email_revealed = true;
        update.email_reveal_status = "revealed";
        update.email_revealed_at = nowIso;
        if (person?.email_status) update.email_status = person.email_status;
        update.email_credits_used = (contact.email_credits_used ?? 0) + 1;
        creditsUsed += 1;
      } else {
        update.email_reveal_status = "not_found";
      }
    }
    if (wantsPhone && !phoneAlready && phoneQual) {
      // KAI.15.2 — sempre persiste metadados de qualidade (mesmo em rejeitado/not_found)
      update.phone_source = phoneQual.phone_source;
      update.phone_type = phoneQual.phone_type;
      update.phone_match_quality = phoneQual.phone_match_quality;
      update.phone_confidence = phoneQual.phone_confidence;
      update.phone_quality_reason = phoneQual.reason;
      update.is_whatsapp_ready = phoneQual.is_whatsapp_ready;
      update.phone_validation_status = phoneQual.phone_validation_status;
      update.phone_last_validation_at = nowIso;
      update.phone_source_type = phoneSourceType;

      if (revealedPhone && phoneQual.phone_confidence >= 80) {
        update.phone = revealedPhone;
        update.phone_revealed = true;
        update.phone_reveal_status = "revealed";
        update.phone_revealed_at = nowIso;
        update.phone_verified_at = nowIso;
        update.phone_credits_used = (contact.phone_credits_used ?? 0) + 1;
        creditsUsed += 1;
      } else if (companyPhoneRejected) {
        // Apollo devolveu apenas telefone corporativo — nunca salvar como pessoa.
        update.phone_reveal_status = "rejected_company_phone";
        update.phone_revealed = false;
        update.is_whatsapp_ready = false;
      } else if (phonePending) {
        update.phone_reveal_status = "requested"; // webhook completará
      } else {
        update.phone_reveal_status = "not_found";
        update.phone_revealed = false;
        update.is_whatsapp_ready = false;
      }
    }
    if (apolloPersonId && !contact.apollo_person_id) update.apollo_person_id = apolloPersonId;

    const phoneRevealedFinal = !!(update.phone_revealed ?? contact.phone_revealed);
    const emailRevealedFinal = !!(update.email_revealed ?? contact.email_revealed);
    update.preferred_channel = nextPreferredChannel(phoneRevealedFinal, emailRevealedFinal, !!contact.linkedin_url);

    await admin.from("enriched_contact_profiles").update(update).eq("id", contact.id);

    // Re-resolve primary
    try { await admin.rpc("resolve_primary_contact", { p_prospect_id: prospectId }); } catch {/*noop*/}

    let finalStatus: string;
    if (companyPhoneRejected && !revealedEmail) finalStatus = "rejected_company_phone";
    else if (phonePending) finalStatus = "pending";
    else if (revealedEmail || revealedPhone) finalStatus = "revealed";
    else finalStatus = "not_found";

    await admin.from("enrichment_jobs").update({
      status: phonePending ? "running" : "done",
      credits_used: creditsUsed,
      contacts_found: revealedEmail || revealedPhone ? 1 : 0,
      response: { status: apolloStatus, person_id: apolloPersonId },
      response_summary: {
        revealed_email: !!revealedEmail,
        revealed_phone: !!revealedPhone,
        phone_pending: phonePending,
      },
      completed_at: phonePending ? null : nowIso,
    }).eq("id", jobId);

    const auditReason = companyPhoneRejected
      ? "company_phone_rejected"
      : (finalStatus === "not_found" && wantsPhone ? "no_person_phone_returned" : undefined);

    const auditId = await writeAudit(admin, {
      organization_id: orgId, prospect_id: prospectId, contact_id: contact.id, job_id: jobId,
      requested_data_type: dataType, status: finalStatus,
      credits_estimated: estimateCredits(dataType), credits_used: creditsUsed,
      email_before: contact.email, email_after: revealedEmail ?? contact.email,
      phone_before: contact.phone, phone_after: revealedPhone ?? contact.phone,
      requested_by: requestedBy, source: body.source ?? "manual",
      reason: auditReason,
      phone_source_type: wantsPhone ? phoneSourceType : null,
      phone_source: phoneQual?.phone_source ?? null,
      phone_type: phoneQual?.phone_type ?? null,
      phone_match_quality: phoneQual?.phone_match_quality ?? null,
      phone_confidence: phoneQual?.phone_confidence ?? null,
      is_whatsapp_ready: !!phoneQual?.is_whatsapp_ready,
      phone_quality_reason: phoneQual?.reason ?? null,
      raw_response: {
        status: apolloStatus,
        person_id: apolloPersonId,
        phone_source_type: phoneSourceType,
        phone_match_quality: phoneQual?.phone_match_quality ?? null,
        phone_confidence: phoneQual?.phone_confidence ?? null,
        company_phone_rejected: companyPhoneRejected,
        rejected_company_phone: phoneQual?.rejected_company_phone ?? null,
      },
    });

    // KAI.15.2 — Revenue events granulares por qualidade
    if (revealedEmail) await emitRevenueEvent(admin, orgId, "apollo_email_revealed", { contact_id: contact.id });
    if (wantsEmail && !revealedEmail && !emailAlready) await emitRevenueEvent(admin, orgId, "apollo_email_not_found", { contact_id: contact.id });
    if (revealedPhone && phoneQual) {
      await emitRevenueEvent(admin, orgId, "phone_quality_scored", {
        contact_id: contact.id,
        phone_match_quality: phoneQual.phone_match_quality,
        phone_confidence: phoneQual.phone_confidence,
        is_whatsapp_ready: phoneQual.is_whatsapp_ready,
      });
      if (phoneQual.phone_match_quality === "person_mobile") {
        await emitRevenueEvent(admin, orgId, "phone_person_mobile_revealed", { contact_id: contact.id });
      } else if (phoneQual.phone_match_quality === "person_direct") {
        await emitRevenueEvent(admin, orgId, "phone_person_direct_revealed", { contact_id: contact.id });
      }
      if (phoneQual.is_whatsapp_ready) {
        await emitRevenueEvent(admin, orgId, "phone_person_whatsapp_revealed", { contact_id: contact.id });
      }
    }
    if (companyPhoneRejected) await emitRevenueEvent(admin, orgId, "phone_company_rejected", { contact_id: contact.id });
    if (wantsPhone && !revealedPhone && !companyPhoneRejected && !phonePending && !phoneAlready) await emitRevenueEvent(admin, orgId, "apollo_phone_not_found", { contact_id: contact.id });

    // Update kairos_qualified_queue with channel + flags
    try {
      await admin.from("kairos_qualified_queue").update({
        primary_contact_score: null,
        phone_revealed: phoneRevealedFinal,
        email_revealed: emailRevealedFinal,
        preferred_channel: update.preferred_channel,
      }).eq("prospect_id", prospectId);
    } catch {/*column may not exist in older schema*/}

    return json(200, {
      success: true,
      status: finalStatus,
      contact_id: contact.id,
      requested_data_type: dataType,
      phone_reveal_status: (update.phone_reveal_status ?? contact.phone_reveal_status ?? null) as string | null,
      phone_revealed: !!(update.phone_revealed ?? contact.phone_revealed),
      phone_source_type: (wantsPhone ? phoneSourceType : null) as string | null,
      phone_type: phoneQual?.phone_type ?? null,
      phone_match_quality: phoneQual?.phone_match_quality ?? null,
      phone_confidence: phoneQual?.phone_confidence ?? null,
      is_whatsapp_ready: !!phoneQual?.is_whatsapp_ready,
      credits_estimated: estimateCredits(dataType),
      credits_used: creditsUsed,
      email: revealedEmail,
      phone: revealedPhone,
      phone_pending: phonePending,
      company_phone_rejected: companyPhoneRejected,
      reason: auditReason ?? phoneQual?.reason ?? null,
      preferred_channel: update.preferred_channel,
      audit_id: auditId,
    });
  } catch (e) {
    console.error("kairos-apollo-reveal-contact error:", e);
    // Safety net: ensure contact never stays stuck if we threw mid-flight.
    const reason = String((e as any)?.message ?? e);
    try {
      if (safetyAdmin && safetyContactId) {
        const upd: Record<string, unknown> = { last_reveal_attempt_at: new Date().toISOString() };
        if (safetyWantsPhone) { upd.phone_reveal_status = "failed"; upd.phone_revealed = false; }
        if (safetyWantsEmail) { upd.email_reveal_status = "failed"; }
        await safetyAdmin.from("enriched_contact_profiles").update(upd).eq("id", safetyContactId);
      }
    } catch {/*noop*/}
    return json(200, {
      success: false,
      status: "failed",
      contact_id: safetyContactId,
      phone_reveal_status: safetyWantsPhone ? "failed" : null,
      phone_revealed: false,
      phone_source_type: null,
      credits_used: 0,
      reason,
    });
  }
});

async function writeAudit(admin: any, row: Record<string, unknown>): Promise<string | null> {
  try {
    const { data } = await admin.from("apollo_reveal_audit").insert(row).select("id").maybeSingle();
    return data?.id ?? null;
  } catch (e) {
    console.warn("apollo_reveal_audit insert failed:", e);
    return null;
  }
}

async function emitRevenueEvent(admin: any, orgId: string, kind: string, payload: Record<string, unknown>) {
  try {
    await admin.from("revenue_events").insert({
      organization_id: orgId,
      event_type: kind,
      payload,
    });
  } catch {/*noop*/}
  try {
    await admin.from("system_events").insert({
      organization_id: orgId,
      event_type: kind,
      payload,
    });
  } catch {/*noop*/}
}
