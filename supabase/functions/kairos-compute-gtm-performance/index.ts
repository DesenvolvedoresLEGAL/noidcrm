// kairos-compute-gtm-performance — KAI.17
// Lê kairos_gtm_performance_summary e devolve agregado por organização.
// Idempotente. Aceita organization_id opcional (cron passa vazio e itera).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key);

    let body: { organization_id?: string } = {};
    try { body = await req.json(); } catch { /* cron */ }

    const orgIds: string[] = [];
    if (body.organization_id) {
      orgIds.push(body.organization_id);
    } else {
      const { data } = await admin
        .from("kairos_qualified_queue")
        .select("organization_id")
        .limit(2000);
      const seen = new Set<string>();
      for (const r of data ?? []) {
        const id = (r as { organization_id?: string }).organization_id;
        if (id && !seen.has(id)) { seen.add(id); orgIds.push(id); }
      }
    }

    const results: Array<{ organization_id: string; totals: unknown; error?: string }> = [];
    for (const id of orgIds) {
      const { data, error } = await admin.rpc("fn_kairos_compute_gtm_performance", {
        p_organization_id: id,
      });
      if (error) {
        results.push({ organization_id: id, totals: null, error: error.message });
      } else {
        results.push({ organization_id: id, totals: data });
      }
    }
    return json(200, { processed: orgIds.length, results });
  } catch (err) {
    console.error("[kairos-compute-gtm-performance]", err);
    return json(500, { error: err instanceof Error ? err.message : "internal" });
  }
});
