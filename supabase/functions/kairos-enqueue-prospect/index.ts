// kairos-enqueue-prospect
// Insere/atualiza um prospect na Qualified Queue.
// Roda matching CRM, define status inicial e dispara cálculo de score via trigger.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body { prospect_id: string }

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return json(401, { error: "Unauthorized" });

    const body = (await req.json()) as Body;
    if (!body?.prospect_id) return json(400, { error: "prospect_id required" });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: prospect, error: pErr } = await admin
      .from("prospects").select("*").eq("id", body.prospect_id).maybeSingle();
    if (pErr) throw pErr;
    if (!prospect) return json(404, { error: "prospect not found" });

    // Run matching (best-effort)
    let relationship = prospect.relationship_status as string | null;
    let confidence = Number(prospect.confidence ?? 0);
    try {
      const matchResp = await admin.functions.invoke("kairos-match-company", {
        body: {
          prospect_id: prospect.id,
          company_name: prospect.company_name,
          cnpj: prospect.cnpj,
          domain: prospect.normalized_domain,
        },
        headers: { Authorization: authHeader },
      });
      const m = matchResp?.data as { relationship_status?: string; confidence?: number } | null;
      if (m?.relationship_status) relationship = m.relationship_status;
      if (typeof m?.confidence === "number") confidence = m.confidence;
    } catch (e) { console.warn("[enqueue] matching failed", e); }

    let initialStatus: string = "captured";
    let reviewReason: string | null = null;
    if (relationship === "customer") { initialStatus = "existing_customer"; reviewReason = "Cliente existente"; }
    else if (relationship === "opportunity_existing") { initialStatus = "human_review"; reviewReason = "Oportunidade já aberta"; }
    else if (relationship === "account_existing") { initialStatus = "existing_account"; }
    if (prospect.duplicate_candidate) { initialStatus = "duplicate"; reviewReason = reviewReason ?? "Possível duplicado"; }
    if (!prospect.website && !prospect.normalized_domain && !prospect.cnpj) {
      initialStatus = "human_review";
      reviewReason = reviewReason ?? "Empresa sem identidade mínima";
    }

    const payload = {
      organization_id: prospect.organization_id,
      prospect_id: prospect.id,
      company_name: prospect.company_name,
      domain: prospect.normalized_domain ?? null,
      source: prospect.source_label ?? null,
      source_type: prospect.event_name ? "event" : (prospect.source_label ?? null),
      relationship_status: relationship ?? "new_prospect",
      confidence,
      icp_match: !!prospect.icp_profile_id,
      enrichment_status: prospect.enrichment_status ?? null,
      decision_maker_status: prospect.decision_maker_found ? "found" : null,
      contact_status: prospect.email_public ? "revealed" : null,
      qualification_status: initialStatus,
      review_reason: reviewReason,
    };

    const { data: upserted, error: upErr } = await admin
      .from("kairos_qualified_queue")
      .upsert(payload, { onConflict: "organization_id,prospect_id" })
      .select("*")
      .single();
    if (upErr) throw upErr;

    return json(200, { item: upserted });
  } catch (err) {
    console.error("[kairos-enqueue-prospect]", err);
    return json(500, { error: err instanceof Error ? err.message : "internal" });
  }
});
