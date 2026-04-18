// Internal SMTP sender — used by cron jobs and system processes (no user JWT).
// Auth: x-internal-secret header must match INTERNAL_WORKFLOW_SECRET env var.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const internalSecret = req.headers.get("x-internal-secret");
    const expected = Deno.env.get("INTERNAL_WORKFLOW_SECRET");
    if (!expected || internalSecret !== expected) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { user_id, to_emails, subject, html_body } = await req.json();

    if (!user_id || !to_emails?.length || !subject || !html_body) {
      return new Response(
        JSON.stringify({ error: "user_id, to_emails, subject, html_body required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: smtpConfig, error: smtpError } = await supabaseAdmin
      .from("user_smtp_configs")
      .select("*")
      .eq("user_id", user_id)
      .eq("is_active", true)
      .maybeSingle();

    if (smtpError || !smtpConfig) {
      return new Response(
        JSON.stringify({ error: "SMTP not configured for user", code: "no_smtp" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const toList = Array.isArray(to_emails) ? to_emails : [to_emails];

    const client = new SMTPClient({
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
    });
    await client.close();

    return new Response(
      JSON.stringify({ success: true, method: "smtp", from: fromAddress }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("send-smtp-email-internal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
