import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
  const SLACK_DEFAULT_CHANNEL = Deno.env.get("SLACK_DEFAULT_CHANNEL");

  if (!LOVABLE_API_KEY || !SLACK_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing keys", lovable: !!LOVABLE_API_KEY, slack: !!SLACK_API_KEY }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* no body */ }
  const channel = body.channel || SLACK_DEFAULT_CHANNEL;

  if (!channel) {
    return new Response(JSON.stringify({ error: "No channel provided. Pass `channel` in body or set SLACK_DEFAULT_CHANNEL env." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

  try {
    const res = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": SLACK_API_KEY,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel,
        text: body.text || "🔧 Teste de conectividade Slack - pode ignorar",
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify({ status: res.status, channel, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
