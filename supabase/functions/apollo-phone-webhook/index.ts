// Recebe callback assíncrono da Apollo com o telefone revelado.
// Apollo chama este endpoint quando reveal_phone_number=true completa.
// URL configurada no body da request à people/match (campo webhook_url).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function pickPhone(person: any): string | null {
  if (!person) return null;
  if (Array.isArray(person.phone_numbers) && person.phone_numbers.length > 0) {
    const p = person.phone_numbers.find((x: any) => x?.sanitized_number) ?? person.phone_numbers[0];
    return p?.sanitized_number ?? p?.raw_number ?? null;
  }
  return person.sanitized_phone ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const contactId = url.searchParams.get("contact_id");
    const token = url.searchParams.get("token");
    const expectedToken = Deno.env.get("APOLLO_WEBHOOK_TOKEN") ?? "";

    if (!contactId) {
      return new Response(JSON.stringify({ error: "contact_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (expectedToken && token !== expectedToken) {
      console.warn("apollo-phone-webhook invalid token", { contactId });
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json().catch(() => ({} as any));
    console.log("apollo-phone-webhook payload", { contactId, keys: Object.keys(payload || {}) });

    // Apollo envia { person: {...} } ou similar — tentar várias formas
    const person = payload?.person ?? payload?.contact ?? payload ?? {};
    const phone = pickPhone(person);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: existing } = await sb
      .from("enriched_contact_profiles")
      .select("id, email, phone, reveal_credits_used")
      .eq("id", contactId)
      .maybeSingle();

    if (!existing) {
      return new Response(JSON.stringify({ error: "contact not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = {
      last_reveal_attempt_at: nowIso,
    };

    if (phone) {
      update.phone = phone;
      update.revealed_at = nowIso;
      update.reveal_status = existing.email ? "revealed" : "partial";
      update.reveal_credits_used = ((existing as any).reveal_credits_used ?? 0) + 1;
    } else {
      // Sem telefone — manter status anterior se já tinha email
      update.reveal_status = existing.email ? "partial" : "no_data";
    }

    await sb.from("enriched_contact_profiles").update(update).eq("id", contactId);

    await sb.from("enrichment_jobs").insert({
      provider: "apollo_phone_webhook",
      status: phone ? "done" : "no_data",
      trigger_source: "system",
      credits_used: phone ? 1 : 0,
      response_summary: { contact_id: contactId, revealed_phone: !!phone },
      response: { payload_sample: { person_id: person?.id ?? null, has_phone: !!phone } },
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
