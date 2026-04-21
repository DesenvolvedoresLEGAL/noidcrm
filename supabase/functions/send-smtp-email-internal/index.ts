// Internal SMTP sender — used by cron jobs, agent approvers, and system processes (no user JWT).
// Auth: x-internal-secret header must match INTERNAL_WORKFLOW_SECRET env var.
//
// Canonical payload (do NOT change without updating _shared/email-dispatch.ts):
//   {
//     user_id: string         // SMTP config owner
//     to_emails: string[]     // recipients
//     subject: string
//     html_body: string
//     text_body?: string
//     cc_emails?: string[]
//     opportunity_id?: string // optional — when provided, logs to opportunity_emails with tracking
//     contact_id?: string
//     organization_id?: string
//   }
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function injectTracking(html: string, emailId: string, baseUrl: string): string {
  const trackOpenUrl = `${baseUrl}/functions/v1/track-email-open?id=${emailId}`;
  const pixel = `<img src="${trackOpenUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`;

  let result = html;
  if (result.includes("</body>")) {
    result = result.replace("</body>", `${pixel}</body>`);
  } else {
    result += pixel;
  }

  result = result.replace(/href="(https?:\/\/[^"]+)"/gi, (_match, url) => {
    const trackClickUrl = `${baseUrl}/functions/v1/track-email-click?id=${emailId}&url=${encodeURIComponent(url)}`;
    return `href="${trackClickUrl}"`;
  });

  return result;
}

