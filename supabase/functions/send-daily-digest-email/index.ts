// Daily digest email sender — Briefing de Ataque do Dia.
// Strategy:
//   1. If user has active user_smtp_configs → send via send-smtp-email-internal.
//   2. Else → fallback to Resend.
//   3. Skip if daily_digest_email_enabled is false.
// Renders the new attack-plan layout when summary.attack_plan is present;
// falls back to the legacy compact layout otherwise.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const APP_URL = Deno.env.get("APP_URL") ?? "https://noid-crm.lovable.app";
const RESEND_FROM = "NOID CRM <noreply@operadora.legal>";

// --- Helpers ---------------------------------------------------------------

const fmtBRL = (v: number | null | undefined) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n === 0) return "R$ 0";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};

const fmtPct = (v: number | null | undefined) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "0%";
  return `${n.toFixed(0)}%`;
};

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch { return "—"; }
};

const severityColor = (sev?: string | null): string => {
  switch (sev) {
    case "critical": return "#ef4444";
    case "attention":
    case "warning": return "#f59e0b";
    case "opportunity":
    case "success": return "#10b981";
    default: return "#4D2BFB";
  }
};

// --- Templates -------------------------------------------------------------

function renderScoreboard(sb: any): string {
  if (!sb) return "";
  const goal = Number(sb.goal_value ?? 0);
  const realized = Number(sb.realized_value ?? 0);
  const remaining = Number(sb.remaining_to_goal ?? Math.max(0, goal - realized));
  const pct = goal > 0 ? Math.min(100, (realized / goal) * 100) : 0;
  const gap = Number(sb.pace_gap_value ?? 0);
  const gapColor = gap < 0 ? "#ef4444" : "#10b981";
  const required = Number(sb.required_daily_rate ?? 0);
  const daysLeft = Number(sb.business_days_remaining ?? 0);
  const statusLabel = sb.status ?? "—";
  const statusColor = severityColor(sb.severity);

  return `
  <tr><td style="padding:8px 24px 4px;">
    <h3 style="margin:0 0 12px;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">📈 Placar do mês</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff;">
      <tr><td style="padding:18px 20px 6px;">
        <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Receita / Meta</div>
        <div style="font-size:26px;font-weight:700;color:#0f172a;margin-top:4px;">${fmtBRL(realized)} <span style="font-size:14px;color:#94a3b8;font-weight:500;">/ ${fmtBRL(goal)}</span></div>
        <div style="margin-top:10px;background:#f1f5f9;border-radius:999px;height:10px;overflow:hidden;">
          <div style="width:${pct.toFixed(1)}%;height:100%;background:linear-gradient(90deg,#4D2BFB,#7c5cfc);"></div>
        </div>
        <div style="margin-top:6px;font-size:12px;color:#475569;">${fmtPct(pct)} da meta · faltam ${fmtBRL(remaining)}</div>
      </td></tr>
      <tr><td style="padding:8px 20px 18px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:10px 8px;border-top:1px solid #f1f5f9;font-size:12px;color:#64748b;">Gap vs pace</td>
            <td style="padding:10px 8px;border-top:1px solid #f1f5f9;font-size:14px;font-weight:600;text-align:right;color:${gapColor};">${gap > 0 ? "+" : ""}${fmtBRL(gap)}</td>
          </tr>
          <tr>
            <td style="padding:10px 8px;border-top:1px solid #f1f5f9;font-size:12px;color:#64748b;">Necessário / dia útil restante</td>
            <td style="padding:10px 8px;border-top:1px solid #f1f5f9;font-size:14px;font-weight:600;text-align:right;color:#0f172a;">${fmtBRL(required)} <span style="color:#94a3b8;font-weight:500;">· ${daysLeft}d</span></td>
          </tr>
          <tr>
            <td style="padding:10px 8px;border-top:1px solid #f1f5f9;font-size:12px;color:#64748b;">Status do pace</td>
            <td style="padding:10px 8px;border-top:1px solid #f1f5f9;font-size:13px;font-weight:600;text-align:right;color:${statusColor};">${statusLabel}</td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>`;
}

