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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const payload = await req.json().catch(() => ({}));
    const { user_id, to_emails, subject, html_body, text_body } = payload || {};

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

      await client.send({
        from: fromAddress,
        to: toList,
        subject,
        html: html_body,
        content: text_body || undefined,
      });
      await client.close();

      return jsonResp({
        success: true,
        method: "smtp",
        from: fromAddress,
        messageId: `smtp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      });
    } catch (smtpSendErr) {
      try { await client?.close(); } catch (_) { /* ignore */ }
      const msg = smtpSendErr instanceof Error ? smtpSendErr.message : String(smtpSendErr);
      console.error("send-smtp-email-internal SMTP send error:", msg);
      // Heurística simples para classificar
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
