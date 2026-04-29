// Sprint E — Track outreach result events into experiment_runs.
// Called by Email Agent / activity completion when a reply or meeting is detected.
// Win/loss is also handled by the DB trigger trg_experiment_runs_on_opp_close.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EVENT_TO_RESULT: Record<string, "success" | "fail" | "neutral"> = {
  reply: "success",
  meeting: "success",
  win: "success",
  loss: "fail",
  no_response: "neutral",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { opportunity_id, event } = await req.json();
    if (!opportunity_id || !event) {
      return new Response(JSON.stringify({ error: "opportunity_id and event required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const result = EVENT_TO_RESULT[event];
    if (!result) {
      return new Response(JSON.stringify({ error: `unknown event: ${event}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Update only pending runs to keep first-event-wins semantics.
    const { data, error } = await admin
      .from("experiment_runs")
      .update({ result, result_event: event, result_at: new Date().toISOString() })
      .eq("opportunity_id", opportunity_id)
      .eq("result", "pending")
      .select("id");
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, updated: data?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[track-experiment-result] fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
