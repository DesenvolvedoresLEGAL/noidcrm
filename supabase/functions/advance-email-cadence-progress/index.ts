import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Internal-only: invoked by ingest-email-delivery-event and other server jobs.
  const internalSecret = req.headers.get("x-internal-secret");
  const expectedSecret = Deno.env.get("INTERNAL_WORKFLOW_SECRET");
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);


    const { progress_id, event_type, email_message_id, run_id } = await req.json();

    if (!progress_id || !event_type) {
      return new Response(JSON.stringify({ error: "progress_id and event_type required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: progress } = await supabase
      .from("ai_email_cadence_progress")
      .select("*, ai_email_cadence_policies(*)")
      .eq("id", progress_id)
      .single();

    if (!progress) {
      return new Response(JSON.stringify({ error: "Progress not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const policy = (progress as any).ai_email_cadence_policies;
    const now = new Date().toISOString();

    if (event_type === "email_sent") {
      // Load next step
      const { data: steps } = await supabase
        .from("ai_email_cadence_steps")
        .select("*")
        .eq("cadence_policy_id", progress.cadence_policy_id)
        .eq("is_active", true)
        .order("step_order", { ascending: true });

      const currentOrder = (progress.current_step_order || 0) + 1;
      const currentStep = steps?.find((s: any) => s.step_order === currentOrder);
      const nextStep = steps?.find((s: any) => s.step_order > currentOrder);

      const updates: any = {
        current_step_order: currentOrder,
        current_step_id: currentStep?.id || null,
        steps_completed: (progress.steps_completed || 0) + 1,
        last_email_message_id: email_message_id || null,
        last_email_sent_at: now,
        updated_at: now,
      };

      if (nextStep) {
        const delayMs = nextStep.min_delay_hours * 3600000;
        updates.next_eligible_at = new Date(Date.now() + delayMs).toISOString();
      } else {
        // Cadence exhausted
        updates.status = "exhausted";
        updates.stop_reason = "all_steps_completed";
        updates.exited_at = now;
        updates.next_eligible_at = null;
      }

      await supabase.from("ai_email_cadence_progress").update(updates).eq("id", progress_id);

      // Record outcome
      if (run_id) {
        await supabase.from("ai_email_agent_outcomes").insert({
          organization_id: progress.organization_id,
          agent_id: progress.agent_id,
          run_id,
          opportunity_id: progress.opportunity_id,
          cadence_policy_id: progress.cadence_policy_id,
          cadence_step_id: currentStep?.id,
          outcome_type: "cadence_advanced",
          outcome_value_json: { step_order: currentOrder, next_step: nextStep?.step_order },
        });
      }

      return new Response(JSON.stringify({ status: "advanced", current_step_order: currentOrder }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event_type === "reply_received") {
      const updates: any = {
        replies_received: (progress.replies_received || 0) + 1,
        updated_at: now,
      };

      if (policy?.stop_on_reply) {
        updates.status = "stopped";
        updates.stop_reason = "reply_received";
        updates.exited_at = now;
        updates.next_eligible_at = null;
      }

      await supabase.from("ai_email_cadence_progress").update(updates).eq("id", progress_id);

      if (run_id) {
        await supabase.from("ai_email_agent_outcomes").insert({
          organization_id: progress.organization_id,
          agent_id: progress.agent_id,
          run_id,
          opportunity_id: progress.opportunity_id,
          cadence_policy_id: progress.cadence_policy_id,
          outcome_type: "cadence_stopped",
          outcome_value_json: { reason: "reply_received" },
        });
      }

      return new Response(JSON.stringify({ status: policy?.stop_on_reply ? "stopped" : "updated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event_type === "email_opened") {
      await supabase.from("ai_email_cadence_progress").update({
        opens_detected: (progress.opens_detected || 0) + 1,
        updated_at: now,
      }).eq("id", progress_id);

      return new Response(JSON.stringify({ status: "updated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event_type === "stage_changed") {
      if (policy?.stop_on_stage_change) {
        await supabase.from("ai_email_cadence_progress").update({
          status: "stopped",
          stop_reason: "stage_changed",
          exited_at: now,
          next_eligible_at: null,
          updated_at: now,
        }).eq("id", progress_id);

        return new Response(JSON.stringify({ status: "stopped", reason: "stage_changed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ status: "no_action" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event_type === "manual_override") {
      if (policy?.stop_on_manual_override) {
        await supabase.from("ai_email_cadence_progress").update({
          status: "stopped",
          stop_reason: "manual_override",
          exited_at: now,
          next_eligible_at: null,
          updated_at: now,
        }).eq("id", progress_id);

        return new Response(JSON.stringify({ status: "stopped", reason: "manual_override" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ status: "no_action" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown event_type" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
