import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildDigestHtml(firstName: string, summary: any): string {
  const items = [
    { count: summary.overdue_activities, label: "atividades atrasadas", icon: "🔴", show: summary.overdue_activities > 0 },
    { count: summary.today_activities, label: "atividades do dia", icon: "📋", show: summary.today_activities > 0 },
    { count: summary.proposals_expiring_today, label: "propostas vencendo hoje", icon: "⏰", show: summary.proposals_expiring_today > 0 },
    { count: summary.proposals_expiring_tomorrow, label: "propostas vencendo amanhã", icon: "⚠️", show: summary.proposals_expiring_tomorrow > 0 },
    { count: summary.proposal_views_last_24h, label: "propostas abertas ontem", icon: "👀", show: summary.proposal_views_last_24h > 0 },
    { count: summary.client_replies_last_24h, label: "cliente(s) respondeu(ram)", icon: "💬", show: summary.client_replies_last_24h > 0 },
    { count: summary.stale_opportunities, label: "oportunidades paradas", icon: "⚡", show: summary.stale_opportunities > 0 },
  ];

  const visibleItems = items.filter(i => i.show);

  const itemsHtml = visibleItems.length > 0
    ? visibleItems.map(i =>
        `<tr>
          <td style="padding:8px 12px;font-size:16px;border-bottom:1px solid #f0f0f0;">
            ${i.icon} <strong>${i.count}</strong> ${i.label}
          </td>
        </tr>`
      ).join("")
    : `<tr><td style="padding:12px;font-size:14px;color:#888;">Nenhuma pendência hoje. Bom trabalho! 🎉</td></tr>`;

  const topItemsHtml = (summary.top_items || []).length > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
        <tr><td style="padding:12px 0 8px;font-size:14px;font-weight:bold;color:#333;">🎯 Top Prioridades</td></tr>
        ${(summary.top_items || []).map((item: any) =>
          `<tr><td style="padding:6px 12px;font-size:14px;color:#555;border-left:3px solid #3B82F6;">
            ${item.label}
          </td></tr>`
        ).join("")}
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#1e293b,#334155);padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">☀️ Bom dia, ${firstName}!</h1>
          <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">Seu resumo diário do NOID — ${summary.date}</p>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#333;">Você começa o dia com:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:6px;overflow:hidden;">
            ${itemsHtml}
          </table>
          ${topItemsHtml}
        </td></tr>
        <tr><td align="center" style="padding:0 32px 32px;">
          <a href="https://noid-crm.lovable.app/app/dashboard" 
             style="display:inline-block;padding:12px 32px;background:#3B82F6;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
            Abrir meu CRM →
          </a>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#f8fafc;text-align:center;">
          <p style="margin:0;font-size:12px;color:#999;">NOID CRM — Seu assistente de vendas</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, email, first_name, summary } = await req.json();

    if (!email || !summary) {
      return new Response(JSON.stringify({ error: "email and summary required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const html = buildDigestHtml(first_name || "Usuário", summary);

    // Try to send via transactional email system if available
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          templateName: "daily-digest",
          recipientEmail: email,
          idempotencyKey: `daily-digest-${user_id}-${summary.date}`,
          templateData: { firstName: first_name, summary },
          // Fallback: if template not registered, use raw HTML
          rawHtml: html,
          rawSubject: "☀️ Seu resumo diário do NOID",
        }),
      });

      if (resp.ok) {
        // Update run as email sent
        await supabase
          .from("daily_digest_runs")
          .update({ email_sent: true })
          .eq("user_id", user_id)
          .eq("run_date", summary.date);

        return new Response(JSON.stringify({ sent: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {
      // Transactional email not available, skip
    }

    console.log(`[send-daily-digest-email] Email would be sent to ${email} for ${summary.date}`);

    return new Response(
      JSON.stringify({ sent: false, reason: "transactional email system not configured" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-daily-digest-email] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
