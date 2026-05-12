import { createClient } from "npm:@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const targetDate = body.date || new Date().toISOString().split("T")[0];

    const startOfDay = `${targetDate}T00:00:00Z`;
    const endOfDay = `${targetDate}T23:59:59.999Z`;

    // Fetch all outcomes for the day
    const { data: outcomes } = await supabase
      .from("ai_email_agent_outcomes")
      .select("*")
      .gte("observed_at", startOfDay)
      .lte("observed_at", endOfDay);

    if (!outcomes || outcomes.length === 0) {
      return new Response(JSON.stringify({ status: "no_data", date: targetDate }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by (org, agent, pipeline, stage, cadence_policy)
    const buckets = new Map<string, any>();

    for (const o of outcomes) {
      const key = [
        o.organization_id,
        o.agent_id,
        o.agent_version_id || "null",
        o.pipeline_id || "null",
        o.stage_id || "null",
        o.cadence_policy_id || "null",
      ].join("|");

      if (!buckets.has(key)) {
        buckets.set(key, {
          organization_id: o.organization_id,
          agent_id: o.agent_id,
          agent_version_id: o.agent_version_id,
          pipeline_id: o.pipeline_id,
          stage_id: o.stage_id,
          cadence_policy_id: o.cadence_policy_id,
          metric_date: targetDate,
          emails_generated: 0,
          emails_sent: 0,
          emails_approved: 0,
          emails_rejected: 0,
          emails_opened: 0,
          emails_replied: 0,
          bounced: 0,
          opportunities_advanced: 0,
          opportunities_reactivated: 0,
          influenced_deals: 0,
          cooldown_blocks: 0,
          policy_blocks: 0,
          approval_waits: 0,
          human_edits: 0,
          estimated_cost: 0,
        });
      }

      const b = buckets.get(key)!;
      switch (o.outcome_type) {
        case "email_generated": b.emails_generated++; break;
        case "email_sent": b.emails_sent++; break;
        case "email_opened": b.emails_opened++; break;
        case "email_replied": b.emails_replied++; break;
        case "email_bounced": b.bounced++; break;
        case "approval_required": b.approval_waits++; break;
        case "approval_rejected": b.emails_rejected++; break;
        case "cooldown_blocked": b.cooldown_blocks++; break;
        case "policy_blocked": b.policy_blocks++; break;
        case "opportunity_advanced": b.opportunities_advanced++; break;
        case "opportunity_reactivated": b.opportunities_reactivated++; break;
        case "deal_influenced": b.influenced_deals++; break;
      }
    }

    // Upsert metrics
    const rows = Array.from(buckets.values());
    let upserted = 0;

    for (const row of rows) {
      // Delete existing for same key then insert (simple upsert)
      await supabase.from("ai_email_agent_metrics_daily")
        .delete()
        .eq("organization_id", row.organization_id)
        .eq("metric_date", row.metric_date)
        .eq("agent_id", row.agent_id);

      const { error } = await supabase.from("ai_email_agent_metrics_daily").insert(row);
      if (!error) upserted++;
    }

    return new Response(JSON.stringify({ status: "ok", date: targetDate, upserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
