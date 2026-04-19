import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import {
  evaluatePolicy,
  checkCooldown,
  buildCooldownCtx,
  buildRecentInteractions,
} from "../_shared/agent-policy-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.lovable.dev/chat/v1";

async function callLovableAI(model: string, messages: Array<{ role: string; content: string }>) {
  const resp = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
  });
  if (!resp.ok) throw new Error(`AI call failed: ${resp.status}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { run_id } = await req.json();
    if (!run_id) {
      return new Response(JSON.stringify({ error: "run_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load run
    const { data: run, error: runErr } = await supabase
      .from("ai_agent_execution_runs")
      .select("*")
      .eq("id", run_id)
      .single();

    if (runErr || !run) {
      return new Response(JSON.stringify({ error: "Run not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update to running
    await supabase.from("ai_agent_execution_runs").update({
      execution_status: "running", started_at: new Date().toISOString(),
    }).eq("id", run_id);

    // Load agent + version
    const { data: agent } = await supabase
      .from("ai_agents")
      .select("*")
      .eq("id", run.agent_id)
      .single();

    const { data: version } = await supabase
      .from("ai_agent_versions")
      .select("*")
      .eq("id", run.agent_version_id)
      .single();

    if (!agent || !version) {
      await supabase.from("ai_agent_execution_runs").update({
        execution_status: "failed",
        final_output_json: { error: "Agent or version not found" },
      }).eq("id", run_id);
      return new Response(JSON.stringify({ error: "Agent/version not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load prompt layers
    const { data: promptLayer } = await supabase
      .from("ai_agent_prompt_layers")
      .select("*")
      .eq("agent_version_id", run.agent_version_id)
      .limit(1)
      .single();

    // Build live context
    let context: Record<string, any> = {};
    
    if (run.entity_type === "opportunity") {
      const { data: opp } = await supabase
        .from("opportunities")
        .select("*, accounts(*), contacts(*)")
        .eq("id", run.entity_id)
        .single();
      
      if (opp) {
        context.opportunity = opp;
        context.account = opp.accounts;
        context.contact = opp.contacts;

        // Get proposals
        const { data: proposals } = await supabase
          .from("proposals")
          .select("id, status, total_value, viewed_at, sent_at, created_at")
          .eq("opportunity_id", opp.id)
          .order("created_at", { ascending: false })
          .limit(3);
        context.proposals = proposals || [];

        // Get recent activities
        const { data: activities } = await supabase
          .from("activities")
          .select("id, type, title, status, scheduled_date, completed_at")
          .eq("opportunity_id", opp.id)
          .order("created_at", { ascending: false })
          .limit(10);
        context.recent_activities = activities || [];
      }
    }

    // Save context snapshot
    await supabase.from("ai_agent_execution_runs").update({
      context_snapshot_json: context,
    }).eq("id", run_id);

    // Check if contact has valid email
    const contactEmail = context.contact?.emails?.[0] || context.contact?.email;
    if (!contactEmail) {
      await supabase.from("ai_agent_execution_runs").update({
        execution_status: "skipped",
        decision_json: { should_act: false, reason: "Contato sem email válido" },
        completed_at: new Date().toISOString(),
        execution_time_ms: Date.now() - startTime,
      }).eq("id", run_id);

      // Audit
      await supabase.from("ai_agent_audit").insert({
        organization_id: run.organization_id,
        agent_id: run.agent_id,
        actor_id: user.id,
        action_type: "execution_skipped",
        payload_json: { run_id, reason: "no_valid_email" },
      });

      return new Response(JSON.stringify({ status: "skipped", reason: "No valid email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === COOLDOWN GATE (antes de gastar tokens com deliberação) ===
    const { data: cooldownPolicy } = await supabase
      .from("ai_email_cooldown_policies")
      .select("*")
      .eq("agent_id", run.agent_id)
      .is("applies_to_pipeline_id", null)
      .is("applies_to_stage_id", null)
      .limit(1)
      .maybeSingle();

    const cooldownCtx = await buildCooldownCtx(
      supabase,
      run.organization_id,
      context.contact?.id || null,
      context.opportunity?.id || null,
    );

    const cooldownResult = checkCooldown(cooldownPolicy as any, cooldownCtx);
    if (!cooldownResult.allowed) {
      await supabase.from("ai_agent_execution_runs").update({
        execution_status: "skipped",
        decision_json: { should_act: false, reason: cooldownResult.reason, gate: "cooldown" },
        completed_at: new Date().toISOString(),
        execution_time_ms: Date.now() - startTime,
      }).eq("id", run_id);

      await supabase.from("ai_agent_audit").insert({
        organization_id: run.organization_id,
        agent_id: run.agent_id,
        actor_id: user.id,
        action_type: "execution_blocked_cooldown",
        payload_json: { run_id, reason: cooldownResult.reason, ctx: cooldownCtx },
      });

      // Outcome event
      await supabase.from("ai_email_agent_outcomes").insert({
        organization_id: run.organization_id,
        agent_id: run.agent_id,
        agent_version_id: run.agent_version_id,
        run_id,
        opportunity_id: context.opportunity?.id || null,
        account_id: context.account?.id || null,
        contact_id: context.contact?.id || null,
        outcome_type: "cooldown_blocked",
        outcome_value_json: { reason: cooldownResult.reason },
      });

      return new Response(JSON.stringify({ status: "skipped", reason: cooldownResult.reason, gate: "cooldown" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === MEMORY: recent_interactions ===
    const { data: memProfile } = await supabase
      .from("ai_agent_memory_profiles")
      .select("recent_interactions_enabled, recent_interactions_lookback_hours")
      .eq("agent_version_id", run.agent_version_id)
      .limit(1)
      .maybeSingle();

    let recentInteractions: any[] = [];
    if (memProfile?.recent_interactions_enabled !== false) {
      recentInteractions = await buildRecentInteractions(
        supabase,
        run.organization_id,
        context.contact?.id || null,
        context.opportunity?.id || null,
        memProfile?.recent_interactions_lookback_hours || 72,
      );
    }
    context.recent_interactions = recentInteractions;

    // Save updated context snapshot
    await supabase.from("ai_agent_execution_runs").update({
      context_snapshot_json: context,
    }).eq("id", run_id);

    // === DELIBERATION ===
    const systemPrompt = promptLayer?.system_prompt || version.prompt_system ||
      `Você é um agente de email inteligente do CRM. Seu papel: ${agent.description || agent.name}. Objetivo: ${agent.objective || "ajudar na jornada comercial"}.`;

    const deliberationPrompt = promptLayer?.deliberation_prompt || version.prompt_deliberation ||
      `Analise o contexto e decida se deve enviar um email de follow-up agora.`;

    const contextSummary = JSON.stringify({
      trigger: run.scenario_label,
      opportunity: context.opportunity ? {
        name: context.opportunity.name,
        stage: context.opportunity.stage_id,
        value: context.opportunity.value,
        status: context.opportunity.status,
      } : null,
      contact: context.contact ? {
        name: context.contact.name || context.contact.nome,
        email: contactEmail,
      } : null,
      proposals: (context.proposals || []).map((p: any) => ({
        status: p.status, value: p.total_value, viewed_at: p.viewed_at,
      })),
      recent_activities_count: (context.recent_activities || []).length,
      recent_interactions: recentInteractions,
      cooldown_state: {
        emails_to_contact_7d: cooldownCtx.emails_to_contact_7d,
        hours_since_last_email: cooldownCtx.hours_since_last_email_to_contact,
      },
    });

    const deliberationResult = await callLovableAI("google/gemini-2.5-flash", [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `${deliberationPrompt}\n\nContexto:\n${contextSummary}\n\nResponda em JSON:\n{"should_act":boolean,"action_type":"send_email"|"wait"|"escalate","primary_objective":"string","risk_level":"low"|"medium"|"high","confidence_score":0.0-1.0,"requires_approval":boolean,"reasoning_summary":"string"}`,
      },
    ]);

    let decision: Record<string, any>;
    try {
      const cleaned = deliberationResult.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      decision = JSON.parse(cleaned);
    } catch {
      decision = { should_act: false, reasoning_summary: "Failed to parse deliberation", raw: deliberationResult };
    }

    await supabase.from("ai_agent_execution_runs").update({ decision_json: decision }).eq("id", run_id);

    // Audit deliberation
    await supabase.from("ai_agent_audit").insert({
      organization_id: run.organization_id,
      agent_id: run.agent_id,
      actor_id: user.id,
      action_type: "execution_deliberated",
      payload_json: { run_id, decision: { should_act: decision.should_act, confidence: decision.confidence_score } },
    });

    if (!decision.should_act) {
      await supabase.from("ai_agent_execution_runs").update({
        execution_status: "skipped",
        completed_at: new Date().toISOString(),
        execution_time_ms: Date.now() - startTime,
      }).eq("id", run_id);
      return new Response(JSON.stringify({ status: "skipped", decision }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === GENERATE EMAIL ===
    const generationPrompt = promptLayer?.generation_prompt || version.prompt_generation ||
      `Gere um email profissional de follow-up baseado no contexto.`;

    const emailResult = await callLovableAI("google/gemini-2.5-flash", [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `${generationPrompt}\n\nContexto:\n${contextSummary}\n\nDecisão: ${decision.reasoning_summary}\n\nGere em JSON:\n{"subject":"string","preview_text":"string","body_text":"string","body_html":"string","cta_text":"string","email_purpose":"string"}`,
      },
    ]);

    let emailContent: Record<string, any>;
    try {
      const cleaned = emailResult.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      emailContent = JSON.parse(cleaned);
    } catch {
      emailContent = { subject: "Follow-up", body_text: emailResult, email_purpose: "follow_up" };
    }

    // Save output preview
    await supabase.from("ai_agent_execution_runs").update({
      output_preview_json: emailContent,
      tool_plan_json: [{ tool: "send_email", payload: { to: contactEmail, subject: emailContent.subject } }],
    }).eq("id", run_id);

    // === CHECK APPROVAL POLICY ===
    let needsApproval = false;
    
    if (agent.autonomy_level === "assisted" || agent.autonomy_level === "recommender") {
      needsApproval = true;
    }

    if (decision.risk_level === "high") needsApproval = true;
    if (decision.requires_approval) needsApproval = true;

    // Check environment config
    const { data: envConfig } = await supabase
      .from("ai_agent_environments")
      .select("require_approval")
      .eq("organization_id", run.organization_id)
      .eq("environment", "production")
      .limit(1)
      .single();

    if (envConfig?.require_approval) needsApproval = true;

    // Check tool config
    const { data: toolConfig } = await supabase
      .from("ai_agent_tools")
      .select("execution_mode")
      .eq("agent_version_id", run.agent_version_id)
      .eq("tool_id", (await supabase.from("ai_tools_registry").select("id").eq("tool_key", "send_email").single()).data?.id || "")
      .limit(1)
      .single();

    if (toolConfig?.execution_mode === "approval_required") needsApproval = true;

    // Create action
    const { data: action } = await supabase
      .from("ai_agent_execution_actions")
      .insert({
        organization_id: run.organization_id,
        run_id: run_id,
        agent_id: run.agent_id,
        agent_version_id: run.agent_version_id,
        tool_key: "send_email",
        action_type: "send_email",
        action_status: needsApproval ? "pending_approval" : "planned",
        payload_json: {
          to: contactEmail,
          subject: emailContent.subject,
          body_text: emailContent.body_text,
          body_html: emailContent.body_html,
        },
        requires_approval: needsApproval,
      })
      .select()
      .single();

    // Create email message
    const { data: emailMsg } = await supabase
      .from("ai_email_messages")
      .insert({
        organization_id: run.organization_id,
        run_id: run_id,
        action_id: action?.id,
        opportunity_id: context.opportunity?.id,
        account_id: context.account?.id,
        contact_id: context.contact?.id,
        recipient_email: contactEmail,
        recipient_name: context.contact?.name || context.contact?.nome,
        subject: emailContent.subject,
        preview_text: emailContent.preview_text,
        body_text: emailContent.body_text,
        body_html: emailContent.body_html,
        cta_text: emailContent.cta_text,
        email_purpose: emailContent.email_purpose,
        send_status: needsApproval ? "pending_approval" : "draft",
        sender_user_id: user.id,
      })
      .select()
      .single();

    if (needsApproval) {
      // Create approval queue item
      await supabase.from("ai_agent_approval_queue").insert({
        organization_id: run.organization_id,
        run_id: run_id,
        action_id: action?.id,
        agent_id: run.agent_id,
        agent_version_id: run.agent_version_id,
        entity_type: run.entity_type,
        entity_id: run.entity_id,
        approval_type: "send_email",
        status: "pending",
        requested_by: user.id,
      });

      await supabase.from("ai_agent_execution_runs").update({
        execution_status: "awaiting_approval",
        approval_status: "pending",
        execution_time_ms: Date.now() - startTime,
      }).eq("id", run_id);

      await supabase.from("ai_agent_audit").insert({
        organization_id: run.organization_id,
        agent_id: run.agent_id,
        actor_id: user.id,
        action_type: "execution_queued_for_approval",
        payload_json: { run_id, action_id: action?.id },
      });

      return new Response(JSON.stringify({
        status: "awaiting_approval", run_id, action_id: action?.id,
        email_preview: { subject: emailContent.subject, to: contactEmail },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === DIRECT SEND ===
    try {
      const sendResp = await fetch(`${supabaseUrl}/functions/v1/send-smtp-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          to: contactEmail,
          subject: emailContent.subject,
          html: emailContent.body_html || emailContent.body_text,
          opportunityId: context.opportunity?.id,
          contactId: context.contact?.id,
        }),
      });

      const sendResult = await sendResp.json();

      if (sendResp.ok) {
        // Update statuses
        await supabase.from("ai_agent_execution_actions").update({
          action_status: "executed",
          result_json: sendResult,
          provider_reference: sendResult.messageId || sendResult.id,
        }).eq("id", action?.id);

        await supabase.from("ai_email_messages").update({
          send_status: "sent",
          delivery_status: "sent",
          sent_at: new Date().toISOString(),
          smtp_message_id: sendResult.messageId,
        }).eq("id", emailMsg?.id);

        await supabase.from("ai_agent_execution_runs").update({
          execution_status: "executed",
          final_output_json: { email_id: emailMsg?.id, send_result: sendResult },
          completed_at: new Date().toISOString(),
          execution_time_ms: Date.now() - startTime,
        }).eq("id", run_id);

        // Impact event
        await supabase.from("ai_agent_impact_events").insert({
          organization_id: run.organization_id,
          agent_id: run.agent_id,
          agent_version_id: run.agent_version_id,
          run_id: run_id,
          opportunity_id: context.opportunity?.id,
          account_id: context.account?.id,
          contact_id: context.contact?.id,
          impact_type: "email_sent",
          impact_value_json: { subject: emailContent.subject, to: contactEmail },
        });

        // Audit
        await supabase.from("ai_agent_audit").insert({
          organization_id: run.organization_id,
          agent_id: run.agent_id,
          actor_id: user.id,
          action_type: "email_sent",
          payload_json: { run_id, email_id: emailMsg?.id },
        });

        return new Response(JSON.stringify({ status: "executed", run_id, email_id: emailMsg?.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        throw new Error(sendResult.error || "Send failed");
      }
    } catch (sendErr) {
      await supabase.from("ai_agent_execution_actions").update({
        action_status: "failed",
        result_json: { error: String(sendErr) },
      }).eq("id", action?.id);

      await supabase.from("ai_email_messages").update({
        send_status: "failed",
        delivery_status: "failed",
      }).eq("id", emailMsg?.id);

      await supabase.from("ai_agent_execution_runs").update({
        execution_status: "failed",
        final_output_json: { error: String(sendErr) },
        completed_at: new Date().toISOString(),
        execution_time_ms: Date.now() - startTime,
      }).eq("id", run_id);

      await supabase.from("ai_agent_audit").insert({
        organization_id: run.organization_id,
        agent_id: run.agent_id,
        actor_id: user.id,
        action_type: "email_send_failed",
        payload_json: { run_id, error: String(sendErr) },
      });

      return new Response(JSON.stringify({ status: "failed", error: String(sendErr) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