function renderPriorities(items: any[]): string {
  if (!items || items.length === 0) {
    return `
    <tr><td style="padding:16px 24px 4px;">
      <h3 style="margin:0 0 8px;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">🎯 Prioridades do dia</h3>
      <div style="border:1px dashed #e5e7eb;border-radius:12px;padding:18px;text-align:center;color:#64748b;font-size:13px;">
        Sem prioridades críticas detectadas hoje. Use o tempo para prospectar.
      </div>
    </td></tr>`;
  }
  const rows = items.map((p) => {
    const sevColor = severityColor(p.severity);
    const valueText = p.value > 0 ? ` · ${fmtBRL(p.value)}` : "";
    const href = p.opportunity_id
      ? `${APP_URL}/app/crm/opportunities/${p.opportunity_id}`
      : `${APP_URL}/app/dashboard`;
    return `
      <tr><td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="width:28px;vertical-align:top;">
            <div style="background:${sevColor};color:#fff;font-weight:700;font-size:12px;border-radius:6px;width:22px;height:22px;line-height:22px;text-align:center;">${p.rank}</div>
          </td>
          <td style="vertical-align:top;padding-left:8px;">
            <a href="${href}" style="display:block;color:#0f172a;text-decoration:none;font-size:14px;font-weight:600;line-height:1.3;">${p.title ?? "Oportunidade"}</a>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">${p.customer ?? "—"}${valueText}</div>
            ${p.why_here ? `<div style="font-size:11px;color:${sevColor};margin-top:6px;font-weight:500;">⚡ ${p.why_here}</div>` : ""}
            ${p.action_label ? `<div style="font-size:11px;color:#475569;margin-top:3px;">▶ ${p.action_label}</div>` : ""}
          </td>
        </tr></table>
      </td></tr>`;
  }).join("");
  return `
  <tr><td style="padding:16px 24px 4px;">
    <h3 style="margin:0 0 8px;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">🎯 Prioridades do dia</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff;">${rows}</table>
  </td></tr>`;
}

function renderCriticalActivities(ca: any): string {
  if (!ca) return "";
  const overdue = Number(ca.overdue_count ?? 0);
  const today = Number(ca.today_count ?? 0);
  const top = Array.isArray(ca.top) ? ca.top : [];
  const rows = top.map((a: any) => {
    const isOverdue = (a.days_overdue ?? 0) > 0;
    const color = isOverdue ? "#ef4444" : "#4D2BFB";
    const when = isOverdue ? `Atrasada ${a.days_overdue}d` : fmtDate(a.scheduled_date);
    const href = a.opportunity_id
      ? `${APP_URL}/app/crm/opportunities/${a.opportunity_id}`
      : `${APP_URL}/app/activities`;
    return `
      <tr><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;">
        <a href="${href}" style="color:#0f172a;text-decoration:none;font-weight:500;">${a.title ?? a.type ?? "Atividade"}</a>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">${a.customer ?? "—"} · <span style="color:${color};font-weight:600;">${when}</span></div>
      </td></tr>`;
  }).join("");
  return `
  <tr><td style="padding:16px 24px 4px;">
    <h3 style="margin:0 0 8px;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">📋 Atividades críticas</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td style="padding:10px;background:${overdue > 0 ? "#fef2f2" : "#f8fafc"};border-radius:8px;text-align:center;width:50%;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Atrasadas</div>
          <div style="font-size:22px;font-weight:700;color:${overdue > 0 ? "#ef4444" : "#0f172a"};">${overdue}</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:10px;background:#f8fafc;border-radius:8px;text-align:center;width:50%;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Para hoje</div>
          <div style="font-size:22px;font-weight:700;color:#4D2BFB;">${today}</div>
        </td>
      </tr>
    </table>
    ${rows ? `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff;">${rows}</table>` : ""}
  </td></tr>`;
}

function renderRisks(r: any): string {
  if (!r) return "";
  const cards = [
    { label: "Propostas vencendo hoje", value: r.proposals_expiring_today, urgent: true },
    { label: "Propostas sem visualização", value: r.proposals_viewed_no_followup, urgent: false },
    { label: "Sem próxima ação", value: r.opportunities_without_next_activity, urgent: false },
    { label: "Eventos < 10 dias", value: r.deals_event_lt_10_days, urgent: true },
  ];
  const cells = cards.map((c, i) => `
    ${i % 2 === 0 && i > 0 ? "</tr><tr>" : ""}
    <td style="padding:6px;width:50%;vertical-align:top;">
      <div style="background:${c.urgent && c.value > 0 ? "#fef2f2" : "#f8fafc"};border:1px solid ${c.urgent && c.value > 0 ? "#fecaca" : "#e5e7eb"};border-radius:10px;padding:12px;">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">${c.label}</div>
        <div style="font-size:22px;font-weight:700;margin-top:4px;color:${c.urgent && c.value > 0 ? "#ef4444" : "#0f172a"};">${c.value ?? 0}</div>
      </div>
    </td>`).join("");
  const valueAtRisk = Number(r.value_at_risk ?? 0);
  return `
  <tr><td style="padding:16px 24px 4px;">
    <h3 style="margin:0 0 8px;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">⚠️ Riscos comerciais</h3>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>
    ${valueAtRisk > 0 ? `<div style="margin-top:10px;padding:10px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;font-size:13px;color:#9a3412;"><strong>Valor total em risco:</strong> ${fmtBRL(valueAtRisk)}</div>` : ""}
  </td></tr>`;
}

function renderLegacyMetrics(summary: any): string {
  const items = [
    { emoji: "🔴", label: "Atividades atrasadas", value: summary.overdue_activities, show: summary.overdue_activities > 0, urgent: true },
    { emoji: "📋", label: "Atividades de hoje", value: summary.today_activities, show: true, urgent: false },
    { emoji: "⏰", label: "Propostas vencendo hoje", value: summary.proposals_expiring_today, show: summary.proposals_expiring_today > 0, urgent: true },
    { emoji: "⏳", label: "Propostas vencendo amanhã", value: summary.proposals_expiring_tomorrow, show: summary.proposals_expiring_tomorrow > 0, urgent: false },
    { emoji: "👁️", label: "Propostas visualizadas (24h)", value: summary.proposal_views_last_24h, show: summary.proposal_views_last_24h > 0, urgent: false },
    { emoji: "💬", label: "Clientes responderam", value: summary.client_replies_last_24h, show: summary.client_replies_last_24h > 0, urgent: false },
    { emoji: "⚠️", label: "Oportunidades paradas", value: summary.stale_opportunities, show: summary.stale_opportunities > 0, urgent: false },
  ].filter(i => i.show);
  const rows = items.map(i => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:15px;">${i.emoji} ${i.label}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:20px;font-weight:bold;text-align:right;color:${i.urgent && i.value > 0 ? '#ef4444' : '#1a1a2e'};">${i.value}</td>
    </tr>`).join("");
  return `<tr><td style="padding:16px 24px;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">${rows}</table></td></tr>`;
}

