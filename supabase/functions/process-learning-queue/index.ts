// Sprint C.1: Drains the learning_queue, applying delayed outcome events
// to update-learning-signals once the anti-overfitting window has elapsed.
//
// Triggered by cron (every 15 min) or manual invocation.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 3;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: pending, error: fetchErr } = await supabase
      .from("learning_queue")
      .select("*")
      .eq("status", "pending")
      .lte("process_after", new Date().toISOString())
      .order("process_after", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) {
      console.error("[process-learning-queue] fetch error:", fetchErr);
      return jsonResponse({ error: fetchErr.message }, 500);
    }

    if (!pending || pending.length === 0) {
      return jsonResponse({ status: "ok", processed: 0, drained: 0 });
    }

    let processed = 0;
    let cancelled = 0;
    let failed = 0;

    for (const entry of pending) {
      try {
        // Re-check contradiction at process time:
        // If a negative event (unsubscribed/bounced) was recorded for the same
        // prospect AFTER this entry was queued, cancel positive learning.
        if (entry.outcome === "positive" && entry.prospect_id) {
          const { data: contradictions } = await supabase
            .from("revenue_events")
            .select("event_type")
            .eq("organization_id", entry.organization_id)
            .eq("prospect_id", entry.prospect_id)
            .in("event_type", ["unsubscribed", "email_bounced", "deal_lost"])
            .gte("created_at", entry.created_at)
            .limit(1);

          if (contradictions && contradictions.length > 0) {
            await supabase.from("learning_queue")
              .update({
                status: "cancelled",
                cancelled_reason: `contradicted_by_${contradictions[0].event_type}`,
                processed_at: new Date().toISOString(),
              })
              .eq("id", entry.id);
            cancelled++;
            continue;
          }
        }

        const attribution = (entry.payload as any)?.attribution ?? {};

        const res = await fetch(`${SUPABASE_URL}/functions/v1/update-learning-signals`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            organization_id: entry.organization_id,
            prospect_id: entry.prospect_id,
            opportunity_id: entry.opportunity_id,
            event_type: entry.event_type,
            outcome: entry.outcome,
            weight: entry.weight,
            attribution,
          }),
        });

        if (!res.ok) throw new Error(`update-learning-signals returned ${res.status}`);

        await supabase.from("learning_queue")
          .update({
            status: "processed",
            processed_at: new Date().toISOString(),
            attempts: (entry.attempts ?? 0) + 1,
          })
          .eq("id", entry.id);
        processed++;
      } catch (err) {
        const attempts = (entry.attempts ?? 0) + 1;
        const finalStatus = attempts >= MAX_ATTEMPTS ? "failed" : "pending";
        await supabase.from("learning_queue")
          .update({
            status: finalStatus,
            attempts,
            error: String(err),
          })
          .eq("id", entry.id);
        failed++;
        console.error("[process-learning-queue] entry failed:", entry.id, err);
      }
    }

    return jsonResponse({
      status: "ok",
      drained: pending.length,
      processed,
      cancelled,
      failed,
    });
  } catch (err) {
    console.error("[process-learning-queue] unhandled:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
