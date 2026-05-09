// Sprint C — Posts a Slack Block Kit notification when a new approval request lands.
// Triggered by an AFTER INSERT trigger on public.approval_requests via pg_net.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RISK_EMOJI: Record<string, string> = {
  low: "🟢",
  medium: "🟡",
  high: "🟠",
  critical: "🔴",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { approval_id } = await req.json().catch(() => ({}));
    if (!approval_id) {
      return new Response(JSON.stringify({ ok: false, error: "approval_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const APP_BASE = Deno.env.get("APP_BASE_URL") || "https://crm.humanoid-os.ai";
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Load approval + action metadata
    const { data: approval, error: appErr } = await supabase
      .from("approval_requests")
      .select("id, organization_id, action_key, requester_type, requester_user_id, requester_agent_id, entity_type, entity_id, payload, risk_level, requested_at, expires_at")
      .eq("id", approval_id)
      .maybeSingle();

    if (appErr || !approval) {
      console.error("[notify-approval-request] approval not found", appErr);
      return new Response(JSON.stringify({ ok: false, error: "not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve org Slack channel
    const { data: org } = await supabase
      .from("organizations")
      .select("slack_channel_id, name")
      .eq("id", approval.organization_id)
      .maybeSingle();

    const channel = org?.slack_channel_id || Deno.env.get("SLACK_DEFAULT_CHANNEL");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");

    if (!channel || !LOVABLE_API_KEY || !SLACK_API_KEY) {
      console.warn("[notify-approval-request] Slack not configured — skipping", {
        hasChannel: !!channel, hasLovable: !!LOVABLE_API_KEY, hasSlack: !!SLACK_API_KEY,
      });
      return new Response(JSON.stringify({ ok: true, skipped: "slack_not_configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const risk = (approval.risk_level || "medium").toLowerCase();
    const emoji = RISK_EMOJI[risk] ?? "⚪";
    const link = `${APP_BASE}/app/settings/noid-intelligence/approvals?id=${approval.id}`;

    const blocks = [
      {
        type: "header",
        text: { type: "plain_text", text: `${emoji} Nova aprovação pendente` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Ação:*\n\`${approval.action_key}\`` },
          { type: "mrkdwn", text: `*Risco:*\n${risk.toUpperCase()}` },
          { type: "mrkdwn", text: `*Solicitante:*\n${approval.requester_type}` },
          { type: "mrkdwn", text: `*Org:*\n${org?.name ?? approval.organization_id}` },
        ],
      },
      ...(approval.entity_type ? [{
        type: "context",
        elements: [{ type: "mrkdwn", text: `Entidade: \`${approval.entity_type}\`${approval.entity_id ? ` · ID \`${approval.entity_id}\`` : ""}` }],
      }] : []),
      {
        type: "actions",
        elements: [
          {
            type: "button",
            style: "primary",
            text: { type: "plain_text", text: "Abrir fila de aprovações" },
            url: link,
          },
        ],
      },
    ];

    const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
    const slackRes = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": SLACK_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel,
        text: `Nova aprovação pendente: ${approval.action_key}`,
        blocks,
      }),
    });
    const slackJson = await slackRes.json();

    if (!slackJson.ok) {
      console.error("[notify-approval-request] Slack post failed", slackJson);
      return new Response(JSON.stringify({ ok: false, slack_error: slackJson.error }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, ts: slackJson.ts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[notify-approval-request] error", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
