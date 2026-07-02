// Recebe callback assíncrono da Apollo com o telefone revelado.
// Apollo chama este endpoint quando reveal_phone_number=true completa.
// KAI.15.1 phone quality: rejeita telefones corporativos, aceita só mobile/direct pessoais.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { classifyApolloPhone } from "../_shared/apollo-phone-classifier.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

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
    const token = url.searchParams.get("token");
    const expectedToken = Deno.env.get("APOLLO_WEBHOOK_TOKEN");

    if (!contactId) {
      return new Response(JSON.stringify({ error: "contact_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!expectedToken || !token || token !== expectedToken) {
      console.warn("apollo-phone-webhook invalid/missing token", { contactId, secret_configured: !!expectedToken });
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: existing } = await sb
      .from("enriched_contact_profiles")
      .select("id, workspace_id, prospect_id, email, phone, email_revealed, phone_revealed, phone_credits_used, reveal_credits_used, apollo_person_id, linkedin_url")
      .eq("id", contactId)
      .maybeSingle();

    if (!existing) {
      return new Response(JSON.stringify({ error: "contact not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Company phones to reject
    const extraCompanyPhones: string[] = [];
    if ((existing as any).prospect_id) {
      try {
        const { data: comp } = await sb
          .from("enriched_company_profiles")
          .select("phone")
          .eq("prospect_id", (existing as any).prospect_id)
          .maybeSingle();
        if (comp?.phone) extraCompanyPhones.push(String(comp.phone));
      } catch { /* noop */ }
    }

    const payload = await req.json().catch(() => ({} as any));
    const person = extractPerson(payload, contactId, (existing as any).apollo_person_id);
    const cls = classifyApolloPhone(person, extraCompanyPhones);
    const phone = cls.phone;
    const phoneSourceType = cls.sourceType;
    const companyPhoneRejected = !phone && !!cls.rejectedCompanyPhone;
    const creditsConsumed = Number(payload?.credits_consumed ?? payload?.credits_used ?? 0) || (phone ? 1 : 0);

    console.log("apollo-phone-webhook payload", {
      contactId,
      keys: Object.keys(payload || {}),
      picked_person_id: person?.id ?? person?.person_id ?? null,
      phone_source_type: phoneSourceType,
      accepted: !!phone,
      company_rejected: companyPhoneRejected,
    });

    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = { last_reveal_attempt_at: nowIso };

    if (phone) {
      update.phone = phone;
      update.revealed_at = nowIso;
      update.reveal_status = existing.email ? "revealed" : "partial";
      update.reveal_credits_used = ((existing as any).reveal_credits_used ?? 0) + creditsConsumed;
      update.phone_revealed = true;
      update.phone_reveal_status = "revealed";
      update.phone_revealed_at = nowIso;
      update.phone_source_type = phoneSourceType;
      update.phone_credits_used = ((existing as any).phone_credits_used ?? 0) + creditsConsumed;
      update.preferred_channel = "whatsapp";
    } else {
      // Sem telefone pessoal — se veio telefone corporativo, marcar como rejeitado.
      update.reveal_status = existing.email ? "partial" : "no_data";
      update.phone_reveal_status = "not_found";
      if (companyPhoneRejected) update.phone_source_type = "company_main";
      if (!existing.phone_revealed) {
        update.preferred_channel = existing.email_revealed
          ? "email"
          : (existing as any).linkedin_url
            ? "linkedin"
            : "unknown";
      }
    }

    const { error: updateError } = await sb.from("enriched_contact_profiles").update(update).eq("id", contactId);
    if (updateError) {
      console.error("apollo-phone-webhook update error", updateError);
      return new Response(JSON.stringify({ error: "failed to update contact" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atualizar audit pendente mais recente para este contato
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
          status: phone ? "revealed" : "not_found",
          credits_used: creditsConsumed,
          phone_after: phone ?? (pendingAudit as any).phone_before,
          phone_source_type: phoneSourceType,
          reason: companyPhoneRejected ? "company_phone_rejected" : (phone ? null : "no_person_phone_returned"),
          raw_response: {
            webhook: true,
            person_id: person?.id ?? person?.person_id ?? null,
            phone_source_type: phoneSourceType,
            company_phone_rejected: companyPhoneRejected,
            rejected_company_phone: cls.rejectedCompanyPhone ?? null,
          },
        }).eq("id", pendingAudit.id);
      }
    } catch (e) {
      console.warn("apollo-phone-webhook audit update failed:", e);
    }

    if (phone && (existing as any).prospect_id) {
      try { await sb.rpc("resolve_primary_contact", { p_prospect_id: (existing as any).prospect_id }); } catch { /*noop*/ }
    }

    await sb.from("enrichment_jobs").insert({
      workspace_id: (existing as any).workspace_id,
      prospect_id: (existing as any).prospect_id,
      provider: "apollo_phone_webhook",
      status: phone ? "done" : "no_data",
      trigger_source: "system",
      credits_used: creditsConsumed,
      response_summary: {
        contact_id: contactId,
        revealed_phone: !!phone,
        phone_source_type: phoneSourceType,
        company_phone_rejected: companyPhoneRejected,
      },
      response: {
        payload_sample: {
          status: payload?.status ?? null,
          person_id: person?.id ?? person?.person_id ?? null,
          has_phone: !!phone,
          company_phone_rejected: companyPhoneRejected,
        },
      },
      completed_at: nowIso,
    });

    return new Response(JSON.stringify({
      ok: true,
      phone_received: !!phone,
      phone_source_type: phoneSourceType,
      company_phone_rejected: companyPhoneRejected,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("apollo-phone-webhook error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
