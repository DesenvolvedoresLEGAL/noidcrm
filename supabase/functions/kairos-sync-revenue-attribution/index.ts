// kairos-sync-revenue-attribution
// Reconcilia atribuições Kairós com propostas + vendas oficiais (commercial_won_revenue_view).
// Idempotente. Pode ser chamada por trigger, UI ou cron.
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
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("INTERNAL_WORKFLOW_SECRET");
    if (!expectedSecret || internalSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    let body: { opportunity_id?: string; organization_id?: string; limit?: number } = {};
    try { body = await req.json(); } catch { /* cron / empty */ }

    const opportunityIds: string[] = [];

    if (body.opportunity_id) {
      opportunityIds.push(body.opportunity_id);
    } else {
      // Bulk mode: opportunities with Kairós attribution, ordered by recent activity.
      let q = admin
        .from("kairos_revenue_attribution")
        .select("opportunity_id, organization_id")
        .not("opportunity_id", "is", null)
        .order("updated_at", { ascending: true })
        .limit(body.limit ?? 500);
      if (body.organization_id) q = q.eq("organization_id", body.organization_id);
      const { data, error } = await q;
      if (error) throw error;
      for (const r of data ?? []) {
        if (r.opportunity_id) opportunityIds.push(r.opportunity_id);
      }
    }

    let processed = 0;
    let updated = 0;
    let failed = 0;

    for (const oppId of opportunityIds) {
      processed++;
      const { data, error } = await admin.rpc("fn_kairos_sync_attribution", {
        p_opportunity_id: oppId,
      });
      if (error) {
        failed++;
        console.error("[kairos-sync-revenue-attribution]", oppId, error.message);
        continue;
      }
      if (data) updated++;
    }

    return json(200, { processed, updated, failed });
  } catch (err) {
    console.error("[kairos-sync-revenue-attribution]", err);
    return json(500, { error: err instanceof Error ? err.message : "internal" });
  }
});
