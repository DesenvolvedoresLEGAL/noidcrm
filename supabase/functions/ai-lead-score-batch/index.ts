// Background batch enrichment for top accounts.
// Default strategy: top 200 accounts by deterministic fit_score, processed
// in concurrent batches of 5. Tracks progress in score_recalc_jobs (entity_type='ai_analysis').

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_TOP_N = 200;
const BATCH_CONCURRENCY = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { organizationId, topN = DEFAULT_TOP_N, jobId } = await req.json();
    if (!organizationId) {
      return new Response(JSON.stringify({ error: "organizationId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Create or reuse job row
    let activeJobId = jobId as string | undefined;
    if (!activeJobId) {
      const { data: jobRow, error: jobErr } = await supabase
        .from("score_recalc_jobs")
        .insert({
          organization_id: organizationId,
          entity_type: "ai_analysis",
          status: "queued",
        })
        .select("id")
        .single();
      if (jobErr) {
        console.error("[ai-lead-score-batch] Job insert err:", jobErr);
        return new Response(JSON.stringify({ error: jobErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      activeJobId = jobRow!.id as string;
    }

    const work = runBatch(supabase, organizationId, activeJobId!, Number(topN));
    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(work);
    } else {
      work.catch((e) => console.error("[ai-lead-score-batch] failed:", e));
    }

    return new Response(
      JSON.stringify({ success: true, jobId: activeJobId, status: "queued" }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[ai-lead-score-batch] Error:", error);
    return new Response(JSON.stringify({ error: String(error?.message || error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function runBatch(
  supabase: any,
  organizationId: string,
  jobId: string,
  topN: number,
) {
  let processed = 0;
  let errors = 0;
  let lastError: string | null = null;

  try {
    // Pick top N accounts by deterministic fit_score (already computed in Phase 1)
    const { data: accounts, error: accErr } = await supabase
      .from("accounts")
      .select("id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("fit_score", { ascending: false, nullsFirst: false })
      .order("intent_score", { ascending: false, nullsFirst: false })
      .limit(topN);

    if (accErr) throw accErr;
    const ids = (accounts || []).map((a: any) => a.id);
    const total = ids.length;

    await supabase
      .from("score_recalc_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        total_count: total,
        processed_count: 0,
        error_count: 0,
      })
      .eq("id", jobId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    for (let i = 0; i < ids.length; i += BATCH_CONCURRENCY) {
      const batch = ids.slice(i, i + BATCH_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((accountId: string) =>
          fetch(`${supabaseUrl}/functions/v1/ai-lead-score-analyze`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ accountId, triggeredBy: "batch" }),
          }).then(async (r) => {
            if (!r.ok) {
              const text = await r.text();
              throw new Error(`status=${r.status} ${text.slice(0, 200)}`);
            }
            return r.json();
          })
        ),
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          processed++;
        } else {
          errors++;
          lastError = String(r.reason).slice(0, 500);
          console.error("[ai-lead-score-batch] item error:", r.reason);
        }
      }

      await supabase
        .from("score_recalc_jobs")
        .update({
          processed_count: processed,
          error_count: errors,
          last_error: lastError,
        })
        .eq("id", jobId);

      // Tiny delay between batches to be gentle on the LLM gateway
      await new Promise((r) => setTimeout(r, 250));
    }

    await supabase
      .from("score_recalc_jobs")
      .update({
        status: "completed",
        processed_count: processed,
        error_count: errors,
        last_error: lastError,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    console.log(
      `[ai-lead-score-batch ${jobId}] done processed=${processed} errors=${errors}`,
    );
  } catch (e: any) {
    console.error(`[ai-lead-score-batch ${jobId}] fatal:`, e);
    await supabase
      .from("score_recalc_jobs")
      .update({
        status: "failed",
        last_error: String(e?.message || e).slice(0, 500),
        processed_count: processed,
        error_count: errors + 1,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }
}
