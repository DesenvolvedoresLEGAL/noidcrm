// KAI.18.13 — Apollo Reveal Reliability Core
// Núcleo único compartilhado por kairos-apollo-reveal-contact e reveal-apollo-contact.
// Regras: idempotência por campo (phone|email), jobs independentes por campo,
// persistência exclusivamente via RPC fn_finalize_apollo_reveal (com read-back),
// nunca emitir "revealed" sem valor confirmado no banco.
import { computePhoneQuality } from "./apollo-phone-classifier.ts";

export const APOLLO_MATCH_URL = "https://api.apollo.io/api/v1/people/match";
const APOLLO_TIMEOUT_MS = 45_000;

export type RevealField = "phone" | "email";
export type DataType = "profile_only" | "email" | "phone" | "both";

export type FieldStatus =
  | "not_requested"
  | "requested"
  | "pending_provider"
  | "revealed"
  | "not_found"
  | "rejected_company_phone"
  | "failed"
  | "skipped";

export interface FieldResult {
  status: FieldStatus;
  revealed: boolean;
  value: string | null;
  source_type?: string | null;
  credits_estimated: number;
  credits_used: number | null;
  credits_confirmed: number | null;
  reason: string | null;
  job_id: string | null;
}

export interface RevealResponse {
  success: boolean;
  overall_status: "revealed" | "partial" | "pending" | "not_found" | "rejected_company_phone" | "failed" | "skipped";
  contact_id: string;
  requested_data_type: DataType;
  request_group_id: string | null;
  correlation_id: string | null;
  phone: FieldResult;
  email: FieldResult;
  audit_id: string | null;
  reason?: string | null;
  // compat legado (não usar para decidir UI)
  status: string;
  credits_used: number | null;
}

export interface RevealRequest {
  contact_id: string;
  prospect_id?: string | null;
  requested_data_type: DataType;
  source?: string;
  requested_by?: string | null;
}

function emptyField(status: FieldStatus = "not_requested", reason: string | null = null): FieldResult {
  return {
    status,
    revealed: false,
    value: null,
    source_type: null,
    credits_estimated: 0,
    credits_used: null,
    credits_confirmed: null,
    reason,
    job_id: null,
  };
}

function overallFrom(phone: FieldResult, email: FieldResult): RevealResponse["overall_status"] {
  const active = [phone, email].filter((f) => f.status !== "not_requested");
  if (active.length === 0) return "skipped";
  const revealed = active.filter((f) => f.status === "revealed").length;
  if (revealed === active.length) return "revealed";
  if (revealed > 0) return "partial";
  if (active.some((f) => f.status === "pending_provider" || f.status === "requested")) return "pending";
  if (active.every((f) => f.status === "skipped")) return "skipped";
  if (active.some((f) => f.status === "failed")) return "failed";
  if (active.some((f) => f.status === "rejected_company_phone")) return "rejected_company_phone";
  return "not_found";
}

export async function writeAudit(admin: any, row: Record<string, unknown>): Promise<string | null> {
  try {
    const { data } = await admin.from("apollo_reveal_audit").insert(row).select("id").maybeSingle();
    return data?.id ?? null;
  } catch (e) {
    console.warn("apollo_reveal_audit insert failed:", e);
    return null;
  }
}

export async function emitRevenueEvent(admin: any, orgId: string, kind: string, payload: Record<string, unknown>) {
  try {
    await admin.from("revenue_events").insert({ organization_id: orgId, event_type: kind, payload });
  } catch { /* noop */ }
  try {
    await admin.from("system_events").insert({ organization_id: orgId, event_type: kind, payload });
  } catch { /* noop */ }
}

