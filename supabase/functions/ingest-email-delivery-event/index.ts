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

    const { email_message_id, event_type, provider, provider_message_id, payload } = await req.json();

    if (!email_message_id || !event_type) {
      return new Response(JSON.stringify({ error: "email_message_id and event_type required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validEvents = ["queued", "sent", "delivered", "opened", "replied", "bounced", "failed"];
    if (!validEvents.includes(event_type)) {
      return new Response(JSON.stringify({ error: `Invalid event_type. Must be one of: ${validEvents.join(", ")}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get email message
    const { data: emailMsg } = await supabase
      .from("ai_email_messages")
      .select("*, ai_agent_execution_runs!inner(agent_id, agent_version_id, organization_id)")
      .eq("id", email_message_id)
      .single();

    if (!emailMsg) {
      return new Response(JSON.stringify({ error: "Email message not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const run = (emailMsg as any).ai_agent_execution_runs;
    const now = new Date().toISOString();

    // Insert delivery event
    await supabase.from("ai_email_delivery_events").insert({
      organization_id: run.organization_id,
      email_message_id,
      event_type,
      provider: provider || null,
      provider_message_id: provider_message_id || null,
      payload_json: payload || {},
      event_at: now,
    });

    // Update email message delivery status
    const statusMap: Record<string, string> = {
      queued: "queued", sent: "sent", delivered: "delivered",
      opened: "opened", replied: "replied", bounced: "bounced", failed: "failed",
    };
    await supabase.from("ai_email_messages").update({
      delivery_status: statusMap[event_type] || event_type,
    }).eq("id", email_message_id);

    // Create impact events for significant events
    const impactMap: Record<string, string> = {
      opened: "email_opened",
      replied: "email_replied",
    };

    if (impactMap[event_type]) {
      await supabase.from("ai_agent_impact_events").insert({
        organization_id: run.organization_id,
        agent_id: run.agent_id,
        agent_version_id: run.agent_version_id,
        run_id: emailMsg.run_id,
        opportunity_id: emailMsg.opportunity_id,
        account_id: emailMsg.account_id,
        contact_id: emailMsg.contact_id,
        impact_type: impactMap[event_type],
        impact_value_json: { email_message_id, event_type },
      });

      // Audit
      await supabase.from("ai_agent_audit").insert({
        organization_id: run.organization_id,
        agent_id: run.agent_id,
        action_type: "delivery_event_ingested",
        payload_json: { email_message_id, event_type },
      });
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
