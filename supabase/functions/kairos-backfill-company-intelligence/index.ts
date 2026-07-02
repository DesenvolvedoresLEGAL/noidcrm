// KAI.19 — Backfill Company Intelligence for existing prospects
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { organization_id, limit = 50, only_missing = true } = await req.json().catch(() => ({}));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let query = supabase
      .from("kairos_qualified_queue")
      .select("prospect_id, organization_id, company_intelligence_score, updated_at")
      .order("score", { ascending: false })
      .limit(limit);

    if (organization_id) query = query.eq("organization_id", organization_id);
    if (only_missing) query = query.is("company_intelligence_score", null);

    const { data: items, error } = await query;
    if (error) throw error;

    const results: Array<{ prospect_id: string; ok: boolean; error?: string }> = [];
    const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/kairos-compute-company-intelligence`;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    for (const item of items ?? []) {
      try {
        const r = await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({ prospect_id: item.prospect_id }),
        });
        const ok = r.ok;
        await r.text();
        results.push({ prospect_id: item.prospect_id, ok });
      } catch (err) {
        results.push({ prospect_id: item.prospect_id, ok: false, error: (err as Error).message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