/** Persistência oficial: RPC atômica com read-back. Nunca escrever direto no contato. */
export async function finalizeField(admin: any, args: {
  contact_id: string;
  field: RevealField;
  outcome: "revealed" | "not_found" | "rejected_company_phone" | "failed" | "pending_provider";
  job_id?: string | null;
  value?: string | null;
  metadata?: Record<string, unknown>;
  credits_used?: number | null;
  credits_confirmed?: number | null;
  provider_request_id?: string | null;
  audit_id?: string | null;
  reason?: string | null;
}): Promise<{ status: FieldStatus; value: string | null; reason: string | null }> {
  const { data, error } = await admin.rpc("fn_finalize_apollo_reveal", {
    p_contact_id: args.contact_id,
    p_field: args.field,
    p_outcome: args.outcome,
    p_job_id: args.job_id ?? null,
    p_value: args.value ?? null,
    p_metadata: args.metadata ?? {},
    p_credits_used: args.credits_used ?? null,
    p_credits_confirmed: args.credits_confirmed ?? null,
    p_provider_request_id: args.provider_request_id ?? null,
    p_audit_id: args.audit_id ?? null,
    p_reason: args.reason ?? null,
  });
  if (error) {
    console.error("fn_finalize_apollo_reveal error", { field: args.field, error: error.message });
    return { status: "failed", value: null, reason: "persistence_error" };
  }
  const res = data as any;
  if (!res?.ok) return { status: "failed", value: null, reason: res?.reason ?? "persistence_rejected" };
  return {
    status: (res.status ?? "failed") as FieldStatus,
    value: res.value ?? null,
    reason: res.reason ?? null,
  };
}

interface ActiveJob {
  id: string;
  status: string;
  field: RevealField;
  request_group_id: string | null;
}

