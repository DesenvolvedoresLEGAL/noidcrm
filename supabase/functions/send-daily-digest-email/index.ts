// Daily digest email sender.
// Strategy:
//   1. If user has active user_smtp_configs → send via send-smtp-email-internal (their domain).
//   2. Else → fallback to Resend (RESEND_API_KEY) using NOID's default sender.
//   3. Skip entirely if daily_digest_email_enabled is false.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const APP_URL = Deno.env.get("APP_URL") ?? "https://noid-crm.lovable.app";
const RESEND_FROM = "NOID CRM <noreply@operadora.legal>";

function buildDigestHtml(userName: string, summary: any): string {
  const items = [
    { emoji: "🔴", label: "Atividades atrasadas", value: summary.overdue_activities, show: summary.overdue_activities > 0, urgent: true },
    { emoji: "📋", label: "Atividades de hoje", value: summary.today_activities, show: true, urgent: false },
    { emoji: "⏰", label: "Propostas vencendo hoje", value: summary.proposals_expiring_today, show: summary.proposals_expiring_today > 0, urgent: true },
    { emoji: "⏳", label: "Propostas vencendo amanhã", value: summary.proposals_expiring_tomorrow, show: summary.proposals_expiring_tomorrow > 0, urgent: false },
    { emoji: "👁️", label: "Propostas visualizadas (24h)", value: summary.proposal_views_last_24h, show: summary.proposal_views_last_24h > 0, urgent: false },
    { emoji: "💬", label: "Clientes responderam", value: summary.client_replies_last_24h, show: summary.client_replies_last_24h > 0, urgent: false },
    { emoji: "⚠️", label: "Oportunidades paradas", value: summary.stale_opportunities, show: summary.stale_opportunities > 0, urgent: false },
  ];

  const itemsHtml = items.filter(i => i.show).map(i => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:15px;">${i.emoji} ${i.label}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:20px;font-weight:bold;text-align:right;color:${i.urgent && i.value > 0 ? '#ef4444' : '#1a1a2e'};">${i.value}</td>
    </tr>`).join("");

  const topItemsHtml = (summary.top_items || []).slice(0, 5).map((item: any) => `
    <tr><td style="padding:8px 16px;font-size:14px;">
      ${item.type === "proposal_expiring" ? "⏰" : "⚠️"}
      <a href="${APP_URL}${item.action_url}" style="color:#4D2BFB;text-decoration:none;font-weight:500;">${item.label}</a>
    </td></tr>`).join("");

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(135deg,#4D2BFB,#7c5cfc);padding:32px 24px;text-align:center;">
<h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">📊 Resumo Diário</h1>
<p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">${summary.date}</p>
</td></tr>
<tr><td style="padding:28px 24px 8px;"><h2 style="margin:0;font-size:20px;color:#1a1a2e;">Bom dia, ${userName}! 👋</h2>
<p style="margin:8px 0 0;font-size:15px;color:#64748b;">Você começa o dia com:</p></td></tr>
<tr><td style="padding:16px 24px;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">${itemsHtml}</table></td></tr>
${topItemsHtml ? `<tr><td style="padding:8px 24px 16px;"><h3 style="margin:0 0 8px;font-size:16px;color:#1a1a2e;">🎯 Top Prioridades</h3><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">${topItemsHtml}</table></td></tr>` : ""}
<tr><td style="padding:16px 24px 32px;text-align:center;"><a href="${APP_URL}/app/dashboard" style="display:inline-block;background:linear-gradient(135deg,#4D2BFB,#7c5cfc);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">Abrir meu CRM →</a></td></tr>
<tr><td style="padding:16px 24px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;"><p style="margin:0;font-size:12px;color:#94a3b8;">NOID CRM — Seu resumo diário das 6h</p></td></tr>
</table></td></tr></table></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const internalSecret = req.headers.get("x-internal-secret");
    const expected = Deno.env.get("INTERNAL_WORKFLOW_SECRET");
    if (!expected || internalSecret !== expected) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, email, user_name, summary } = await req.json();
    if (!user_id || !email || !summary) {
      return new Response(JSON.stringify({ error: "user_id, email, summary required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Respect user preference
    const { data: settings } = await supabase
      .from("notification_settings")
      .select("daily_digest_email_enabled")
      .eq("user_id", user_id)
      .maybeSingle();

    if (settings && settings.daily_digest_email_enabled === false) {
      return new Response(JSON.stringify({ success: true, method: "skipped_user_pref" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = buildDigestHtml(user_name || "Vendedor", summary);
    const subject = "📊 Seu resumo diário do NOID";

    // Strategy 1: SMTP custom
    const { data: smtpConfig } = await supabase
      .from("user_smtp_configs")
      .select("user_id")
      .eq("user_id", user_id)
      .eq("is_active", true)
      .maybeSingle();

    if (smtpConfig) {
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-smtp-email-internal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": expected,
        },
        body: JSON.stringify({ user_id, to_emails: [email], subject, html_body: html }),
      });
      const result = await resp.json();
      if (resp.ok) {
        return new Response(JSON.stringify({ success: true, method: "smtp", to: email, ...result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error(`SMTP failed for ${email}, falling back to Resend:`, result);
    }

    // Strategy 2: Resend fallback
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(
        JSON.stringify({ success: false, method: "no_provider", to: email, error: "No SMTP and no RESEND_API_KEY" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [email],
        subject,
        html,
      }),
    });

    const resendResult = await resendResp.json();
    if (!resendResp.ok) {
      console.error(`Resend failed for ${email}:`, resendResult);
      return new Response(
        JSON.stringify({ success: false, method: "resend", to: email, error: resendResult }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, method: "resend", to: email, id: resendResult.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("send-daily-digest-email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
