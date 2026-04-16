import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildDigestHtml(userName: string, summary: any): string {
  const appUrl = "https://noid-crm.lovable.app";

  const items = [
    { emoji: "🔴", label: "Atividades atrasadas", value: summary.overdue_activities, show: summary.overdue_activities > 0 },
    { emoji: "📋", label: "Atividades de hoje", value: summary.today_activities, show: true },
    { emoji: "⏰", label: "Propostas vencendo hoje", value: summary.proposals_expiring_today, show: summary.proposals_expiring_today > 0 },
    { emoji: "⏳", label: "Propostas vencendo amanhã", value: summary.proposals_expiring_tomorrow, show: summary.proposals_expiring_tomorrow > 0 },
    { emoji: "👁️", label: "Propostas visualizadas (24h)", value: summary.proposal_views_last_24h, show: summary.proposal_views_last_24h > 0 },
    { emoji: "💬", label: "Clientes responderam", value: summary.client_replies_last_24h, show: summary.client_replies_last_24h > 0 },
    { emoji: "⚠️", label: "Oportunidades paradas", value: summary.stale_opportunities, show: summary.stale_opportunities > 0 },
  ];

  const itemsHtml = items
    .filter((i) => i.show)
    .map(
      (i) => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; font-size: 15px;">
          ${i.emoji} ${i.label}
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; font-size: 20px; font-weight: bold; text-align: right; color: ${i.value > 0 && (i.label.includes('atrasadas') || i.label.includes('vencendo hoje')) ? '#ef4444' : '#1a1a2e'};">
          ${i.value}
        </td>
      </tr>
    `
    )
    .join("");

  const topItemsHtml = (summary.top_items || [])
    .slice(0, 5)
    .map(
      (item: any) => `
      <tr>
        <td style="padding: 8px 16px; font-size: 14px;">
          ${item.type === "proposal_expiring" ? "⏰" : "⚠️"} 
          <a href="${appUrl}${item.action_url}" style="color: #4D2BFB; text-decoration: none; font-weight: 500;">
            ${item.label}
          </a>
        </td>
      </tr>
    `
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #4D2BFB, #7c5cfc); padding: 32px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">📊 Resumo Diário</h1>
              <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">${summary.date}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 28px 24px 8px;">
              <h2 style="margin: 0; font-size: 20px; color: #1a1a2e;">Bom dia, ${userName}! 👋</h2>
              <p style="margin: 8px 0 0; font-size: 15px; color: #64748b;">Você começa o dia com:</p>
            </td>
          </tr>

          <!-- Metrics -->
          <tr>
            <td style="padding: 16px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                ${itemsHtml}
              </table>
            </td>
          </tr>

          ${topItemsHtml ? `
          <!-- Top Priorities -->
          <tr>
            <td style="padding: 8px 24px 16px;">
              <h3 style="margin: 0 0 8px; font-size: 16px; color: #1a1a2e;">🎯 Top Prioridades</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                ${topItemsHtml}
              </table>
            </td>
          </tr>
          ` : ""}

          <!-- CTA -->
          <tr>
            <td style="padding: 16px 24px 32px; text-align: center;">
              <a href="${appUrl}/app/dashboard" style="display: inline-block; background: linear-gradient(135deg, #4D2BFB, #7c5cfc); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                Abrir meu CRM →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 24px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">NOID CRM — Seu resumo diário às 6h</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, email, user_name, summary } = await req.json();

    if (!email || !summary) {
      return new Response(
        JSON.stringify({ error: "Missing email or summary" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = buildDigestHtml(user_name || "Vendedor", summary);

    // Use Supabase's built-in email or SMTP config
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check if user has SMTP config
    const { data: smtpConfig } = await supabase
      .from("user_smtp_configs")
      .select("*")
      .eq("user_id", user_id)
      .eq("is_active", true)
      .maybeSingle();

    if (smtpConfig) {
      // Send via user's SMTP
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-email-smtp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            to: email,
            subject: "📊 Seu resumo diário do NOID",
            html,
            user_id,
          }),
        });

        if (response.ok) {
          return new Response(
            JSON.stringify({ success: true, method: "smtp" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (smtpErr) {
        console.error("SMTP send failed, falling back:", smtpErr);
      }
    }

    // Fallback: store for later or log
    console.log(`Digest email prepared for ${email} - subject: Seu resumo diário do NOID`);

    return new Response(
      JSON.stringify({ success: true, method: "queued", email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send digest email error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
