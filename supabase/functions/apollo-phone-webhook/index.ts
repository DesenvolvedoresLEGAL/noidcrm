// apollo-phone-webhook (KAI.18.13)
// Recebe o callback assíncrono do Apollo e finaliza o job ORIGINAL via RPC oficial.
// Nunca cria enrichment_jobs. Anti-replay: job terminal é ignorado.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { computePhoneQuality, finalizeField } from "../_shared/apollo-reveal-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function extractPerson(payload: any, contactId: string, existingApolloId?: string | null): any {
  const records = [
    payload?.person,
    payload?.contact,
    ...(Array.isArray(payload?.people) ? payload.people : []),
    ...(Array.isArray(payload?.contacts) ? payload.contacts : []),
    ...(Array.isArray(payload?.matches) ? payload.matches : []),
    payload,
  ].filter(Boolean);

  return (
    records.find((p: any) => existingApolloId && [p?.id, p?.person_id, p?.apollo_person_id].includes(existingApolloId)) ??
    records.find((p: any) => [p?.contact_id, p?.client_contact_id, p?.external_id].includes(contactId)) ??
    records.find((p: any) => Array.isArray(p?.phone_numbers) && p.phone_numbers.length > 0) ??
    records[0] ??
    {}
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const contactId = url.searchParams.get("contact_id");
    const jobIdParam = url.searchParams.get("job_id");
    const token = url.searchParams.get("token");
    const expectedToken = Deno.env.get("APOLLO_WEBHOOK_TOKEN");

    if (!expectedToken || !token || token !== expectedToken) {
      console.warn("apollo-phone-webhook invalid token", { secret_configured: !!expectedToken });
      return json(403, { error: "forbidden" });
    }
    if (!contactId) return json(400, { error: "contact_id required" });

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: existing } = await sb
      .from("enriched_contact_profiles")
      .select("id, workspace_id, prospect_id, email, phone, phone_revealed, apollo_person_id")
      .eq("id", contactId)
      .maybeSingle();
    if (!existing) return json(404, { error: "contact not found" });

    // Localiza o job ORIGINAL de telefone (nunca cria)
    let job: any = null;
    if (jobIdParam) {
      const { data } = await sb
        .from("enrichment_jobs")
        .select("id, status, contact_id, field, provider_request_id")
        .eq("id", jobIdParam)
        .maybeSingle();
      job = data ?? null;
    }
    if (!job) {
      const { data } = await sb
        .from("enrichment_jobs")
        .select("id, status, contact_id, field, provider_request_id")
        .eq("contact_id", contactId)
        .eq("provider", "apollo_reveal")
        .eq("field", "phone")
        .in("status", ["queued", "running", "pending_provider"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      job = data ?? null;
    }

    // Anti-replay: identidade e estado terminal
    if (job && job.contact_id !== contactId) {
      console.warn("apollo-phone-webhook job/contact mismatch");
      return json(409, { error: "job_contact_mismatch" });
    }
    if (job && !["queued", "running", "pending_provider"].includes(job.status)) {
      return json(200, { ok: true, ignored: "job_already_terminal" });
    }
    if (existing.phone_revealed && existing.phone) {
      return json(200, { ok: true, ignored: "phone_already_revealed" });
    }

    const payload = await req.json().catch(() => ({} as any));
    const person = extractPerson(payload, contactId, existing.apollo_person_id);

    // Identidade: se já conhecemos o apollo_person_id, o retorno precisa bater.
    const personId = person?.id ?? person?.person_id ?? null;
    if (existing.apollo_person_id && personId && String(personId) !== String(existing.apollo_person_id)) {
      console.warn("apollo-phone-webhook identity mismatch");
      return json(409, { error: "identity_mismatch" });
    }

    const extraCompanyPhones: string[] = [];
    if (existing.prospect_id) {
      try {
        const { data: comp } = await sb
          .from("enriched_company_profiles")
          .select("phone")
          .eq("prospect_id", existing.prospect_id)
          .maybeSingle();
        if (comp?.phone) extraCompanyPhones.push(String(comp.phone));
      } catch { /* noop */ }
    }

    const qual = computePhoneQuality(person, extraCompanyPhones, "apollo", { extraPayloads: [payload] });
    const phone = qual.phone;
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
    const providerCredits = Number(payload?.credits_consumed ?? payload?.credits_used ?? NaN);

    console.log("apollo-phone-webhook", {
      contactId,
      job_id: job?.id ?? null,
      accepted: !!phone,
      quality: qual.phone_match_quality,
      company_rejected: companyRejected,
      audit: qual.audit,
    });

    const out = await finalizeField(sb, {
      contact_id: contactId,
      field: "phone",
      outcome: qual.outcome === "pending_provider" ? "not_found" : qual.outcome,
      job_id: job?.id ?? null,
      value: phone,
      metadata: {
        phone_source: qual.phone_source,
        phone_type: qual.phone_type,
        phone_match_quality: qual.phone_match_quality,
        phone_confidence: qual.phone_confidence,
        phone_source_type: sourceType,
        phone_quality_reason: qual.reason,
        phone_validation_status: qual.phone_validation_status,
        is_whatsapp_ready: !!(qual.is_whatsapp_ready && phone),
        apollo_person_id: personId ?? existing.apollo_person_id,
        phone_candidates_audit: qual.audit,
      },
      credits_used: Number.isFinite(providerCredits) ? providerCredits : (phone ? 1 : 0),
      credits_confirmed: Number.isFinite(providerCredits) ? providerCredits : (phone ? 1 : null),
      provider_request_id: payload?.request_id ?? payload?.id ?? null,
      reason: qual.reason,
    });

    // Auditoria: atualiza o registro pendente mais recente do contato
    try {
      const { data: pendingAudit } = await sb
        .from("apollo_reveal_audit")
        .select("id, phone_before")
        .eq("contact_id", contactId)
        .in("status", ["pending", "requested"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pendingAudit?.id) {
        await sb.from("apollo_reveal_audit").update({
          status: out.status,
          phone_after: out.value ?? pendingAudit.phone_before,
          phone_source_type: sourceType,
          phone_source: qual.phone_source,
          phone_type: qual.phone_type,
          phone_match_quality: qual.phone_match_quality,
          phone_confidence: qual.phone_confidence,
          is_whatsapp_ready: !!(qual.is_whatsapp_ready && out.value),
          phone_quality_reason: qual.reason,
          reason: companyRejected ? "company_phone_rejected" : (out.value ? null : "no_person_phone_returned"),
          raw_response: { webhook: true, person_id: personId, phone_source_type: sourceType },
        }).eq("id", pendingAudit.id);
      }
    } catch (e) {
      console.warn("apollo-phone-webhook audit update failed:", e);
    }

    if (out.status === "revealed" && existing.prospect_id) {
      try { await sb.rpc("resolve_primary_contact", { p_prospect_id: existing.prospect_id }); } catch { /* noop */ }
    }

    return json(200, {
      ok: true,
      status: out.status,
      phone_received: out.status === "revealed",
      phone_source_type: sourceType,
      company_phone_rejected: companyRejected,
    });
  } catch (e) {
    console.error("apollo-phone-webhook error:", e);
    return json(500, { error: "webhook_processing_failed" });
  }
});