/** Cria um job por campo. Idempotência: índice único parcial por (workspace, contato, campo, provider). */
async function claimJob(
  admin: any,
  params: {
    workspace_id: string;
    prospect_id: string | null;
    contact_id: string;
    field: RevealField;
    request_group_id: string;
    source: string;
    requested_data_type: DataType;
  },
): Promise<{ job: ActiveJob | null; reused: boolean }> {
  const { data, error } = await admin
    .from("enrichment_jobs")
    .insert({
      workspace_id: params.workspace_id,
      prospect_id: params.prospect_id,
      contact_id: params.contact_id,
      provider: "apollo_reveal",
      status: "running",
      field: params.field,
      request_group_id: params.request_group_id,
      trigger_source: params.source,
      requested_data_type: params.requested_data_type,
      requested_channel: params.field,
      credits_estimated: 1,
      expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      request: { contact_id: params.contact_id, field: params.field },
    })
    .select("id, status, field, request_group_id")
    .maybeSingle();

  if (!error && data) return { job: data as ActiveJob, reused: false };

  // Conflito: já existe job ativo para o mesmo contato/campo → reutiliza (sem chamar Apollo).
  const { data: existing } = await admin
    .from("enrichment_jobs")
    .select("id, status, field, request_group_id")
    .eq("contact_id", params.contact_id)
    .eq("field", params.field)
    .eq("provider", "apollo_reveal")
    .in("status", ["queued", "running", "pending_provider"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return { job: existing as ActiveJob, reused: true };
  console.error("claimJob failed without existing job", error?.message);
  return { job: null, reused: false };
}

function resolveDomain(prospect: any): string | null {
  if (prospect?.normalized_domain) return prospect.normalized_domain;
  if (!prospect?.website) return null;
  try {
    const raw = String(prospect.website);
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Prioridade de match: apollo_person_id → e-mail exato → LinkedIn exato → nome + domínio. */
function buildMatchPayload(contact: any, prospect: any): { payload: Record<string, unknown>; strategy: string } {
  if (contact.apollo_person_id) return { payload: { id: contact.apollo_person_id }, strategy: "apollo_person_id" };
  if (contact.email) return { payload: { email: contact.email }, strategy: "email_exact" };
  if (contact.linkedin_url) return { payload: { linkedin_url: contact.linkedin_url }, strategy: "linkedin_exact" };

  const payload: Record<string, unknown> = {};
  if (contact.first_name) payload.first_name = contact.first_name;
  if (contact.last_name) payload.last_name = contact.last_name;
  if (!payload.first_name && contact.full_name) payload.name = contact.full_name;
  if (prospect?.company_name) payload.organization_name = prospect.company_name;
  const domain = resolveDomain(prospect);
  if (domain) payload.domain = domain;
  return { payload, strategy: "name_domain" };
}

/** Confirma que a pessoa retornada é o mesmo contato antes de qualquer persistência. */
function identityMatches(contact: any, person: any, strategy: string): boolean {
  if (!person) return false;
  const personId = person.id ?? person.person_id ?? null;
  if (contact.apollo_person_id) return String(personId ?? "") === String(contact.apollo_person_id);
  if (strategy === "email_exact") {
    const pe = String(person.email ?? "").toLowerCase();
    return !pe || pe === String(contact.email ?? "").toLowerCase();
  }
  if (strategy === "linkedin_exact") {
    const pl = String(person.linkedin_url ?? "").toLowerCase();
    return !pl || pl.replace(/\/+$/, "") === String(contact.linkedin_url ?? "").toLowerCase().replace(/\/+$/, "");
  }
  // name_domain: exige sobreposição de nome
  const target = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim().toLowerCase() ||
    String(contact.full_name ?? "").toLowerCase();
  const got = String(person.name ?? `${person.first_name ?? ""} ${person.last_name ?? ""}`).trim().toLowerCase();
  if (!target || !got) return false;
  return got.includes(target.split(" ")[0]) && (!contact.last_name || got.includes(String(contact.last_name).toLowerCase()));
}

export async function runApolloReveal(admin: any, req: RevealRequest, env: {
  APOLLO_API_KEY: string;
  SUPABASE_URL: string;
  APOLLO_WEBHOOK_TOKEN?: string;
}): Promise<RevealResponse> {
  const dataType: DataType = req.requested_data_type ?? "both";
  const source = req.source ?? "manual";
  const correlationId = crypto.randomUUID();
  const requestGroupId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  let phoneResult = emptyField();
  let emailResult = emptyField();

  const base = (extra: Partial<RevealResponse> = {}): RevealResponse => {
    const overall = extra.overall_status ?? overallFrom(phoneResult, emailResult);
    return {
      success: overall !== "failed",
      overall_status: overall,
      status: overall,
      contact_id: req.contact_id,
      requested_data_type: dataType,
      request_group_id: requestGroupId,
      correlation_id: correlationId,
      phone: phoneResult,
      email: emailResult,
      audit_id: null,
      credits_used: null,
      ...extra,
    };
  };

  const { data: contact } = await admin
    .from("enriched_contact_profiles")
    .select(
      "id, prospect_id, workspace_id, first_name, last_name, full_name, email, email_status, phone, linkedin_url, apollo_person_id, email_revealed, phone_revealed, email_reveal_status, phone_reveal_status, preferred_channel",
    )
    .eq("id", req.contact_id)
    .maybeSingle();
  if (!contact) return base({ overall_status: "failed", reason: "contact_not_found", success: false });

  const prospectId = req.prospect_id ?? contact.prospect_id ?? null;
  const { data: prospect } = prospectId
    ? await admin.from("prospects").select("id, organization_id, company_name, normalized_domain, website").eq("id", prospectId).maybeSingle()
    : { data: null as any };
  const orgId = prospect?.organization_id ?? contact.workspace_id;
  if (!orgId) return base({ overall_status: "failed", reason: "organization_not_resolved", success: false });

  const wantsEmail = dataType === "email" || dataType === "both";
  const wantsPhone = dataType === "phone" || dataType === "both";
  if (!wantsEmail && !wantsPhone) return base({ overall_status: "skipped", reason: "profile_only" });

  const emailAlready = !!contact.email_revealed && !!contact.email;
  const phoneAlready = !!contact.phone_revealed && !!contact.phone;

  // Cobertura: bloqueio de telefone já existente no CRM
  let coverageBlocked = false;
  if (prospectId) {
    try {
      const { data: cov } = await admin
        .from("kairos_coverage_analysis")
        .select("coverage_score, apollo_blocked, phone_exists, expires_at")
        .eq("prospect_id", prospectId)
        .order("analyzed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const fresh = cov && new Date(cov.expires_at).getTime() > Date.now();
      if (fresh && cov.apollo_blocked) coverageBlocked = true;
    } catch { /* noop */ }
  }

  const targets: RevealField[] = [];
  if (wantsEmail) {
    if (emailAlready) emailResult = { ...emptyField("skipped", "email_already_revealed"), revealed: true, value: contact.email };
    else if (coverageBlocked) emailResult = emptyField("skipped", "coverage_complete");
    else targets.push("email");
  }
  if (wantsPhone) {
    if (phoneAlready) phoneResult = { ...emptyField("skipped", "phone_already_revealed"), revealed: true, value: contact.phone };
    else if (coverageBlocked) phoneResult = emptyField("skipped", "coverage_complete");
    else targets.push("phone");
  }

  if (targets.length === 0) {
    const auditId = await writeAudit(admin, {
      organization_id: orgId, prospect_id: prospectId, contact_id: contact.id,
      requested_data_type: dataType, provider: "apollo", status: "skipped",
      reason: coverageBlocked ? "coverage_complete" : "already_revealed",
      requested_by: req.requested_by ?? null, source,
      email_before: contact.email, phone_before: contact.phone,
    });
    return base({ overall_status: "skipped", audit_id: auditId, reason: coverageBlocked ? "coverage_complete" : "already_revealed" });
  }

  // Jobs independentes por campo (mesmo request_group_id quando "both")
  const jobs: Partial<Record<RevealField, ActiveJob>> = {};
  const fieldsToCall: RevealField[] = [];
  for (const field of targets) {
    const { job, reused } = await claimJob(admin, {
      workspace_id: contact.workspace_id,
      prospect_id: prospectId,
      contact_id: contact.id,
      field,
      request_group_id: requestGroupId,
      source,
      requested_data_type: dataType,
    });
    if (!job) {
      const failed = { ...emptyField("failed", "job_creation_failed"), credits_estimated: 0 };
      if (field === "phone") phoneResult = failed; else emailResult = failed;
      continue;
    }
    jobs[field] = job;
    if (reused) {
      const pending: FieldResult = {
        ...emptyField("pending_provider", "already_in_progress"),
        credits_estimated: 1,
        job_id: job.id,
      };
      if (field === "phone") phoneResult = pending; else emailResult = pending;
      continue;
    }
    fieldsToCall.push(field);
  }

  if (fieldsToCall.length === 0) return base();

  const auditId = await writeAudit(admin, {
    organization_id: orgId, prospect_id: prospectId, contact_id: contact.id,
    job_id: jobs[fieldsToCall[0]]?.id ?? null,
    requested_data_type: fieldsToCall.join("+"), provider: "apollo", status: "requested",
    credits_estimated: fieldsToCall.length, requested_by: req.requested_by ?? null, source,
    email_before: contact.email, phone_before: contact.phone,
  });

  const callPhone = fieldsToCall.includes("phone");
  const callEmail = fieldsToCall.includes("email");

  const { payload: matchPayload, strategy } = buildMatchPayload(contact, prospect);
  const payload: Record<string, unknown> = {
    ...matchPayload,
    reveal_personal_emails: callEmail,
    reveal_phone_number: callPhone,
  };
  if (callPhone) {
    const token = env.APOLLO_WEBHOOK_TOKEN ?? "";
    payload.webhook_url =
      `${env.SUPABASE_URL}/functions/v1/apollo-phone-webhook?contact_id=${encodeURIComponent(contact.id)}` +
      `&job_id=${encodeURIComponent(jobs.phone!.id)}` +
      (token ? `&token=${encodeURIComponent(token)}` : "");
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), APOLLO_TIMEOUT_MS);
  let apolloOk = false;
  let apolloStatus = 0;
  let apolloResp: any = null;
  let apolloError: string | undefined;
  let providerRequestId: string | null = null;
  try {
    const r = await fetch(APOLLO_MATCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": env.APOLLO_API_KEY },
      signal: ctrl.signal,
      body: JSON.stringify(payload),
    });
    apolloStatus = r.status;
    apolloOk = r.ok;
    providerRequestId = r.headers.get("x-request-id");
    apolloResp = await r.json().catch(() => ({}));
    if (!r.ok) apolloError = apolloResp?.error || apolloResp?.message || `HTTP ${apolloStatus}`;
  } catch (e) {
    apolloError = String(e);
  } finally {
    clearTimeout(timer);
  }

  if (!apolloOk) {
    const isTimeout = !apolloStatus;
    for (const field of fieldsToCall) {
      const out = await finalizeField(admin, {
        contact_id: contact.id,
        field,
        outcome: "failed",
        job_id: jobs[field]!.id,
        credits_used: 0,
        credits_confirmed: 0,
        audit_id: auditId,
        reason: isTimeout ? "provider_timeout" : (apolloError ?? "apollo_error"),
      });
      const res: FieldResult = {
        ...emptyField("failed", out.reason ?? apolloError ?? "apollo_error"),
        credits_estimated: 1,
        credits_used: 0,
        credits_confirmed: 0,
        job_id: jobs[field]!.id,
      };
      if (field === "phone") phoneResult = res; else emailResult = res;
    }
    await emitRevenueEvent(admin, orgId, "apollo_reveal_failed", {
      contact_id: contact.id, fields: fieldsToCall, reason: apolloError,
    });
    return base({ overall_status: "failed", success: false, audit_id: auditId, reason: apolloError ?? "apollo_error" });
  }

  const person = apolloResp?.person ?? null;
  const identityOk = identityMatches(contact, person, strategy);
  const apolloPersonId = person?.id ?? person?.person_id ?? contact.apollo_person_id ?? null;

  if (!identityOk) {
    for (const field of fieldsToCall) {
      await finalizeField(admin, {
        contact_id: contact.id, field, outcome: "failed", job_id: jobs[field]!.id,
        credits_used: 0, credits_confirmed: 0, audit_id: auditId, reason: "identity_mismatch",
        provider_request_id: providerRequestId,
      });
      const res: FieldResult = {
        ...emptyField("failed", "identity_mismatch"), credits_estimated: 1,
        credits_used: 0, credits_confirmed: 0, job_id: jobs[field]!.id,
      };
      if (field === "phone") phoneResult = res; else emailResult = res;
    }
    return base({ overall_status: "failed", success: false, audit_id: auditId, reason: "identity_mismatch" });
  }

  // ---- E-mail ----
  if (callEmail) {
    const revealedEmail: string | null = person?.email ?? null;
    const out = await finalizeField(admin, {
      contact_id: contact.id,
      field: "email",
      outcome: revealedEmail ? "revealed" : "not_found",
      job_id: jobs.email!.id,
      value: revealedEmail,
      metadata: { email_status: person?.email_status ?? null, apollo_person_id: apolloPersonId },
      credits_used: revealedEmail ? 1 : 0,
      credits_confirmed: revealedEmail ? 1 : 0,
      provider_request_id: providerRequestId,
      audit_id: auditId,
    });
    emailResult = {
      status: out.status,
      revealed: out.status === "revealed",
      value: out.value,
      credits_estimated: 1,
      credits_used: out.status === "revealed" ? 1 : 0,
      credits_confirmed: out.status === "revealed" ? 1 : 0,
      reason: out.reason,
      job_id: jobs.email!.id,
      source_type: null,
    };
    if (out.status === "revealed") await emitRevenueEvent(admin, orgId, "apollo_email_revealed", { contact_id: contact.id });
    else await emitRevenueEvent(admin, orgId, "apollo_email_not_found", { contact_id: contact.id });
  }

  // ---- Telefone ----
  if (callPhone) {
    const extraCompanyPhones: string[] = [];
    if (prospectId) {
      try {
        const { data: comp } = await admin.from("enriched_company_profiles").select("phone").eq("prospect_id", prospectId).maybeSingle();
        if (comp?.phone) extraCompanyPhones.push(String(comp.phone));
      } catch { /* noop */ }
    }
    // KAI.18.14 — pendência assíncrona real: entradas de telefone sem número algum.
    const rawNumbers: any[] = Array.isArray(person?.phone_numbers) ? person.phone_numbers : [];
    const asyncPending = rawNumbers.some((p: any) => p && typeof p === "object" && !p.sanitized_number && !p.raw_number && !p.number);

    const qual = computePhoneQuality(person, extraCompanyPhones, "apollo", { allowPending: asyncPending });
    const acceptedPhone = qual.phone;
    const sourceType = qual.phone_match_quality === "person_mobile"
      ? "person_mobile"
      : qual.phone_match_quality === "person_direct"
      ? "person_direct"
      : qual.phone_match_quality === "company_main"
      ? "company_main"
      : qual.outcome === "phone_only_web"
      ? "phone_only_web"
      : "unknown";
    const companyRejected = qual.outcome === "rejected_company_phone";

    const metadata = {
      phone_source: qual.phone_source,
      phone_type: qual.phone_type,
      phone_match_quality: qual.phone_match_quality,
      phone_confidence: qual.phone_confidence,
      phone_source_type: sourceType,
      phone_quality_reason: qual.reason,
      phone_validation_status: qual.phone_validation_status,
      is_whatsapp_ready: !!(qual.is_whatsapp_ready && acceptedPhone),
      apollo_person_id: apolloPersonId,
      phone_candidates_audit: qual.audit,
    };

    const outcome = qual.outcome;

    const out = await finalizeField(admin, {
      contact_id: contact.id,
      field: "phone",
      outcome: outcome as any,
      job_id: jobs.phone!.id,
      value: acceptedPhone,
      metadata,
      credits_used: acceptedPhone ? 1 : 0,
      credits_confirmed: acceptedPhone ? 1 : null,
      provider_request_id: providerRequestId,
      audit_id: auditId,
      reason: qual.reason,
    });

    const status: FieldStatus = (outcome === "pending_provider" || outcome === "phone_only_web") && out.status !== "failed"
      ? (outcome as FieldStatus)
      : out.status;
    phoneResult = {
      status,
      revealed: status === "revealed",
      value: out.value,
      source_type: sourceType,
      credits_estimated: 1,
      credits_used: status === "revealed" ? 1 : status === "pending_provider" ? null : 0,
      credits_confirmed: status === "revealed" ? 1 : null,
      reason: out.reason,
      job_id: jobs.phone!.id,
    };

    if (status === "revealed") {
      await emitRevenueEvent(admin, orgId, "phone_quality_scored", {
        contact_id: contact.id,
        phone_match_quality: qual.phone_match_quality,
        phone_confidence: qual.phone_confidence,
        is_whatsapp_ready: qual.is_whatsapp_ready,
      });
    } else if (companyRejected) {
      await emitRevenueEvent(admin, orgId, "phone_company_rejected", { contact_id: contact.id, audit: qual.audit });
    } else if (status === "phone_only_web") {
      await emitRevenueEvent(admin, orgId, "apollo_phone_only_web", { contact_id: contact.id, audit: qual.audit });
    } else if (status === "not_found") {
      await emitRevenueEvent(admin, orgId, "apollo_phone_not_found", { contact_id: contact.id, audit: qual.audit });
    }
  }

  if (apolloPersonId && !contact.apollo_person_id) {
    try { await admin.from("enriched_contact_profiles").update({ apollo_person_id: apolloPersonId }).eq("id", contact.id); } catch { /* noop */ }
  }

  try { if (prospectId) await admin.rpc("resolve_primary_contact", { p_prospect_id: prospectId }); } catch { /* noop */ }

  try {
    await admin.from("apollo_reveal_audit").update({
      raw_response: {
        status: apolloStatus,
        person_id: apolloPersonId,
        match_strategy: strategy,
        provider_request_id: providerRequestId,
        phone_status: phoneResult.status,
        email_status: emailResult.status,
      },
      phone_source_type: phoneResult.source_type ?? null,
    }).eq("id", auditId);
  } catch { /* noop */ }

  try {
    await admin.from("kairos_qualified_queue").update({
      phone_revealed: phoneResult.revealed || phoneAlready,
      email_revealed: emailResult.revealed || emailAlready,
    }).eq("prospect_id", prospectId);
  } catch { /* noop */ }

  const overall = overallFrom(phoneResult, emailResult);
  return base({
    overall_status: overall,
    audit_id: auditId,
    credits_used: (phoneResult.credits_used ?? 0) + (emailResult.credits_used ?? 0),
    reason: phoneResult.reason ?? emailResult.reason ?? null,
    success: overall !== "failed",
  });
}

export { computePhoneQuality };
export const _internal = { identityMatches, buildMatchPayload, overallFrom, resolveDomain };
