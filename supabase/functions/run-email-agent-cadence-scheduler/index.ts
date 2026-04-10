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

    const now = new Date().toISOString();
    const results: any[] = [];

    // Fetch active cadence progress entries that are eligible
    const { data: progressEntries } = await supabase
      .from("ai_email_cadence_progress")
      .select("*, ai_email_cadence_policies!inner(agent_id, organization_id, is_active)")
      .eq("status", "active")
      .lte("next_eligible_at", now)
      .limit(50);

    if (!progressEntries || progressEntries.length === 0) {
      return new Response(JSON.stringify({ processed: 0, results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const progress of progressEntries) {
      const policy = (progress as any).ai_email_cadence_policies;
      if (!policy?.is_active) continue;

      const agentId = policy.agent_id;
      const orgId = policy.organization_id;

      // Check agent is active and published
      const { data: agent } = await supabase
        .from("ai_agents")
        .select("id, is_active, status")
        .eq("id", agentId)
        .single();

      if (!agent?.is_active || agent.status !== "production") {
        results.push({ opportunity_id: progress.opportunity_id, skipped: true, reason: "agent_not_active" });
        continue;
      }

      // Call eligibility computation
      const eligibilityResp = await fetch(`${supabaseUrl}/functions/v1/compute-email-cadence-eligibility`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          agent_id: agentId,
          opportunity_id: progress.opportunity_id,
          organization_id: orgId,
        }),
      });

      const eligibility = await eligibilityResp.json();

      if (!eligibility.eligible) {
        // Record blocked outcome
        const blockType = eligibility.blocked_reasons?.includes("contact_cooldown") ||
          eligibility.blocked_reasons?.includes("contact_weekly_limit") ||
          eligibility.blocked_reasons?.includes("opportunity_weekly_limit") ||
          eligibility.blocked_reasons?.includes("account_weekly_limit") ||
          eligibility.blocked_reasons?.includes("same_purpose_cooldown") ||
          eligibility.blocked_reasons?.includes("recent_manual_contact") ||
          eligibility.blocked_reasons?.includes("outside_allowed_weekday") ||
          eligibility.blocked_reasons?.includes("outside_send_window")
            ? "cooldown_blocked" : "policy_blocked";

        // Find a recent run to link outcome (or use a dummy)
        const { data: latestRun } = await supabase
          .from("ai_agent_execution_runs")
          .select("id")
          .eq("agent_id", agentId)
          .eq("entity_id", progress.opportunity_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (latestRun) {
          await supabase.from("ai_email_agent_outcomes").insert({
            organization_id: orgId,
            agent_id: agentId,
            run_id: latestRun.id,
            opportunity_id: progress.opportunity_id,
            cadence_policy_id: progress.cadence_policy_id,
            cadence_step_id: eligibility.next_step_id,
            outcome_type: blockType,
            outcome_value_json: { blocked_reasons: eligibility.blocked_reasons },
          });
        }

        results.push({ opportunity_id: progress.opportunity_id, eligible: false, blocked_reasons: eligibility.blocked_reasons });
        continue;
      }

      // Check idempotency — no existing queued/running run for same agent+entity recently
      const windowCutoff = new Date(Date.now() - 3600000).toISOString(); // 1h window
      const { data: existing } = await supabase
        .from("ai_agent_execution_runs")
        .select("id")
        .eq("agent_id", agentId)
        .eq("entity_id", progress.opportunity_id)
        .gte("created_at", windowCutoff)
        .in("execution_status", ["queued", "running", "awaiting_approval"]);

      if (existing && existing.length > 0) {
        results.push({ opportunity_id: progress.opportunity_id, skipped: true, reason: "run_already_exists" });
        continue;
      }

      // Get published version
      const { data: publishedVersion } = await supabase
        .from("ai_agent_versions")
        .select("id")
        .eq("agent_id", agentId)
        .eq("is_published", true)
        .eq("environment", "production")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!publishedVersion) {
        results.push({ opportunity_id: progress.opportunity_id, skipped: true, reason: "no_published_version" });
        continue;
      }

      // Create execution run
      const { data: run } = await supabase
        .from("ai_agent_execution_runs")
        .insert({
          organization_id: orgId,
          agent_id: agentId,
          agent_version_id: publishedVersion.id,
          entity_type: "opportunity",
          entity_id: progress.opportunity_id,
          execution_mode: "controlled_live",
          execution_status: "queued",
          scenario_label: `cadence_step_${eligibility.next_step_order}`,
          context_snapshot_json: {
            cadence_policy_id: eligibility.cadence_policy_id,
            cadence_step_id: eligibility.next_step_id,
            recommended_email_purpose: eligibility.recommended_email_purpose,
            recommended_angle: eligibility.recommended_angle,
            recommended_tone: eligibility.recommended_tone,
            cta_guidance: eligibility.cta_guidance,
          },
        })
        .select("id")
        .single();

      // Record outcome
      if (run) {
        await supabase.from("ai_email_agent_outcomes").insert({
          organization_id: orgId,
          agent_id: agentId,
          run_id: run.id,
          opportunity_id: progress.opportunity_id,
          cadence_policy_id: eligibility.cadence_policy_id,
          cadence_step_id: eligibility.next_step_id,
          outcome_type: "email_generated",
          outcome_value_json: { step_order: eligibility.next_step_order },
        });

        await supabase.from("ai_agent_audit").insert({
          organization_id: orgId,
          agent_id: agentId,
          action_type: "cadence_run_enqueued",
          payload_json: { run_id: run.id, step_order: eligibility.next_step_order, opportunity_id: progress.opportunity_id },
        });
      }

      results.push({ opportunity_id: progress.opportunity_id, eligible: true, run_id: run?.id });
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
