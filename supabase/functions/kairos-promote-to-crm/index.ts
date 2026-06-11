// kairos-promote-to-crm
// Promove um item ready_for_sdr da Qualified Queue para o CRM.
// Reutiliza RPC import_prospect_to_pipeline. Cria task inicial para SDR.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const userId = userRes.user.id;

    const { queue_id } = await req.json();
    if (!queue_id) return json(400, { error: "queue_id required" });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: item, error: iErr } = await admin
      .from("kairos_qualified_queue").select("*").eq("id", queue_id).maybeSingle();
    if (iErr) throw iErr;
    if (!item) return json(404, { error: "queue item not found" });

    if (item.qualification_status !== "ready_for_sdr" && !item.sdr_ready) {
      return json(409, {
        error: "Item não está pronto para SDR. Complete enriquecimento, decisor, contato e score ≥ 60.",
      });
    }
    if (item.qualification_status === "imported") {
      return json(409, { error: "Item já foi importado." });
    }

    // Promote via existing RPC
    const { data: importResult, error: rpcErr } = await admin.rpc("import_prospect_to_pipeline", {
      p_prospect_id: item.prospect_id,
      p_target_pipeline_type: "qualification",
    });
    if (rpcErr) throw rpcErr;

    const result = importResult as {
      account_id: string;
      opportunity_id: string;
      contact_id: string | null;
    };

    // Create initial SDR task (best-effort, schema-compatible insert)
    try {
      await admin.from("activities").insert({
        organization_id: item.organization_id,
        opportunity_id: result.opportunity_id,
        account_id: result.account_id,
        contact_id: result.contact_id,
        title: `Primeiro contato — ${item.company_name}`,
        description: "Lead promovido da Qualified Queue. Abordagem inicial recomendada (ver brief no Kairós).",
        type: "call",
        status: "pending",
        created_by: userId,
        owner_id: userId,
      } as any);
    } catch (e) {
      console.warn("[promote] failed to create activity", e);
    }

    const { data: updated, error: uErr } = await admin
      .from("kairos_qualified_queue")
      .update({
        qualification_status: "imported",
        imported_at: new Date().toISOString(),
        imported_account_id: result.account_id,
        imported_opportunity_id: result.opportunity_id,
        imported_contact_id: result.contact_id,
      })
      .eq("id", queue_id)
      .select("*")
      .single();
    if (uErr) throw uErr;

    return json(200, { item: updated, crm: result });
  } catch (err) {
    console.error("[kairos-promote-to-crm]", err);
    return json(500, { error: err instanceof Error ? err.message : "internal" });
  }
});