function generateMessageId(emailId: string, domain: string): string {
  return `<${emailId}@${domain}>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const internalSecret = req.headers.get("x-internal-secret");
    const expected = Deno.env.get("INTERNAL_WORKFLOW_SECRET");
    if (!expected || internalSecret !== expected) {
      return jsonResp({ error: "Forbidden", code: "forbidden" }, 403);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const payload = await req.json().catch(() => ({}));
    const {
      user_id,
      to_emails,
      subject,
      html_body,
      text_body,
      cc_emails,
      opportunity_id,
      contact_id,
      organization_id,
    } = payload || {};

    if (!user_id || !to_emails?.length || !subject || !html_body) {
      return jsonResp({
        error: "user_id, to_emails, subject, html_body required",
        code: "invalid_payload",
        received: { has_user_id: !!user_id, to_count: to_emails?.length || 0, has_subject: !!subject, has_html: !!html_body },
      }, 400);
    }

    const { data: smtpConfig, error: smtpError } = await supabaseAdmin
      .from("user_smtp_configs")
      .select("*")
      .eq("user_id", user_id)
      .eq("is_active", true)
      .maybeSingle();

    if (smtpError) {
      return jsonResp({ error: `Erro ao buscar SMTP: ${smtpError.message}`, code: "smtp_lookup_error" }, 500);
    }
    if (!smtpConfig) {
      return jsonResp({
        error: "SMTP não configurado para este usuário. Configure em Integrações → SMTP.",
        code: "no_smtp",
      }, 412);
    }

    const toList = Array.isArray(to_emails) ? to_emails : [to_emails];
    const ccList = cc_emails?.length ? (Array.isArray(cc_emails) ? cc_emails : [cc_emails]) : undefined;

    let finalBody = html_body as string;
    if (smtpConfig.signature_html) {
      finalBody += `<br/><br/>--<br/>${smtpConfig.signature_html}`;
    }

    // Step 1: Insert email record BEFORE sending so tracking pixel/links are tied to it
    let emailRecord: { id: string } | null = null;
    if (opportunity_id) {
      const orgId = organization_id || smtpConfig.organization_id;
      const { data, error: insertError } = await supabaseAdmin
        .from("opportunity_emails")
        .insert({
          opportunity_id,
          organization_id: orgId,
          subject,
          body: finalBody,
          from_email: smtpConfig.from_email,
          to_emails: toList,
          cc_emails: ccList ? ccList : [],
          sent_by: user_id,
          sent_at: new Date().toISOString(),
          opened_count: 0,
          direction: "outbound",
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[send-smtp-email-internal] Error logging email:", insertError);
      } else {
        emailRecord = data;
      }
    }

    // Step 2: Inject tracking pixel and rewrite links
    let bodyToSend = finalBody;
    if (emailRecord?.id) {
      bodyToSend = injectTracking(finalBody, emailRecord.id, supabaseUrl);
    }

    // Step 3: Custom Message-ID for thread tracking + Gmail correlation
    const emailDomain = smtpConfig.from_email.split("@")[1] || "noidcrm.app";
    const customMessageId = emailRecord?.id
      ? generateMessageId(emailRecord.id, emailDomain)
      : undefined;

    let client: SMTPClient | null = null;
    try {
      client = new SMTPClient({
        connection: {
          hostname: smtpConfig.smtp_host,
          port: smtpConfig.smtp_port,
          tls: smtpConfig.smtp_port === 465,
          auth: {
            username: smtpConfig.smtp_user,
            password: smtpConfig.smtp_password_encrypted,
          },
        },
      });

      const fromAddress = smtpConfig.from_name
        ? `${smtpConfig.from_name} <${smtpConfig.from_email}>`
        : smtpConfig.from_email;

      const sendOptions: Record<string, unknown> = {
        from: fromAddress,
        to: toList,
        cc: ccList,
        subject,
        html: bodyToSend,
        content: text_body || undefined,
      };
      if (customMessageId) {
        sendOptions.headers = { "Message-ID": customMessageId };
      }

      await client.send(sendOptions as any);
      await client.close();

      // Step 4: Try Gmail thread lookup so respostas sincronizam corretamente
      if (emailRecord?.id) {
        try {
          const { data: syncConfig } = await supabaseAdmin
            .from("email_sync_config")
            .select("access_token_encrypted, token_expires_at, refresh_token_encrypted")
            .eq("user_id", user_id)
            .eq("provider", "gmail")
            .eq("sync_enabled", true)
            .maybeSingle();

          if (syncConfig?.access_token_encrypted) {
            let accessToken = syncConfig.access_token_encrypted;

            if (syncConfig.token_expires_at && new Date(syncConfig.token_expires_at) < new Date()) {
              const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
              const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
              if (clientId && clientSecret && syncConfig.refresh_token_encrypted) {
                const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
                  method: "POST",
                  headers: { "Content-Type": "application/x-www-form-urlencoded" },
                  body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    refresh_token: syncConfig.refresh_token_encrypted,
                    grant_type: "refresh_token",
                  }),
                });
                const tokenData = await tokenResponse.json();
                if (tokenData.access_token) accessToken = tokenData.access_token;
              }
            }

            const searchQuery = `from:${smtpConfig.from_email} to:${toList[0]} subject:"${subject}" newer_than:1h`;
            const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=1`;
            const searchResponse = await fetch(searchUrl, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              if (searchData.messages?.[0]) {
                const gmailMsg = searchData.messages[0];
                await supabaseAdmin
                  .from("opportunity_emails")
                  .update({
                    gmail_message_id: gmailMsg.id,
                    gmail_thread_id: gmailMsg.threadId,
                  })
                  .eq("id", emailRecord.id);
              }
            }
          }
        } catch (gmailError) {
          console.error("[send-smtp-email-internal] Gmail thread lookup failed:", gmailError);
        }
      }

      return jsonResp({
        success: true,
        method: "smtp",
        from: fromAddress,
        messageId: customMessageId || `smtp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        emailId: emailRecord?.id,
      });
    } catch (smtpSendErr) {
      try { await client?.close(); } catch (_) { /* ignore */ }
      const msg = smtpSendErr instanceof Error ? smtpSendErr.message : String(smtpSendErr);
      console.error("send-smtp-email-internal SMTP send error:", msg);
      let code = "smtp_send_failed";
      if (/auth|535|530|invalid login/i.test(msg)) code = "smtp_auth";
      else if (/timeout|timed out/i.test(msg)) code = "smtp_timeout";
      else if (/connect|ECONN|network/i.test(msg)) code = "smtp_connection";
      return jsonResp({ error: `Falha SMTP: ${msg}`, code }, 502);
    }
  } catch (error) {
    console.error("send-smtp-email-internal error:", error);
    return jsonResp({
      error: error instanceof Error ? error.message : "Unknown error",
      code: "internal_error",
    }, 500);
  }
});
