import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { dispatchAgentEmail } from "../_shared/email-dispatch.ts";
import { normalizeRecipientEmail } from "../_shared/normalize-recipient-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResp({ error: "Missing auth" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const internalSecret = Deno.env.get("INTERNAL_WORKFLOW_SECRET") || "";
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonResp({ error: "Unauthorized" }, 401);

    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("id").eq("user_id", user.id).limit(1).maybeSingle();
    if (profileError) throw profileError;
    const profileId = profile?.id;
    if (!profileId) return jsonResp({ error: "Perfil do usuário não encontrado" }, 403);

    const body = await req.json().catch(() => ({}));
    const { queue_id, edited_subject, edited_body_html, edited_body_text, approval_reason } = body;
    if (!queue_id) return jsonResp({ error: "queue_id required" }, 400);

    const { data: member } = await supabase
      .from("organization_members")
      .select("organization_id, org_role")
      .eq("user_id", user.id).eq("status", "active").limit(1).single();
    if (!member) return jsonResp({ error: "No organization" }, 403);

    // Load queue item — accept pending OR send_failed (retry path)
    const { data: queueItem } = await supabase
      .from("ai_agent_approval_queue")
      .select("*, ai_agent_execution_runs!inner(opportunity_id)")
      .eq("id", queue_id)
      .eq("organization_id", member.organization_id)
      .in("status", ["pending", "send_failed"])
      .single();

    if (!queueItem) return jsonResp({ error: "Approval item not found or already decided" }, 404);

    // === Permission check ===
    const isAdmin = member.org_role === "admin" || member.org_role === "owner";
    let allowed = isAdmin;
    const oppId = (queueItem as any).ai_agent_execution_runs?.opportunity_id;

    if (!allowed && oppId) {
      const { data: opp } = await supabase.from("opportunities")
        .select("owner_user_id").eq("id", oppId).maybeSingle();
      if (opp?.owner_user_id === user.id) allowed = true;
      if (!allowed) {
        const { data: participant } = await supabase.from("deal_participants")
          .select("id").eq("opportunity_id", oppId).eq("user_id", user.id).maybeSingle();
        if (participant) allowed = true;
      }
    }
    if (!allowed) {
      const { data: perm } = await supabase.from("ai_agent_permissions")
        .select("can_approve").eq("organization_id", member.organization_id)
        .eq("user_id", user.id).maybeSingle();
      if (perm?.can_approve) allowed = true;
    }
    if (!allowed) return jsonResp({ error: "Sem permissão para aprovar este e-mail" }, 403);

    // Load email message FIRST — we need it before any state change
    const { data: emailMsg } = await supabase
      .from("ai_email_messages").select("*")
      .eq("run_id", queueItem.run_id).limit(1).single();
    if (!emailMsg) return jsonResp({ error: "Email message not found" }, 404);

    // Normalize recipient (defensive: legacy rows may store contact JSON object)
    const normalizedRecipient = normalizeRecipientEmail(emailMsg.recipient_email);
    if (!normalizedRecipient) {
      const failureMessage = "Destinatário inválido — não foi possível extrair um e-mail válido do contato.";
      const failureCode = "invalid_recipient";
      const nowIso = new Date().toISOString();
      await supabase.from("ai_email_messages").update({
        send_status: "failed",
        delivery_status: "failed",
        send_failure_reason: `[${failureCode}] ${failureMessage}`,
        send_failed_at: nowIso,
      }).eq("id", emailMsg.id);
      await supabase.from("ai_agent_approval_queue").update({
        status: "send_failed",
        decided_at: nowIso,
        rejection_reason: `Falha no envio: [${failureCode}] ${failureMessage}`,
      }).eq("id", queue_id);
      return jsonResp({
        status: "approved_but_send_failed",
        email_id: emailMsg.id,
        error: failureMessage,
        code: failureCode,
        retryable: false,
      }, 502);
    }
    // Heal the row if it was stored in non-canonical form so future retries are clean
    if (typeof emailMsg.recipient_email !== "string" || emailMsg.recipient_email !== normalizedRecipient) {
      await supabase.from("ai_email_messages")
        .update({ recipient_email: normalizedRecipient })
        .eq("id", emailMsg.id);
      emailMsg.recipient_email = normalizedRecipient;
    }

    const wasEdited = !!(edited_subject || edited_body_html || edited_body_text);
    const finalSubject = (edited_subject ?? emailMsg.subject) || "(sem assunto)";
    const finalBodyHtml = (edited_body_html ?? emailMsg.body_html) || "";
    const finalBodyText = (edited_body_text ?? emailMsg.body_text) || null;

    // === Phase 1: persist edits + mark "approving" ===
    const editPatch: Record<string, unknown> = {
      send_status: "approving",
      send_initiated_at: new Date().toISOString(),
      last_send_attempt_at: new Date().toISOString(),
      send_attempts: (emailMsg.send_attempts || 0) + 1,
      send_failure_reason: null,
      send_failed_at: null,
    };
    if (wasEdited) {
      editPatch.subject = finalSubject;
      editPatch.body_html = finalBodyHtml;
      editPatch.body_text = finalBodyText;
      editPatch.was_human_edited = true;
    }
    await supabase.from("ai_email_messages").update(editPatch).eq("id", emailMsg.id);

    const isRetry = queueItem.status === "send_failed";
    const sendAttempts = (emailMsg.send_attempts || 0) + 1;

    // Audit: approval granted (separate from send result)
    await supabase.from("ai_agent_audit").insert({
      organization_id: queueItem.organization_id,
      agent_id: queueItem.agent_id,
      actor_id: profileId,
      action_type: "approval_granted",
      payload_json: {
        run_id: queueItem.run_id,
        queue_id,
        was_edited: wasEdited,
        was_human_edited: wasEdited,
        is_retry: isRetry,
        send_attempts: sendAttempts,
        approval_reason: approval_reason || null,
      },
    });

    // === Phase 2: attempt send through unified dispatcher ===
    const senderUserId = emailMsg.sender_user_id || user.id;
    const dispatch = await dispatchAgentEmail({
      supabaseUrl,
      internalSecret,
      senderUserId,
      recipientEmail: emailMsg.recipient_email,
      subject: finalSubject,
      bodyHtml: finalBodyHtml,
      bodyText: finalBodyText,
      opportunityId: emailMsg.opportunity_id || null,
      contactId: emailMsg.contact_id || null,
      organizationId: emailMsg.organization_id || queueItem.organization_id || null,
    });

    const nowIso = new Date().toISOString();

    if (dispatch.success) {
      // === Success path ===
      await supabase.from("ai_agent_approval_queue").update({
        status: "approved",
        approved_by: profileId,
        approval_reason: approval_reason || null,
        decided_at: nowIso,
      }).eq("id", queue_id);

      await supabase.from("ai_email_messages").update({
        send_status: "sent",
        delivery_status: "sent",
        sent_at: nowIso,
        smtp_message_id: dispatch.messageId || null,
        send_failure_reason: null,
      }).eq("id", emailMsg.id);

      if (queueItem.action_id) {
        await supabase.from("ai_agent_execution_actions").update({
          action_status: "executed",
          result_json: { messageId: dispatch.messageId, sent_at: nowIso },
          provider_reference: dispatch.messageId || null,
        }).eq("id", queueItem.action_id);
      }

      await supabase.from("ai_agent_execution_runs").update({
        execution_status: "executed",
        approval_status: "approved",
        final_output_json: { email_id: emailMsg.id, approved_by: profileId, message_id: dispatch.messageId },
        completed_at: nowIso,
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

      // === PARITY WITH AUTO-SEND: outcome events for dashboards & attribution ===
      // Without these, useAgentOutcomes shows 0 for every manually-approved email.
      try {
        await supabase.from("ai_email_agent_outcomes").insert({
          organization_id: queueItem.organization_id,
          agent_id: queueItem.agent_id,
          agent_version_id: queueItem.agent_version_id,
          run_id: queueItem.run_id,
          email_message_id: emailMsg.id,
          opportunity_id: emailMsg.opportunity_id || null,
          account_id: emailMsg.account_id || null,
          contact_id: emailMsg.contact_id || null,
          outcome_type: "email_sent",
          outcome_value_json: {
            subject: finalSubject,
            auto_sent: false,
            approved_by: profileId,
            was_human_edited: wasEdited,
            send_attempts: sendAttempts,
            is_retry: isRetry,
          },
        });
      } catch (e) {
        console.warn("[approve-email-agent-action] ai_email_agent_outcomes insert failed:", e);
      }

      // Run outcome (7-day attribution window). Idempotent: skip if already exists for this run.
      try {
        const { data: existingOutcome } = await supabase
          .from("ai_agent_run_outcomes")
          .select("id")
          .eq("run_id", queueItem.run_id)
          .maybeSingle();
        if (!existingOutcome) {
          await supabase.from("ai_agent_run_outcomes").insert({
            organization_id: queueItem.organization_id,
            agent_id: queueItem.agent_id,
            agent_version_id: queueItem.agent_version_id,
            run_id: queueItem.run_id,
            email_message_id: emailMsg.id,
            opportunity_id: emailMsg.opportunity_id || null,
            account_id: emailMsg.account_id || null,
            contact_id: emailMsg.contact_id || null,
            email_sent_at: nowIso,
            attribution_window_days: 7,
            attribution_closes_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          });
        }
      } catch (e) {
        console.warn("[approve-email-agent-action] ai_agent_run_outcomes insert failed:", e);
      }

      await supabase.from("ai_agent_audit").insert({
        organization_id: queueItem.organization_id,
        agent_id: queueItem.agent_id,
        actor_id: profileId,
        action_type: "send_succeeded",
        payload_json: {
          run_id: queueItem.run_id,
          queue_id,
          message_id: dispatch.messageId,
          was_human_edited: wasEdited,
          send_attempts: sendAttempts,
          is_retry: isRetry,
          approved_by: profileId,
        },
      });

      await supabase.from("ai_agent_feedback").insert({
        organization_id: queueItem.organization_id,
        agent_id: queueItem.agent_id,
        run_id: queueItem.run_id,
        queue_id: queue_id,
        feedback_type: wasEdited ? "edit" : "positive",
        feedback_text: wasEdited ? approval_reason || "Editado antes de aprovar" : approval_reason || null,
        original_output_json: {
          subject: emailMsg.subject, body_html: emailMsg.body_html,
          body_text: emailMsg.body_text, recipient: emailMsg.recipient_email,
        },
        edited_output_json: wasEdited
          ? { subject: finalSubject, body_html: finalBodyHtml, body_text: finalBodyText }
          : null,
        created_by: profileId,
      });

      return jsonResp({
        status: "approved_and_sent",
        email_id: emailMsg.id,
        message_id: dispatch.messageId,
      });
    }

    // === Failure path: keep item visible, do NOT mark as resolved ===
    const failureMessage = dispatch.errorMessage || "Falha desconhecida no envio";
    const failureCode = dispatch.errorCode || "unknown";

    await supabase.from("ai_email_messages").update({
      send_status: "failed",
      delivery_status: "failed",
      send_failure_reason: `[${failureCode}] ${failureMessage}`,
      send_failed_at: nowIso,
    }).eq("id", emailMsg.id);

    await supabase.from("ai_agent_approval_queue").update({
      status: "send_failed",
      approved_by: profileId,
      approval_reason: approval_reason || null,
      decided_at: nowIso,
      rejection_reason: `Falha no envio: [${failureCode}] ${failureMessage}`,
    }).eq("id", queue_id);

    if (queueItem.action_id) {
      await supabase.from("ai_agent_execution_actions").update({
        action_status: "failed",
        result_json: { error: failureMessage, code: failureCode },
      }).eq("id", queueItem.action_id);
    }

    await supabase.from("ai_agent_execution_runs").update({
      execution_status: "send_failed",
      approval_status: "approved",
      final_output_json: { error: failureMessage, code: failureCode, email_id: emailMsg.id, approved_by: profileId },
      completed_at: nowIso,
    }).eq("id", queueItem.run_id);

    await supabase.from("ai_agent_audit").insert({
      organization_id: queueItem.organization_id,
      agent_id: queueItem.agent_id,
      actor_id: profileId,
      action_type: "send_failed",
      payload_json: {
        run_id: queueItem.run_id,
        queue_id,
        error: failureMessage,
        code: failureCode,
        http_status: dispatch.httpStatus || null,
        was_human_edited: wasEdited,
        send_attempts: sendAttempts,
        is_retry: isRetry,
        approved_by: profileId,
      },
    });

    return jsonResp({
      status: "approved_but_send_failed",
      email_id: emailMsg.id,
      error: failureMessage,
      code: failureCode,
      retryable: failureCode !== "no_smtp" && failureCode !== "missing_internal_secret",
    }, 502);
  } catch (err) {
    console.error("[approve-email-agent-action] fatal:", err);
    return jsonResp({ error: "Internal server error", detail: String(err) }, 500);
  }
});
