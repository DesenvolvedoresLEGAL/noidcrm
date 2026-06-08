// Recebe callback assíncrono da Apollo com o telefone revelado.
// Apollo chama este endpoint quando reveal_phone_number=true completa.
// URL configurada no body da request à people/match (campo webhook_url).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function pickPhone(record: any): string | null {
  if (!record) return null;

  const candidates = [
    record.phone,
    record.sanitized_phone,
    record.mobile_phone,
    record.mobile,
    record.organization?.phone,
    record.account?.phone,
  ].filter(Boolean);

  if (Array.isArray(record.phone_numbers)) {
    const preferred =
      record.phone_numbers.find((x: any) => x?.type === "mobile" && (x?.sanitized_number || x?.raw_number || x?.number)) ??
      record.phone_numbers.find((x: any) => x?.sanitized_number || x?.raw_number || x?.number) ??
      record.phone_numbers[0];
    candidates.unshift(preferred?.sanitized_number, preferred?.raw_number, preferred?.number, preferred?.value);
  }

  if (Array.isArray(record.phone_numbers_for_person)) {
    const preferred = record.phone_numbers_for_person.find((x: any) => x?.sanitized_number || x?.raw_number || x?.number) ?? record.phone_numbers_for_person[0];
    candidates.unshift(preferred?.sanitized_number, preferred?.raw_number, preferred?.number, preferred?.value);
  }

  const phone = candidates.find((value) => typeof value === "string" && value.trim().length >= 6);
  return phone ? String(phone).trim() : null;
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
    records.find((p: any) => pickPhone(p)) ??
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
    // Fail-closed: reject if the shared secret is not configured or doesn't match.
    if (!expectedToken || !token || token !== expectedToken) {
      console.warn("apollo-phone-webhook invalid/missing token", {
        contactId,
        secret_configured: !!expectedToken,
      });
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
      .select("id, workspace_id, prospect_id, email, phone, reveal_credits_used, apollo_person_id")
      .eq("id", contactId)
      .maybeSingle();

    if (!existing) {
      return new Response(JSON.stringify({ error: "contact not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json().catch(() => ({} as any));
    const person = extractPerson(payload, contactId, (existing as any).apollo_person_id);
    const phone = pickPhone(person);
    const creditsConsumed = Number(payload?.credits_consumed ?? payload?.credits_used ?? 0) || (phone ? 1 : 0);
    console.log("apollo-phone-webhook payload", {
      contactId,
      keys: Object.keys(payload || {}),
      people_count: Array.isArray(payload?.people) ? payload.people.length : 0,
      picked_person_id: person?.id ?? person?.person_id ?? null,
      phone_received: !!phone,
    });

    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = {
      last_reveal_attempt_at: nowIso,
    };

    if (phone) {
      update.phone = phone;
      update.revealed_at = nowIso;
      update.reveal_status = existing.email ? "revealed" : "partial";
      update.reveal_credits_used = ((existing as any).reveal_credits_used ?? 0) + creditsConsumed;
    } else {
      // Sem telefone — manter status anterior se já tinha email
      update.reveal_status = existing.email ? "partial" : "no_data";
    }

    const { error: updateError } = await sb.from("enriched_contact_profiles").update(update).eq("id", contactId);
    if (updateError) {
      console.error("apollo-phone-webhook update error", updateError);
      return new Response(JSON.stringify({ error: "failed to update contact" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sb.from("enrichment_jobs").insert({
      workspace_id: (existing as any).workspace_id,
      prospect_id: (existing as any).prospect_id,
      provider: "apollo_phone_webhook",
      status: phone ? "done" : "no_data",
      trigger_source: "system",
      credits_used: creditsConsumed,
      response_summary: { contact_id: contactId, revealed_phone: !!phone },
      response: {
        payload_sample: {
          status: payload?.status ?? null,
          person_id: person?.id ?? person?.person_id ?? null,
          has_phone: !!phone,
          people_count: Array.isArray(payload?.people) ? payload.people.length : 0,
        },
      },
      completed_at: nowIso,
    });

    return new Response(JSON.stringify({ ok: true, phone_received: !!phone }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("apollo-phone-webhook error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
