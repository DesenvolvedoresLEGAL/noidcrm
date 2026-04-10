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

    const { queue_id, rejection_reason } = await req.json();
    if (!queue_id) {
      return new Response(JSON.stringify({ error: "queue_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: member } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!member) {
      return new Response(JSON.stringify({ error: "No organization" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check approval permission
    const { data: perm } = await supabase
      .from("ai_agent_permissions")
      .select("can_approve")
      .eq("organization_id", member.organization_id)
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (perm && !perm.can_approve) {
      return new Response(JSON.stringify({ error: "Sem permissão de aprovação" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: queueItem } = await supabase
      .from("ai_agent_approval_queue")
      .select("*")
      .eq("id", queue_id)
      .eq("organization_id", member.organization_id)
      .eq("status", "pending")
      .single();

    if (!queueItem) {
      return new Response(JSON.stringify({ error: "Item not found or already decided" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update queue
    await supabase.from("ai_agent_approval_queue").update({
      status: "rejected",
      rejected_by: user.id,
      rejection_reason: rejection_reason || null,
      decided_at: new Date().toISOString(),
    }).eq("id", queue_id);

    // Update run
    await supabase.from("ai_agent_execution_runs").update({
      execution_status: "blocked",
      approval_status: "rejected",
      final_output_json: { rejected_by: user.id, reason: rejection_reason },
      completed_at: new Date().toISOString(),
    }).eq("id", queueItem.run_id);

    // Update action
    if (queueItem.action_id) {
      await supabase.from("ai_agent_execution_actions").update({
        action_status: "cancelled",
      }).eq("id", queueItem.action_id);
    }

    // Update email
    await supabase.from("ai_email_messages").update({
      send_status: "cancelled",
    }).eq("run_id", queueItem.run_id);

    // Audit
    await supabase.from("ai_agent_audit").insert({
      organization_id: queueItem.organization_id,
      agent_id: queueItem.agent_id,
      actor_id: user.id,
      action_type: "execution_rejected",
      payload_json: { run_id: queueItem.run_id, queue_id, reason: rejection_reason },
    });

    return new Response(JSON.stringify({ status: "rejected" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
