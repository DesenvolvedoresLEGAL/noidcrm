// Sprint C: Unified event router for the Learning Loop.
// Writes to revenue_events (canonical) and dispatches downstream learning updaters.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const POSITIVE_EVENTS = new Set([
  "email_replied",
  "whatsapp_replied",
  "meeting_booked",
  "opportunity_qualified",
  "deal_won",
]);
const NEGATIVE_EVENTS = new Set([
  "email_bounced",
  "deal_lost",
  "opportunity_disqualified",
  "unsubscribed",
]);
const TERMINAL_EVENTS = new Set([...POSITIVE_EVENTS, ...NEGATIVE_EVENTS]);

const CHANNEL_MAP: Record<string, string> = {
  email_sent: "email",
  email_delivered: "email",
  email_opened: "email",
  email_clicked: "email",
  email_replied: "email",
  email_bounced: "email",
  whatsapp_sent: "whatsapp",
  whatsapp_replied: "whatsapp",
  call_made: "call",
  call_connected: "call",
  meeting_booked: "calendar",
  decision_executed: "system",
  enrichment_completed: "system",
  opportunity_created: "system",
  task_created: "system",
  deal_won: "system",
  deal_lost: "system",
  opportunity_qualified: "system",
};

const METRIC_MAP: Record<string, string> = {
  email_sent: "sent",
  email_delivered: "delivered",
  email_opened: "opened",
  email_replied: "replied",
  whatsapp_sent: "sent",
  whatsapp_replied: "replied",
  call_made: "sent",
  meeting_booked: "meetings",
  deal_won: "wins",
  deal_lost: "losses",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      event_type,
      organization_id,
      prospect_id = null,
      opportunity_id = null,
      account_id = null,
      contact_id = null,
      user_id = null,
      metadata = {},
      dedup_key = null,
    } = body || {};

    if (!event_type || !organization_id) {
      return jsonResponse({ error: "event_type and organization_id are required" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Idempotency: if dedup_key provided, skip if same event already exists for this entity
    if (dedup_key) {
      const { data: existing } = await supabase
        .from("revenue_events")
        .select("id")
        .eq("organization_id", organization_id)
        .eq("event_type", event_type)
        .eq("external_id", dedup_key)
        .maybeSingle();
      if (existing) {
        return jsonResponse({ status: "duplicate_skipped", event_id: existing.id });
      }
    }

    const channel = CHANNEL_MAP[event_type] ?? "system";

    // 1. Insert canonical event into revenue_events
    const { data: event, error: insertError } = await supabase
      .from("revenue_events")
      .insert({
        organization_id,
        prospect_id,
        opportunity_id,
        account_id,
        contact_id,
        user_id,
        channel,
        event_type,
        event_subtype: metadata?.subtype ?? null,
        payload: metadata,
        source: metadata?.source ?? "track-event",
        external_id: dedup_key,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[track-event] insert error:", insertError);
      return jsonResponse({ error: insertError.message }, 500);
    }

    // 2. Update outreach_performance counter (fire-and-forget)
    const metric = METRIC_MAP[event_type];
    if (metric) {
      supabase
        .rpc("increment_outreach_metric", {
          p_organization_id: organization_id,
          p_channel: channel,
          p_template_type: metadata?.template_type ?? "default",
          p_variant: metadata?.variant ?? "default",
          p_metric: metric,
          p_amount: 1,
        })
        .then(({ error }) => {
          if (error) console.error("[track-event] outreach increment error:", error);
        });
    }

    // 3. For terminal events, dispatch learning update (fire-and-forget)
    if (TERMINAL_EVENTS.has(event_type) && (prospect_id || opportunity_id)) {
      const isPositive = POSITIVE_EVENTS.has(event_type);
      fetch(`${SUPABASE_URL}/functions/v1/update-learning-signals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          organization_id,
          prospect_id,
          opportunity_id,
          event_type,
          outcome: isPositive ? "positive" : "negative",
          weight: event_type === "deal_won" ? 3 : event_type === "meeting_booked" ? 2 : 1,
        }),
      }).catch((err) => console.error("[track-event] learning dispatch failed:", err));
    }

    return jsonResponse({ status: "ok", event_id: event.id, channel });
  } catch (err) {
    console.error("[track-event] unhandled:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
