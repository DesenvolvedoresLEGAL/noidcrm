import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const PUSH_FETCH_TIMEOUT_MS = 10_000;
const PUSH_CONCURRENCY = 5;
const PROCESS_BATCH_LIMIT = 50;

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
    const bodyJson = await req.json();
    const mode = bodyJson?.mode === "process" ? "process" : "enqueue";

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

    const processJob = async (job: any) => {
      const userId = job.user_id as string;
      const notificationId = job.notification_id as string | null;
      const pushPayload = JSON.stringify({
        title: job.title,
        body: job.body || "",
        data: { action_url: job.action_url || "/app/dashboard" },
        icon: job.icon || "/favicon.ico",
      });
      const payloadBytes = new TextEncoder().encode(pushPayload);
      let sent = 0;
      let failed = 0;
      let warnedMissingNotificationId = false;

      const logDelivery = async (
        deliveryStatus: "sent" | "failed",
        providerResponse: Record<string, unknown>
      ) => {
        if (!notificationId) {
          if (!warnedMissingNotificationId) {
            console.warn("[send-browser-push] missing notification_id, skipping delivery log insert");
            warnedMissingNotificationId = true;
          }
          return;
        }
        await supabase.from("notification_delivery_logs").insert({
          notification_id: notificationId,
          channel: "push",
          delivery_status: deliveryStatus,
          provider_response: providerResponse,
          attempted_at: new Date().toISOString(),
        });
      };

      const { data: subscriptions, error: subError } = await supabase
        .from("browser_push_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (subError) {
        throw new Error(`subscription_query_failed:${subError.message}`);
      }

      if (!subscriptions || subscriptions.length === 0) {
        return {
          sent: 0,
          failed: 0,
          reason: "no_active_subscriptions",
        };
      }

      const processSubscription = async (sub: any) => {
        try {
          const vapidHeaders = await generateVapidAuthHeader(
            sub.endpoint,
            vapidPublicKey,
            vapidPrivateKey
          );

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), PUSH_FETCH_TIMEOUT_MS);
          let response: Response;
          try {
            response = await fetch(sub.endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/octet-stream",
                "Content-Encoding": "aes128gcm",
                TTL: "86400",
                Urgency: "high",
                Authorization: vapidHeaders.authorization,
                "Crypto-Key": vapidHeaders.cryptoKey,
              },
              body: payloadBytes,
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timeout);
          }

          if (response.status === 201 || response.status === 200) {
            sent++;
            await logDelivery("sent", { status: response.status });
          } else if (response.status === 410 || response.status === 404) {
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
          const isTimeout = pushErr instanceof Error && pushErr.name === "AbortError";
          if (isTimeout) {
            console.error(`Push timeout for sub ${sub.id} after ${PUSH_FETCH_TIMEOUT_MS}ms`);
          }
          console.error(`Push error for sub ${sub.id}:`, pushErr);
          failed++;
          await logDelivery("failed", {
            error: isTimeout
              ? `timeout_${PUSH_FETCH_TIMEOUT_MS}ms`
              : pushErr instanceof Error
                ? pushErr.message
                : String(pushErr),
          });
        }
      };

      let cursor = 0;
      const workers = Array.from(
        { length: Math.min(PUSH_CONCURRENCY, subscriptions.length) },
        async () => {
          while (cursor < subscriptions.length) {
            const idx = cursor;
            cursor += 1;
            await processSubscription(subscriptions[idx]);
          }
        }
      );
      await Promise.all(workers);

      return {
        sent,
        failed,
      };
    };

    if (mode === "enqueue") {
      const { user_id, title, body, action_url, icon, notification_id } = bodyJson;
      if (!user_id || !title) {
        return new Response(
          JSON.stringify({ error: "Missing user_id or title" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("push_delivery_jobs")
        .insert({
          user_id,
          notification_id: notification_id || null,
          title,
          body: body || "",
          action_url: action_url || "/app/dashboard",
          icon: icon || "/favicon.ico",
          status: "pending",
          next_attempt_at: new Date().toISOString(),
        })
        .select("id, status, created_at")
        .single();

      if (error) {
        console.error("[send-browser-push] enqueue failed:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, queued: true, job: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const limitRaw = Number(bodyJson?.limit ?? PROCESS_BATCH_LIMIT);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(PROCESS_BATCH_LIMIT, Math.floor(limitRaw)))
      : PROCESS_BATCH_LIMIT;

    const { data: jobs, error: jobsErr } = await supabase.rpc("claim_push_delivery_jobs", {
      p_limit: limit,
    });

    if (jobsErr) {
      console.error("[send-browser-push] process query failed:", jobsErr);
      return new Response(
        JSON.stringify({ error: jobsErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let sentJobs = 0;
    let failedJobs = 0;

    for (const job of jobs ?? []) {
      try {
        const result = await processJob(job);
        const attempts = (job.attempts ?? 0) + 1;

        if ((result.failed ?? 0) === 0) {
          await supabase
            .from("push_delivery_jobs")
            .update({
              status: "sent",
              attempts,
              processed_at: new Date().toISOString(),
              last_error: null,
            })
            .eq("id", job.id);
          sentJobs++;
        } else {
          const terminal = attempts >= (job.max_attempts ?? 3);
          const backoffMinutes = Math.min(60, Math.max(1, attempts * 5));
          const nextAttemptAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
          await supabase
            .from("push_delivery_jobs")
            .update({
              status: "failed",
              attempts,
              last_error: result.reason ?? "delivery_failed",
              next_attempt_at: terminal ? new Date().toISOString() : nextAttemptAt,
              processed_at: terminal ? new Date().toISOString() : null,
            })
            .eq("id", job.id);
          failedJobs++;
        }
      } catch (err) {
        const attempts = (job.attempts ?? 0) + 1;
        const terminal = attempts >= (job.max_attempts ?? 3);
        const backoffMinutes = Math.min(60, Math.max(1, attempts * 5));
        const nextAttemptAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
        await supabase
          .from("push_delivery_jobs")
          .update({
            status: "failed",
            attempts,
            last_error: err instanceof Error ? err.message : String(err),
            next_attempt_at: terminal ? new Date().toISOString() : nextAttemptAt,
            processed_at: terminal ? new Date().toISOString() : null,
          })
          .eq("id", job.id);
        failedJobs++;
      }

      processed++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        sent_jobs: sentJobs,
        failed_jobs: failedJobs,
        scanned: jobs?.length ?? 0,
      }),
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
