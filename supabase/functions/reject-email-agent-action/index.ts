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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    const profileId = profile?.id;

    if (!profileId) {
      return new Response(JSON.stringify({ error: "Perfil do usuário não encontrado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { queue_id, rejection_reason } = await req.json();
    if (!queue_id) {
      return new Response(JSON.stringify({ error: "queue_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: member } = await supabase
      .from("organization_members")
      .select("organization_id, org_role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .single();

    if (!member) {
      return new Response(JSON.stringify({ error: "No organization" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: queueItem } = await supabase
      .from("ai_agent_approval_queue")
      .select("*, ai_agent_execution_runs!inner(opportunity_id)")
      .eq("id", queue_id)
      .eq("organization_id", member.organization_id)
      .eq("status", "pending")
      .single();

    if (!queueItem) {
      return new Response(JSON.stringify({ error: "Item not found or already decided" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Permission check (expanded) ===
    const isAdmin = member.org_role === "admin" || member.org_role === "owner";
    let allowed = isAdmin;
    const oppId = (queueItem as any).ai_agent_execution_runs?.opportunity_id;

    if (!allowed && oppId) {
      const { data: opp } = await supabase
        .from("opportunities")
        .select("owner_user_id")
        .eq("id", oppId)
        .maybeSingle();
      if (opp?.owner_user_id === user.id) allowed = true;

      if (!allowed) {
        const { data: participant } = await supabase
          .from("deal_participants")
          .select("id")
          .eq("opportunity_id", oppId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (participant) allowed = true;
      }
    }

    if (!allowed) {
      const { data: perm } = await supabase
        .from("ai_agent_permissions")
        .select("can_approve")
        .eq("organization_id", member.organization_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (perm?.can_approve) allowed = true;
    }

    if (!allowed) {
      return new Response(JSON.stringify({ error: "Sem permissão para rejeitar este e-mail" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get email for feedback snapshot
    const { data: emailForFeedback } = await supabase
      .from("ai_email_messages")
      .select("subject, body_html, body_text, recipient_email")
      .eq("run_id", queueItem.run_id)
      .limit(1)
      .maybeSingle();

    const { error: queueUpdateError } = await supabase.from("ai_agent_approval_queue").update({
      status: "rejected",
      rejected_by: profileId,
      rejection_reason: rejection_reason || null,
      decided_at: new Date().toISOString(),
    }).eq("id", queue_id);

    if (queueUpdateError) {
      throw queueUpdateError;
    }

    const { error: runUpdateError } = await supabase.from("ai_agent_execution_runs").update({
      execution_status: "blocked",
      approval_status: "rejected",
      final_output_json: { rejected_by: profileId, reason: rejection_reason },
      completed_at: new Date().toISOString(),
    }).eq("id", queueItem.run_id);

    if (runUpdateError) {
      throw runUpdateError;
    }

    if (queueItem.action_id) {
      const { error: actionUpdateError } = await supabase.from("ai_agent_execution_actions").update({
        action_status: "cancelled",
      }).eq("id", queueItem.action_id);

      if (actionUpdateError) {
        throw actionUpdateError;
      }
    }

    const { error: emailUpdateError } = await supabase.from("ai_email_messages").update({
      send_status: "cancelled",
    }).eq("run_id", queueItem.run_id);

    if (emailUpdateError) {
      throw emailUpdateError;
    }

    // Save feedback for learning loop
    const { error: feedbackInsertError } = await supabase.from("ai_agent_feedback").insert({
      organization_id: queueItem.organization_id,
      agent_id: queueItem.agent_id,
      run_id: queueItem.run_id,
      queue_id: queue_id,
      feedback_type: "rejection",
      feedback_text: rejection_reason || null,
      original_output_json: emailForFeedback ? {
        subject: emailForFeedback.subject,
        body_html: emailForFeedback.body_html,
        body_text: emailForFeedback.body_text,
        recipient: emailForFeedback.recipient_email,
      } : {},
      created_by: profileId,
    });

    if (feedbackInsertError) {
      throw feedbackInsertError;
    }

    const { error: auditInsertError } = await supabase.from("ai_agent_audit").insert({
      organization_id: queueItem.organization_id,
      agent_id: queueItem.agent_id,
      actor_id: profileId,
      action_type: "execution_rejected",
      payload_json: { run_id: queueItem.run_id, queue_id, reason: rejection_reason },
    });

    if (auditInsertError) {
      throw auditInsertError;
    }

    return new Response(JSON.stringify({ status: "rejected" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