function buildDigestHtml(userName: string, summary: any): string {
  const ap = summary?.attack_plan;
  const hasAttackPlan = !!ap;
  const headerTitle = hasAttackPlan ? "🎯 Plano de Ataque do Dia" : "📊 Resumo Diário";
  const ctaLabel = hasAttackPlan ? "Abrir plano de ataque do dia" : "Abrir meu CRM";
  const ctaUrl = `${APP_URL}/app/dashboard`;

  const body = hasAttackPlan
    ? `${renderScoreboard(ap.scoreboard)}${renderPriorities(ap.top_priorities)}${renderCriticalActivities(ap.critical_activities)}${renderRisks(ap.risks)}`
    : renderLegacyMetrics(summary);

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;">
<tr><td style="background:linear-gradient(135deg,#4D2BFB,#7c5cfc);padding:28px 24px;text-align:center;">
<h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">${headerTitle}</h1>
<p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px;">${summary.date}</p>
</td></tr>
<tr><td style="padding:24px 24px 4px;">
<h2 style="margin:0;font-size:18px;color:#0f172a;">Bom dia, ${userName}! 👋</h2>
<p style="margin:6px 0 0;font-size:13px;color:#64748b;">${hasAttackPlan ? "Veja onde está sua meta e onde atacar primeiro hoje." : "Você começa o dia com:"}</p>
</td></tr>
${body}
<tr><td style="padding:24px;text-align:center;">
<a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#4D2BFB,#7c5cfc);color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;">${ctaLabel} →</a>
</td></tr>
<tr><td style="padding:14px 24px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:11px;color:#94a3b8;">NOID CRM — Briefing diário das 6h</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

// --- Handler ---------------------------------------------------------------

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

    const { data: settings } = await supabase
      .from("notification_settings")
      .select("daily_digest_email_enabled")
      .eq("user_id", user_id).maybeSingle();
    if (settings && settings.daily_digest_email_enabled === false) {
      return new Response(JSON.stringify({ success: true, method: "skipped_user_pref" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = buildDigestHtml(user_name || "Vendedor", summary);
    const subject = summary?.attack_plan
      ? "🎯 Seu plano de ataque do dia"
      : "📊 Seu resumo diário do NOID";

    const { data: smtpConfig } = await supabase
      .from("user_smtp_configs").select("user_id")
      .eq("user_id", user_id).eq("is_active", true).maybeSingle();

    if (smtpConfig) {
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-smtp-email-internal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-secret": expected },
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

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(
        JSON.stringify({ success: false, method: "no_provider", to: email, error: "No SMTP and no RESEND_API_KEY" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM, to: [email], subject, html }),
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
