import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web Push requires signing with VAPID keys
async function generateVapidAuthHeader(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ authorization: string; cryptoKey: string }> {
  const urlObj = new URL(endpoint);
  const audience = `${urlObj.protocol}//${urlObj.host}`;
  
  // JWT header and payload
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: "mailto:notifications@noid-crm.lovable.app",
  };

  const encoder = new TextEncoder();
  
  // Base64url encode
  const b64url = (data: Uint8Array) => {
    let str = "";
    for (const byte of data) str += String.fromCharCode(byte);
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  
  const headerB64 = b64url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = b64url(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key
  const privateKeyBytes = Uint8Array.from(
    atob(vapidPrivateKey.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0)
  );

  const key = await crypto.subtle.importKey(
    "raw",
    privateKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // Sign
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format if needed
  const sigArray = new Uint8Array(signature);
  const signatureB64 = b64url(sigArray);

  const jwt = `${unsignedToken}.${signatureB64}`;

  return {
    authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    cryptoKey: `p256ecdsa=${vapidPublicKey}`,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, title, body, action_url, icon, notification_id } = await req.json();

    if (!user_id || !title) {
      return new Response(
        JSON.stringify({ error: "Missing user_id or title" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get active push subscriptions for user
    const { data: subscriptions, error: subError } = await supabase
      .from("browser_push_subscriptions")
      .select("*")
      .eq("user_id", user_id)
      .eq("is_active", true);

    if (subError || !subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active subscriptions", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pushPayload = JSON.stringify({
      title,
      body: body || "",
      data: { action_url: action_url || "/app/dashboard" },
      icon: icon || "/favicon.ico",
    });

    let sent = 0;
    let failed = 0;
    let warnedMissingNotificationId = false;

    const logDelivery = async (
      deliveryStatus: "sent" | "failed",
      providerResponse: Record<string, unknown>
    ) => {
      if (!notification_id) {
        if (!warnedMissingNotificationId) {
          console.warn("[send-browser-push] missing notification_id, skipping delivery log insert");
          warnedMissingNotificationId = true;
        }
        return;
      }
      await supabase.from("notification_delivery_logs").insert({
        notification_id,
        channel: "push",
        delivery_status: deliveryStatus,
        provider_response: providerResponse,
        attempted_at: new Date().toISOString(),
      });
    };

    for (const sub of subscriptions) {
      try {
        const vapidHeaders = await generateVapidAuthHeader(
          sub.endpoint,
          vapidPublicKey,
          vapidPrivateKey
        );

        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            TTL: "86400",
            Urgency: "high",
            Authorization: vapidHeaders.authorization,
            "Crypto-Key": vapidHeaders.cryptoKey,
          },
          body: new TextEncoder().encode(pushPayload),
        });

        if (response.status === 201 || response.status === 200) {
          sent++;
          await logDelivery("sent", { status: response.status });
        } else if (response.status === 410 || response.status === 404) {
          // Subscription expired — deactivate
          await supabase
            .from("browser_push_subscriptions")
            .update({ is_active: false })
            .eq("id", sub.id);
          failed++;
          await logDelivery("failed", {
            status: response.status,
            error: "subscription_inactive",
          });
        } else {
          const errorText = await response.text();
          console.error(`Push failed for ${sub.endpoint}: ${response.status} ${errorText}`);
          failed++;

          await logDelivery("failed", { status: response.status, error: errorText });
        }
      } catch (pushErr) {
        console.error(`Push error for sub ${sub.id}:`, pushErr);
        failed++;
        await logDelivery("failed", {
          error: pushErr instanceof Error ? pushErr.message : String(pushErr),
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: subscriptions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send browser push error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
