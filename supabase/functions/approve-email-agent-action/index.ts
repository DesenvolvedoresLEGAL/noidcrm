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

    // Get org membership (may be admin/owner)
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

    // Load queue item with run + opportunity context
    const { data: queueItem } = await supabase
      .from("ai_agent_approval_queue")
      .select("*, ai_agent_execution_runs!inner(opportunity_id)")
      .eq("id", queue_id)
      .eq("organization_id", member.organization_id)
      .eq("status", "pending")
      .single();

    if (!queueItem) {
      return new Response(JSON.stringify({ error: "Approval item not found or already decided" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Permission check (expanded) ===
    // Allowed: org admin/owner, OR opportunity owner, OR deal participant, OR explicit can_approve
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
      return new Response(JSON.stringify({ error: "Sem permissão para aprovar este e-mail" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    if (queueItem.action_id) {
      await supabase.from("ai_agent_execution_actions").update({
        action_status: "approved",
      }).eq("id", queueItem.action_id);
    }

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

    // Send email — try internal SMTP first (works without per-user SMTP), then user-context SMTP
    try {
      const internalSecret = Deno.env.get("INTERNAL_WORKFLOW_SECRET");
      const senderUserId = emailMsg.sender_user_id || user.id;

      let sendResp: Response;
      if (internalSecret) {
        sendResp = await fetch(`${supabaseUrl}/functions/v1/send-smtp-email-internal`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": internalSecret,
          },
          body: JSON.stringify({
            sender_user_id: senderUserId,
            to: emailMsg.recipient_email,
            subject: finalSubject,
            html: finalBodyHtml || finalBodyText,
            opportunityId: emailMsg.opportunity_id,
            contactId: emailMsg.contact_id,
          }),
        });
      } else {
        sendResp = await fetch(`${supabaseUrl}/functions/v1/send-smtp-email`, {
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
      }

      const sendResult = await sendResp.json().catch(() => ({}));

      if (sendResp.ok) {
        if (queueItem.action_id) {
          await supabase.from("ai_agent_execution_actions").update({
            action_status: "executed",
            result_json: sendResult,
            provider_reference: sendResult.messageId,
          }).eq("id", queueItem.action_id);
        }

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

        await supabase.from("ai_agent_audit").insert({
          organization_id: queueItem.organization_id,
          agent_id: queueItem.agent_id,
          actor_id: user.id,
          action_type: "execution_approved",
          payload_json: { run_id: queueItem.run_id, queue_id, was_edited: wasEdited },
        });

        // Save feedback for learning loop
        await supabase.from("ai_agent_feedback").insert({
          organization_id: queueItem.organization_id,
          agent_id: queueItem.agent_id,
          run_id: queueItem.run_id,
          queue_id: queue_id,
          feedback_type: wasEdited ? "edit" : "positive",
          feedback_text: wasEdited ? approval_reason || "Editado antes de aprovar" : approval_reason || null,
          original_output_json: {
            subject: emailMsg.subject,
            body_html: emailMsg.body_html,
            body_text: emailMsg.body_text,
            recipient: emailMsg.recipient_email,
          },
          edited_output_json: wasEdited ? {
            subject: finalSubject,
            body_html: finalBodyHtml,
            body_text: finalBodyText,
          } : null,
          created_by: user.id,
        });

        return new Response(JSON.stringify({ status: "approved_and_sent", email_id: emailMsg.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        throw new Error(sendResult.error || `Send failed: ${sendResp.status}`);
      }
    } catch (sendErr) {
      console.error("[approve-email-agent-action] send failed:", sendErr);
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
    return new Response(JSON.stringify({ error: "Internal server error", detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
