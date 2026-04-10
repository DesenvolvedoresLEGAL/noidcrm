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

    const { queue_id, edited_subject, edited_body_html, edited_body_text, approval_reason } = await req.json();
    if (!queue_id) {
      return new Response(JSON.stringify({ error: "queue_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get org membership
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

    // Load queue item
    const { data: queueItem } = await supabase
      .from("ai_agent_approval_queue")
      .select("*")
      .eq("id", queue_id)
      .eq("organization_id", member.organization_id)
      .eq("status", "pending")
      .single();

    if (!queueItem) {
      return new Response(JSON.stringify({ error: "Approval item not found or already decided" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update queue
    await supabase.from("ai_agent_approval_queue").update({
      status: "approved",
      approved_by: user.id,
      approval_reason: approval_reason || null,
      decided_at: new Date().toISOString(),
    }).eq("id", queue_id);

    // Update run
    await supabase.from("ai_agent_execution_runs").update({
      execution_status: "approved",
      approval_status: "approved",
    }).eq("id", queueItem.run_id);

    // Update action
    await supabase.from("ai_agent_execution_actions").update({
      action_status: "approved",
    }).eq("id", queueItem.action_id);

    // Get email message
    const { data: emailMsg } = await supabase
      .from("ai_email_messages")
      .select("*")
      .eq("run_id", queueItem.run_id)
      .limit(1)
      .single();

    if (!emailMsg) {
      return new Response(JSON.stringify({ error: "Email message not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Apply edits if any
    const wasEdited = !!(edited_subject || edited_body_html || edited_body_text);
    const finalSubject = edited_subject || emailMsg.subject;
    const finalBodyHtml = edited_body_html || emailMsg.body_html;
    const finalBodyText = edited_body_text || emailMsg.body_text;

    if (wasEdited) {
      await supabase.from("ai_email_messages").update({
        subject: finalSubject,
        body_html: finalBodyHtml,
        body_text: finalBodyText,
        was_human_edited: true,
        send_status: "approved",
      }).eq("id", emailMsg.id);
    } else {
      await supabase.from("ai_email_messages").update({
        send_status: "approved",
      }).eq("id", emailMsg.id);
    }

    // Send email
    try {
      const sendResp = await fetch(`${supabaseUrl}/functions/v1/send-smtp-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          to: emailMsg.recipient_email,
          subject: finalSubject,
          html: finalBodyHtml || finalBodyText,
          opportunityId: emailMsg.opportunity_id,
          contactId: emailMsg.contact_id,
        }),
      });

      const sendResult = await sendResp.json();

      if (sendResp.ok) {
        await supabase.from("ai_agent_execution_actions").update({
          action_status: "executed",
          result_json: sendResult,
          provider_reference: sendResult.messageId,
        }).eq("id", queueItem.action_id);

        await supabase.from("ai_email_messages").update({
          send_status: "sent",
          delivery_status: "sent",
          sent_at: new Date().toISOString(),
          smtp_message_id: sendResult.messageId,
        }).eq("id", emailMsg.id);

        await supabase.from("ai_agent_execution_runs").update({
          execution_status: "executed",
          final_output_json: { email_id: emailMsg.id, approved_by: user.id },
          completed_at: new Date().toISOString(),
        }).eq("id", queueItem.run_id);

        // Impact event
        await supabase.from("ai_agent_impact_events").insert({
          organization_id: queueItem.organization_id,
          agent_id: queueItem.agent_id,
          agent_version_id: queueItem.agent_version_id,
          run_id: queueItem.run_id,
          opportunity_id: emailMsg.opportunity_id,
          account_id: emailMsg.account_id,
          contact_id: emailMsg.contact_id,
          impact_type: "email_sent",
          impact_value_json: { subject: finalSubject, to: emailMsg.recipient_email, was_human_edited: wasEdited },
        });

        // Audit
        await supabase.from("ai_agent_audit").insert({
          organization_id: queueItem.organization_id,
          agent_id: queueItem.agent_id,
          actor_id: user.id,
          action_type: "execution_approved",
          payload_json: { run_id: queueItem.run_id, queue_id, was_edited: wasEdited },
        });

        return new Response(JSON.stringify({ status: "approved_and_sent", email_id: emailMsg.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        throw new Error(sendResult.error || "Send failed");
      }
    } catch (sendErr) {
      await supabase.from("ai_agent_execution_runs").update({
        execution_status: "failed",
        final_output_json: { error: String(sendErr) },
        completed_at: new Date().toISOString(),
      }).eq("id", queueItem.run_id);

      await supabase.from("ai_email_messages").update({
        send_status: "failed", delivery_status: "failed",
      }).eq("id", emailMsg.id);

      return new Response(JSON.stringify({ status: "approved_but_send_failed", error: String(sendErr) }), {
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
