// Edge Function: cron-index-emails
// Roda periodicamente e dispara index-email-knowledge em modo incremental
// para cada organização ativa.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Find orgs with at least one outbound email in the last 48h
    const sinceIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: orgRows, error: orgErr } = await supabase
      .from("opportunity_emails")
      .select("organization_id")
      .gte("sent_at", sinceIso)
      .eq("direction", "outbound");

    if (orgErr) throw orgErr;

    const orgIds = Array.from(
      new Set((orgRows || []).map((r: any) => r.organization_id).filter(Boolean)),
    );

    const results: Array<{ org: string; ok: boolean; result?: unknown; error?: string }> = [];

    for (const orgId of orgIds) {
      try {
        const { data, error } = await supabase.functions.invoke(
          "index-email-knowledge",
          {
            body: {
              mode: "incremental",
              organization_id: orgId,
              since_hours: 48,
              limit: 200,
            },
          },
        );
        if (error) throw error;
        results.push({ org: orgId, ok: true, result: data });
      } catch (e) {
        results.push({ org: orgId, ok: false, error: (e as Error).message });
      }
      // small delay between orgs
      await new Promise((r) => setTimeout(r, 200));
    }

    return new Response(
      JSON.stringify({
        success: true,
        organizations_processed: orgIds.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[cron-index-emails] error", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
