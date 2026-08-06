// kairos-apollo-reveal-status-sync (KAI.18.13)
// Reconcilia jobs de reveal que ficaram aguardando o provider.
// NUNCA repete operação paga: consulta o status do enrich existente e expira o que estourou prazo.
// Executada por cron (1-2 min) com claim/lock via fn_claim_apollo_reveal_jobs (SKIP LOCKED).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { computePhoneQuality, finalizeField } from "../_shared/apollo-reveal-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const MAX_ATTEMPTS = 12;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const internalSecret = req.headers.get("x-internal-secret");
  const expectedSecret = Deno.env.get("INTERNAL_WORKFLOW_SECRET");
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return json(401, { error: "Unauthorized" });
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
      if (!contactId) {
        await sb.from("enrichment_jobs").update({
          status: "failed", error: "missing_contact_id", reconciliation_required: false,
          completed_at: new Date().toISOString(), locked_at: null, locked_by: null,
        }).eq("id", job.id);
        results.push({ job_id: job.id, outcome: "failed_no_contact" });
        continue;
      }

      // Expiração: nunca deixa contato eternamente "buscando"
      const expired = job.expires_at ? new Date(job.expires_at).getTime() < Date.now() : false;
      const exhausted = (job.attempt_count ?? 0) >= MAX_ATTEMPTS;
      if (expired || exhausted) {
        await finalizeField(sb, {
          contact_id: contactId,
          field,
          outcome: "failed",
          job_id: job.id,
          credits_used: 0,
          credits_confirmed: 0,
          reason: "provider_timeout",
        });
        results.push({ job_id: job.id, outcome: "provider_timeout" });
        continue;
      }

      // Já foi resolvido por webhook enquanto o job seguia pendente?
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

      // Recuperação a partir de payload já pago (sem nova cobrança)
      let recovered: string | null = null;
      let recoveredMeta: Record<string, unknown> = {};
      if (field === "phone" && contact.apollo_person_id) {
        try {
          const { data: audits } = await sb
            .from("apollo_reveal_audit")
            .select("id, raw_response, phone_after, contact_id")
            .eq("contact_id", contactId)
            .order("created_at", { ascending: false })
            .limit(5);
          for (const a of (audits ?? []) as any[]) {
            const raw = a.raw_response ?? {};
            const rawPersonId = raw?.person_id ?? null;
            if (rawPersonId && String(rawPersonId) !== String(contact.apollo_person_id)) continue;
            // KAI.18.14 — reprocessa o payload PAGO inteiro (sem nova cobrança).
            const extraPayloads: any[] = [];
            if (a.phone_after) extraPayloads.push({ phone_numbers: [{ sanitized_number: a.phone_after }] });
            const qual = computePhoneQuality(raw, [], "apollo", { extraPayloads });
            if (qual.phone) {
              recovered = qual.phone;
              recoveredMeta = {
                phone_source: qual.phone_source,
                phone_type: qual.phone_type,
                phone_match_quality: qual.phone_match_quality,
                phone_confidence: qual.phone_confidence,
                phone_source_type: qual.phone_match_quality,
                phone_quality_reason: "recovered_from_existing_payload",
                is_whatsapp_ready: qual.is_whatsapp_ready,
                phone_candidates_audit: qual.audit,
              };
              break;
            }
          }
        } catch { /* noop */ }
      }

      if (recovered) {
        const out = await finalizeField(sb, {
          contact_id: contactId,
          field,
          outcome: "revealed",
          job_id: job.id,
          value: recovered,
          metadata: recoveredMeta,
          credits_used: 0,
          credits_confirmed: 0,
          reason: "recovered_from_existing_payload",
        });
        results.push({ job_id: job.id, outcome: out.status, recovered: true });
        continue;
      }

      // Sem novidade: mantém pendente até expirar (backoff já aplicado no claim).
      if (!APOLLO_API_KEY) {
        results.push({ job_id: job.id, outcome: "still_pending_no_key" });
      } else {
        results.push({ job_id: job.id, outcome: "still_pending" });
      }
      await sb.from("enrichment_jobs").update({
        status: "pending_provider",
        reconciliation_required: false,
        locked_at: null,
        locked_by: null,
      }).eq("id", job.id);
    }

    return json(200, { ok: true, processed: results.length, results });
  } catch (e) {
    console.error("kairos-apollo-reveal-status-sync error:", e);
    return json(500, { error: "sync_failed" });
  }
});
