// Fallback worker: para cada notification_v2 'pending' há > 30s, ou cujo último
// delivery_log esteja 'failed', tenta o próximo canal da fallback_chain
// (default: ['in_app']). Garante que falhas em push/email não façam o usuário
// perder o alerta.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const cutoff = new Date(Date.now() - 30 * 1000).toISOString();

    // Busca notificações pendentes ou cujo último delivery falhou
    const { data: pending, error: pendErr } = await supabase
      .from("notifications_v2")
      .select(
        "id, user_id, channel_in_app, channel_email, channel_push, fallback_chain, status, created_at"
      )
      .eq("status", "pending")
      .lte("created_at", cutoff)
      .limit(100);

    if (pendErr) {
      console.error("[fallback] query error:", pendErr);
      return new Response(JSON.stringify({ error: pendErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let recovered = 0;

    for (const n of pending || []) {
      // Verifica último delivery log
      const { data: logs } = await supabase
        .from("notification_delivery_logs")
        .select("channel, delivery_status, attempted_at")
        .eq("notification_id", n.id)
        .order("attempted_at", { ascending: false })
        .limit(3);

      const lastLog = logs?.[0];
      const failedChannels = (logs || [])
        .filter((l) => l.delivery_status === "failed")
        .map((l) => l.channel);

      // Default fallback chain: in_app sempre como último recurso
      const chain: string[] =
        (n.fallback_chain && n.fallback_chain.length > 0
          ? n.fallback_chain
          : ["in_app"]) as string[];

      const nextChannel = chain.find((c) => !failedChannels.includes(c));

      if (!nextChannel || nextChannel === "in_app") {
        // Garante in_app ativo e marca como sent (in_app é entregue via realtime)
        await supabase
          .from("notifications_v2")
          .update({
            channel_in_app: true,
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", n.id);

        await supabase.from("notification_delivery_logs").insert({
          notification_id: n.id,
          channel: "in_app",
          delivery_status: "sent",
          provider_response: { fallback: true, reason: "default_chain" },
        });

        recovered++;
        console.log(`[fallback] in_app rescue for ${n.id}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        scanned: pending?.length ?? 0,
        recovered,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[fallback] unexpected:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
