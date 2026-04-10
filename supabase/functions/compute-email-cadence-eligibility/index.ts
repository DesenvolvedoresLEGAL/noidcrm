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

    const { agent_id, opportunity_id, organization_id } = await req.json();
    if (!agent_id || !opportunity_id || !organization_id) {
      return new Response(JSON.stringify({ error: "agent_id, opportunity_id, organization_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const blocked_reasons: string[] = [];
    const now = new Date();

    // Load opportunity with pipeline/stage
    const { data: opp } = await supabase
      .from("opportunities")
      .select("id, stage_id, pipeline_id, contact_id, account_id")
      .eq("id", opportunity_id)
      .single();

    if (!opp) {
      return new Response(JSON.stringify({ eligible: false, blocked_reasons: ["opportunity_not_found"] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve pipeline rule (stage-specific first, then pipeline-level)
    const { data: pipelineRules } = await supabase
      .from("ai_email_pipeline_rules")
      .select("*")
      .eq("agent_id", agent_id)
      .eq("organization_id", organization_id)
      .eq("pipeline_id", opp.pipeline_id)
      .eq("is_enabled", true)
      .order("priority", { ascending: true });

    const stageRule = pipelineRules?.find((r: any) => r.stage_id === opp.stage_id);
    const pipelineRule = pipelineRules?.find((r: any) => !r.stage_id);
    const activeRule = stageRule || pipelineRule;

    if (activeRule && !activeRule.allow_email_agent) {
      blocked_reasons.push("pipeline_rule_blocks_email_agent");
      return new Response(JSON.stringify({ eligible: false, blocked_reasons }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve cadence policy
    const cadencePolicyId = activeRule?.default_cadence_policy_id;
    let cadencePolicy: any = null;

    if (cadencePolicyId) {
      const { data } = await supabase
        .from("ai_email_cadence_policies")
        .select("*")
        .eq("id", cadencePolicyId)
        .eq("is_active", true)
        .single();
      cadencePolicy = data;
    }

    if (!cadencePolicy) {
      // Fallback: find any active cadence for this agent
      const { data } = await supabase
        .from("ai_email_cadence_policies")
        .select("*")
        .eq("agent_id", agent_id)
        .eq("organization_id", organization_id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      cadencePolicy = data;
    }

    if (!cadencePolicy) {
      return new Response(JSON.stringify({ eligible: false, blocked_reasons: ["no_cadence_policy"] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get or check cadence progress
    const { data: progress } = await supabase
      .from("ai_email_cadence_progress")
      .select("*")
      .eq("agent_id", agent_id)
      .eq("opportunity_id", opportunity_id)
      .eq("cadence_policy_id", cadencePolicy.id)
      .eq("status", "active")
      .limit(1)
      .single();

    // Load steps
    const { data: steps } = await supabase
      .from("ai_email_cadence_steps")
      .select("*")
      .eq("cadence_policy_id", cadencePolicy.id)
      .eq("is_active", true)
      .order("step_order", { ascending: true });

    if (!steps || steps.length === 0) {
      return new Response(JSON.stringify({ eligible: false, blocked_reasons: ["no_cadence_steps"] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine next step
    const currentOrder = progress?.current_step_order ?? 0;
    const nextStep = steps.find((s: any) => s.step_order > currentOrder);

    if (!nextStep) {
      blocked_reasons.push("cadence_exhausted");
      return new Response(JSON.stringify({ eligible: false, blocked_reasons }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check delay
    if (progress?.last_email_sent_at) {
      const lastSent = new Date(progress.last_email_sent_at);
      const minDelay = nextStep.min_delay_hours * 60 * 60 * 1000;
      if (now.getTime() - lastSent.getTime() < minDelay) {
        blocked_reasons.push("min_delay_not_met");
      }
    }

    // === COOLDOWN EVALUATION ===
    const cooldownPolicyId = activeRule?.default_cooldown_policy_id;
    let cooldown: any = null;

    if (cooldownPolicyId) {
      const { data } = await supabase
        .from("ai_email_cooldown_policies")
        .select("*")
        .eq("id", cooldownPolicyId)
        .single();
      cooldown = data;
    }

    if (!cooldown) {
      const { data } = await supabase
        .from("ai_email_cooldown_policies")
        .select("*")
        .eq("agent_id", agent_id)
        .eq("organization_id", organization_id)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      cooldown = data;
    }

    if (cooldown) {
      // Check business hours
      if (cooldown.respect_business_hours) {
        const tz = cooldown.timezone || "America/Sao_Paulo";
        try {
          const localTime = new Date(now.toLocaleString("en-US", { timeZone: tz }));
          const dayOfWeek = localTime.getDay();
          const allowedDays = cooldown.allowed_weekdays_json || [1, 2, 3, 4, 5];
          if (!allowedDays.includes(dayOfWeek)) {
            blocked_reasons.push("outside_allowed_weekday");
          }
          if (cooldown.daily_send_window_start && cooldown.daily_send_window_end) {
            const timeStr = localTime.toTimeString().slice(0, 5);
            if (timeStr < cooldown.daily_send_window_start || timeStr > cooldown.daily_send_window_end) {
              blocked_reasons.push("outside_send_window");
            }
          }
        } catch { /* timezone parse error, skip */ }
      }

      // Check per-contact limit
      if (opp.contact_id) {
        const contactCutoff = new Date(now.getTime() - cooldown.min_hours_between_emails_per_contact * 3600000).toISOString();
        const { count: recentContact } = await supabase
          .from("ai_email_messages")
          .select("id", { count: "exact", head: true })
          .eq("contact_id", opp.contact_id)
          .eq("organization_id", organization_id)
          .gte("sent_at", contactCutoff)
          .in("send_status", ["sent"]);
        if ((recentContact || 0) > 0) blocked_reasons.push("contact_cooldown");

        // 7d limit
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
        const { count: weeklyContact } = await supabase
          .from("ai_email_messages")
          .select("id", { count: "exact", head: true })
          .eq("contact_id", opp.contact_id)
          .eq("organization_id", organization_id)
          .gte("sent_at", sevenDaysAgo)
          .in("send_status", ["sent"]);
        if ((weeklyContact || 0) >= cooldown.max_emails_per_contact_7d) blocked_reasons.push("contact_weekly_limit");
      }

      // Check per-opportunity 7d limit
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
      const { count: weeklyOpp } = await supabase
        .from("ai_email_messages")
        .select("id", { count: "exact", head: true })
        .eq("opportunity_id", opportunity_id)
        .eq("organization_id", organization_id)
        .gte("sent_at", sevenDaysAgo)
        .in("send_status", ["sent"]);
      if ((weeklyOpp || 0) >= cooldown.max_emails_per_opportunity_7d) blocked_reasons.push("opportunity_weekly_limit");

      // Check per-account 7d limit
      if (opp.account_id) {
        const { count: weeklyAccount } = await supabase
          .from("ai_email_messages")
          .select("id", { count: "exact", head: true })
          .eq("account_id", opp.account_id)
          .eq("organization_id", organization_id)
          .gte("sent_at", sevenDaysAgo)
          .in("send_status", ["sent"]);
        if ((weeklyAccount || 0) >= cooldown.max_emails_per_account_7d) blocked_reasons.push("account_weekly_limit");
      }

      // Check recent bounce
      if (cooldown.stop_if_recent_bounce && opp.contact_id) {
        const { count: bounces } = await supabase
          .from("ai_email_messages")
          .select("id", { count: "exact", head: true })
          .eq("contact_id", opp.contact_id)
          .eq("delivery_status", "bounced")
          .eq("organization_id", organization_id);
        if ((bounces || 0) > 0) blocked_reasons.push("recent_bounce");
      }

      // Check manual contact
      if (cooldown.stop_if_manual_contact_recent_hours) {
        const cutoff = new Date(now.getTime() - cooldown.stop_if_manual_contact_recent_hours * 3600000).toISOString();
        const { count: manualActs } = await supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("opportunity_id", opportunity_id)
          .eq("organization_id", organization_id)
          .is("is_automated", false)
          .gte("created_at", cutoff);
        if ((manualActs || 0) > 0) blocked_reasons.push("recent_manual_contact");
      }

      // Same purpose cooldown
      if (cooldown.min_hours_between_same_purpose) {
        const purposeCutoff = new Date(now.getTime() - cooldown.min_hours_between_same_purpose * 3600000).toISOString();
        const { count: samePurpose } = await supabase
          .from("ai_email_messages")
          .select("id", { count: "exact", head: true })
          .eq("opportunity_id", opportunity_id)
          .eq("email_purpose", nextStep.email_purpose)
          .eq("organization_id", organization_id)
          .gte("sent_at", purposeCutoff)
          .in("send_status", ["sent"]);
        if ((samePurpose || 0) > 0) blocked_reasons.push("same_purpose_cooldown");
      }
    }

    // Check approval requirements
    const requiresApproval = activeRule?.approval_required || nextStep.approval_override || false;

    const eligible = blocked_reasons.length === 0;

    const result = {
      eligible,
      cadence_policy_id: cadencePolicy.id,
      current_step_order: currentOrder,
      next_step_order: nextStep.step_order,
      next_step_id: nextStep.id,
      next_eligible_at: progress?.next_eligible_at || null,
      blocked_reasons,
      recommended_email_purpose: nextStep.email_purpose,
      recommended_angle: nextStep.angle_guidance || null,
      recommended_tone: nextStep.tone_guidance || null,
      cta_guidance: nextStep.cta_guidance || null,
      requires_approval: requiresApproval,
      cooldown_policy_id: cooldown?.id || null,
      pipeline_rule_id: activeRule?.id || null,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
