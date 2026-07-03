// Apollo per-contact reveal — calls people/match to unlock email + phone for a single contact.
// Consumes Apollo credits. Anti-spam: 24h cooldown per contact.
// KAI.18.10 — Usa classificador compartilhado para mapear TODOS os campos possíveis
// de telefone (mobile/direct/personal/company) e persiste metadados completos.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { computePhoneQuality } from "../_shared/apollo-phone-classifier.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APOLLO_MATCH_URL = "https://api.apollo.io/api/v1/people/match";
const APOLLO_TIMEOUT_MS = 12_000;
const ANTI_SPAM_HOURS = 24;

interface RevealBody {
  contact_id?: string;
}


Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!APOLLO_API_KEY) {
      return new Response(JSON.stringify({ error: "APOLLO_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: validate JWT and resolve user/org
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as RevealBody;
    const contact_id = body.contact_id;
    if (!contact_id) {
      return new Response(JSON.stringify({ error: "contact_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Load contact + prospect
    const { data: contact, error: cErr } = await sb
      .from("enriched_contact_profiles")
      .select(
        "id, prospect_id, workspace_id, first_name, last_name, full_name, email, phone, phone_revealed, phone_reveal_status, email_revealed, apollo_person_id, last_reveal_attempt_at, revealed_at, reveal_credits_used",
      )
      .eq("id", contact_id)
      .maybeSingle();

    if (cErr || !contact) {
      return new Response(JSON.stringify({ error: "contact not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: prospect, error: pErr } = await sb
      .from("prospects")
      .select("id, organization_id, company_name, normalized_domain, website")
      .eq("id", contact.prospect_id!)
      .maybeSingle();
    if (pErr) console.warn("reveal-apollo-contact prospect lookup warning:", pErr.message);

    const tenantId = prospect?.organization_id ?? contact.workspace_id;
    if (!tenantId || (prospect?.organization_id && contact.workspace_id && prospect.organization_id !== contact.workspace_id)) {
      console.warn("reveal-apollo-contact tenant mismatch", {
        contact_id,
        contact_workspace_id: contact.workspace_id,
        prospect_organization_id: prospect?.organization_id ?? null,
      });
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tenant guard: ensure user belongs to this organization.
    // Older rows can reference either auth.users.id or profiles.id, so validate both safely.
    const { data: profileRows } = await sb
      .from("profiles")
      .select("id, user_id, organization_id, email")
      .or(`user_id.eq.${userRes.user.id},id.eq.${userRes.user.id}`)
      .limit(5);
    const candidateUserIds = Array.from(new Set([
      userRes.user.id,
      ...((profileRows ?? []).flatMap((p: any) => [p.id, p.user_id]).filter(Boolean) as string[]),
    ]));
    const { data: membership } = await sb
      .from("organization_members")
      .select("organization_id")
      .eq("organization_id", tenantId)
      .in("user_id", candidateUserIds)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();
    const profileMatchesTenant = (profileRows ?? []).some((p: any) => p.organization_id === tenantId);
    if (!membership && !profileMatchesTenant) {
      console.warn("reveal-apollo-contact forbidden", {
        contact_id,
        tenant_id: tenantId,
        auth_user_id: userRes.user.id,
        auth_email: userRes.user.email ?? null,
        candidate_user_ids: candidateUserIds,
      });
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // KAI.18.10 — Se telefone e email já foram revelados/persistidos pelo enrichment,
    // não chamar Apollo de novo (sem consumir crédito).
    const alreadyEmail = !!(contact.email && (contact as any).email_revealed);
    const alreadyPhone = !!(contact.phone && (contact as any).phone_revealed);
    if (alreadyEmail && alreadyPhone) {
      return new Response(
        JSON.stringify({
          status: "skipped",
          reason: "Contato já possui e-mail e telefone revelados pelo enrichment (sem custo extra).",
          email: contact.email,
          phone: contact.phone,
          credits_used: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Anti-spam: 24h cooldown only when the contact is already complete.
    // If email arrived but phone is still missing, allow a new phone reveal attempt.
    const cutoff = new Date(Date.now() - ANTI_SPAM_HOURS * 3600 * 1000).toISOString();
    if (contact.last_reveal_attempt_at && contact.last_reveal_attempt_at >= cutoff && contact.email && contact.phone) {
      return new Response(
        JSON.stringify({
          status: "skipped",
          reason: "Contato já foi revelado nas últimas 24h.",
          email: contact.email,
          phone: contact.phone,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build Apollo payload — prefer apollo_person_id, otherwise identify by name+domain
    // IMPORTANT: Apollo exige webhook_url HTTPS público quando reveal_phone_number=true (telefone é assíncrono).
    const webhookToken = Deno.env.get("APOLLO_WEBHOOK_TOKEN") ?? "";
    const webhookBase = `${SUPABASE_URL}/functions/v1/apollo-phone-webhook`;
    const webhookUrl = `${webhookBase}?contact_id=${encodeURIComponent(contact_id)}${webhookToken ? `&token=${encodeURIComponent(webhookToken)}` : ""}`;

    const payload: Record<string, unknown> = {
      reveal_personal_emails: !contact.email,
      reveal_phone_number: true,
      webhook_url: webhookUrl,
    };
    if (contact.apollo_person_id) {
      payload.id = contact.apollo_person_id;
    } else {
      if (contact.first_name) payload.first_name = contact.first_name;
      if (contact.last_name) payload.last_name = contact.last_name;
      if (!payload.first_name && contact.full_name) payload.name = contact.full_name;
      if (prospect?.company_name) payload.organization_name = prospect.company_name;
      const domain =
        prospect?.normalized_domain ??
        (prospect?.website
          ? (() => {
              try {
                const u = new URL(prospect.website!.startsWith("http") ? prospect.website! : `https://${prospect.website}`);
                return u.hostname.replace(/^www\./, "");
              } catch {
                return null;
              }
            })()
          : null);
      if (domain) payload.domain = domain;
    }

    // Call Apollo
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), APOLLO_TIMEOUT_MS);
    let apolloResp: any = null;
    let apolloStatus = 0;
    let apolloOk = false;
    let apolloError: string | undefined;
    try {
      const r = await fetch(APOLLO_MATCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "x-api-key": APOLLO_API_KEY,
        },
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
      const inaccessible = apolloStatus === 401 || apolloStatus === 403 || apolloResp?.error_code === "API_INACCESSIBLE";
      const errMsg = inaccessible
        ? "Sua chave Apollo não tem acesso ao endpoint people/match. Habilite no plano da Apollo."
        : apolloError ?? "Falha ao consultar Apollo.";

      await sb.from("enriched_contact_profiles").update({
        last_reveal_attempt_at: nowIso,
        reveal_status: "failed",
      }).eq("id", contact_id);

      await sb.from("enrichment_jobs").insert({
        workspace_id: contact.workspace_id,
        prospect_id: contact.prospect_id,
        provider: "apollo_reveal",
        status: "failed",
        trigger_source: "user",
        credits_used: 0,
        contacts_found: 0,
        error: errMsg,
        request: { contact_id, payload: { ...payload, _scrubbed: true } },
        response: { status: apolloStatus, body: apolloResp },
        response_summary: { error: true, inaccessible },
        completed_at: nowIso,
      });

      return new Response(
        JSON.stringify({ status: "failed", reason: errMsg, inaccessible }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const person = apolloResp?.person ?? null;
    const revealedEmail = person?.email ?? null;
    const revealedPhone = pickPhone(person);
    const apolloPersonId = person?.id ?? person?.person_id ?? contact.apollo_person_id ?? null;

    // Apollo charges roughly 1 credit per email + 1 per phone reveal. Approximate when missing actual cost.
    // Telefone é assíncrono — virá pelo webhook (apollo-phone-webhook). Cobramos só email aqui.
    const phonePending = !revealedPhone; // se não veio síncrono, está pendente via webhook
    const creditsCharged = (revealedEmail ? 1 : 0) + (revealedPhone ? 1 : 0);

    let nextStatus: string;
    if (revealedEmail && revealedPhone) nextStatus = "revealed";
    else if (phonePending) nextStatus = "pending"; // telefone virá pelo webhook, mesmo quando o e-mail já veio síncrono
    else if (revealedEmail || revealedPhone) nextStatus = "partial";
    else nextStatus = "no_data";

    const update: Record<string, unknown> = {
      last_reveal_attempt_at: nowIso,
      reveal_status: nextStatus,
      reveal_credits_used: (contact as any).reveal_credits_used != null ? undefined : creditsCharged,
    };
    if (revealedEmail) update.email = revealedEmail;
    if (person?.email_status) update.email_status = person.email_status;
    if (revealedPhone) update.phone = revealedPhone;
    if (apolloPersonId && !contact.apollo_person_id) update.apollo_person_id = apolloPersonId;
    if (revealedEmail || revealedPhone) update.revealed_at = nowIso;

    // Increment credits via separate call to avoid overwriting accumulated value
    if (creditsCharged > 0) {
      await sb.rpc("increment_contact_reveal_credits", {
        p_contact_id: contact_id,
        p_credits: creditsCharged,
      }).then(() => {}, () => {
        // Fallback if RPC not present: set absolute value
        update.reveal_credits_used = ((contact as any).reveal_credits_used ?? 0) + creditsCharged;
      });
    }
    delete update.reveal_credits_used;
    if (creditsCharged > 0) {
      // Always add fallback to ensure persistence even without RPC
      update.reveal_credits_used = ((contact as any).reveal_credits_used ?? 0) + creditsCharged;
    }

    await sb.from("enriched_contact_profiles").update(update).eq("id", contact_id);

    // Re-resolve primary in case this newly revealed contact now has higher score
    try {
      await sb.rpc("resolve_primary_contact", { p_prospect_id: contact.prospect_id });
    } catch (_) { /* noop */ }

    await sb.from("enrichment_jobs").insert({
      workspace_id: contact.workspace_id,
      prospect_id: contact.prospect_id,
      provider: "apollo_reveal",
      status: "done",
      trigger_source: "user",
      credits_used: creditsCharged,
      contacts_found: revealedEmail || revealedPhone ? 1 : 0,
      decision_makers_found: 0,
      response: { status: apolloStatus, person_id: apolloPersonId },
      response_summary: {
        contact_id,
        revealed_email: !!revealedEmail,
        revealed_phone: !!revealedPhone,
        reveal_status: nextStatus,
      },
      completed_at: nowIso,
    });

    return new Response(
      JSON.stringify({
        status: nextStatus,
        contact_id,
        email: revealedEmail,
        phone: revealedPhone,
        credits_used: creditsCharged,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("reveal-apollo-contact error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
