import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

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

    // Find all published email agents with active triggers
    const { data: agents, error: agentsErr } = await supabase
      .from("ai_agents")
      .select(`
        id, organization_id, autonomy_level, is_paused, environment,
        last_published_version_id,
        ai_agent_triggers!inner(id, trigger_kind, event_name, condition_json, is_active, agent_version_id)
      `)
      .eq("is_active", true)
      .eq("is_paused", false)
      .eq("environment", "production")
      .not("last_published_version_id", "is", null)
      .eq("ai_agent_triggers.is_active", true);

    if (agentsErr) {
      console.error("Error fetching agents:", agentsErr);
      return new Response(JSON.stringify({ error: agentsErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!agents || agents.length === 0) {
      return new Response(JSON.stringify({ message: "No eligible agents", runs_created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalRunsCreated = 0;

    for (const agent of agents) {
      const orgId = agent.organization_id;
      const triggers = (agent as any).ai_agent_triggers || [];

      for (const trigger of triggers) {
        const eventName = trigger.event_name;
        const condition = trigger.condition_json || {};
        const versionId = agent.last_published_version_id;

        let entities: Array<{ entity_type: string; entity_id: string; scenario_label: string }> = [];

        // === TRIGGER: proposal_viewed_no_response ===
        if (eventName === "proposal_viewed_no_response") {
          const hoursThreshold = condition.hours_threshold || 48;
          const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000).toISOString();

          const { data: proposals } = await supabase
            .from("proposals")
            .select("id, opportunity_id")
            .eq("organization_id", orgId)
            .eq("status", "sent")
            .not("viewed_at", "is", null)
            .lt("viewed_at", cutoff);

          if (proposals) {
            for (const p of proposals) {
              if (p.opportunity_id) {
                entities.push({
                  entity_type: "opportunity",
                  entity_id: p.opportunity_id,
                  scenario_label: `proposal_viewed_no_response`,
                });
              }
            }
          }
        }

        // === TRIGGER: opportunity_stalled ===
        if (eventName === "opportunity_stalled") {
          const daysThreshold = condition.days_threshold || 7;
          const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000).toISOString();

          const { data: opps } = await supabase
            .from("opportunities")
            .select("id")
            .eq("organization_id", orgId)
            .in("status", ["open", "active"])
            .lt("updated_at", cutoff);

          if (opps) {
            for (const o of opps) {
              entities.push({
                entity_type: "opportunity",
                entity_id: o.id,
                scenario_label: `opportunity_stalled`,
              });
            }
          }
        }

        // === TRIGGER: email_activity_due ===
        if (eventName === "email_activity_due") {
          const now = new Date().toISOString();

          const { data: activities } = await supabase
            .from("activities")
            .select("id, opportunity_id")
            .eq("organization_id", orgId)
            .eq("type", "email")
            .in("status", ["pending", "scheduled"])
            .lte("scheduled_date", now)
            .is("deleted_at", null);

          if (activities) {
            for (const a of activities) {
              entities.push({
                entity_type: a.opportunity_id ? "opportunity" : "activity",
                entity_id: a.opportunity_id || a.id,
                scenario_label: `email_activity_due`,
              });
            }
          }
        }

        // Idempotency: skip entities that already have a recent run
        for (const ent of entities) {
          const windowHours = condition.cooldown_hours || 24;
          const windowCutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

          const { data: existing } = await supabase
            .from("ai_agent_execution_runs")
            .select("id")
            .eq("agent_id", agent.id)
            .eq("entity_type", ent.entity_type)
            .eq("entity_id", ent.entity_id)
            .gte("created_at", windowCutoff)
            .in("execution_status", ["queued", "running", "awaiting_approval", "executed"])
            .limit(1);

          if (existing && existing.length > 0) continue;

          const { error: insertErr } = await supabase
            .from("ai_agent_execution_runs")
            .insert({
              organization_id: orgId,
              agent_id: agent.id,
              agent_version_id: versionId,
              trigger_id: trigger.id,
              entity_type: ent.entity_type,
              entity_id: ent.entity_id,
              scenario_label: ent.scenario_label,
              execution_mode: "controlled_live",
              execution_status: "queued",
            });

          if (!insertErr) totalRunsCreated++;
        }
      }
    }

    return new Response(JSON.stringify({ message: "OK", runs_created: totalRunsCreated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
