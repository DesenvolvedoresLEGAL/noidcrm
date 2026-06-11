// kairos-autopilot-control
// Pause / Resume / Cancel uma execução do Autopilot.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body { run_id: string; action: "pause" | "resume" | "cancel" }

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    if (!body?.run_id || !body?.action) return json(400, { error: "run_id and action required" });

    const admin = createClient(supabaseUrl, serviceKey);
    const target =
      body.action === "pause" ? "paused" :
      body.action === "cancel" ? "cancelled" : "running";

    const patch: Record<string, unknown> = { status: target };
    if (body.action === "cancel") patch.completed_at = new Date().toISOString();

    const { error } = await admin.from("kairos_batch_runs").update(patch).eq("id", body.run_id);
    if (error) throw error;

    await admin.from("kairos_batch_logs").insert({
      run_id: body.run_id,
      organization_id: (await admin.from("kairos_batch_runs").select("organization_id").eq("id", body.run_id).maybeSingle()).data?.organization_id,
      action: `run_${body.action}`,
      result: "ok",
      details: {},
    });

    if (body.action === "resume") {
      try {
        await admin.functions.invoke("kairos-autopilot-process", {
          body: { run_id: body.run_id },
          headers: { Authorization: `Bearer ${serviceKey}` },
        });
      } catch (e) { console.warn("[control] resume invoke", e); }
    }

    return json(200, { ok: true, status: target });
  } catch (err) {
    console.error("[kairos-autopilot-control]", err);
    return json(500, { error: err instanceof Error ? err.message : "internal" });
  }
});
