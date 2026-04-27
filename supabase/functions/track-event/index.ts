// Sprint C.1: Unified event router with action/outcome classification,
// causal attribution metadata, and anti-overfitting delay queue.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// --- Event taxonomy ---------------------------------------------------------
const ACTION_EVENTS = new Set([
  "email_sent", "email_delivered", "email_opened", "email_clicked",
  "whatsapp_sent", "call_made", "call_connected", "task_created",
]);

const POSITIVE_OUTCOMES = new Set([
  "email_replied", "whatsapp_replied", "meeting_booked",
  "opportunity_qualified", "deal_won",
]);
const NEGATIVE_OUTCOMES = new Set([
  "email_bounced", "deal_lost", "opportunity_disqualified", "unsubscribed",
]);
const OUTCOME_EVENTS = new Set([...POSITIVE_OUTCOMES, ...NEGATIVE_OUTCOMES]);

const SYSTEM_EVENTS = new Set([
  "decision_executed", "enrichment_completed", "opportunity_created",
]);

function classifyEvent(eventType: string): "action" | "outcome" | "system" {
  if (OUTCOME_EVENTS.has(eventType)) return "outcome";
  if (ACTION_EVENTS.has(eventType)) return "action";
  if (SYSTEM_EVENTS.has(eventType)) return "system";
  return "system";
}

const CHANNEL_MAP: Record<string, string> = {
  email_sent: "email", email_delivered: "email", email_opened: "email",
  email_clicked: "email", email_replied: "email", email_bounced: "email",
  whatsapp_sent: "whatsapp", whatsapp_replied: "whatsapp",
  call_made: "call", call_connected: "call",
  meeting_booked: "calendar",
  decision_executed: "system", enrichment_completed: "system",
  opportunity_created: "system", task_created: "system",
  deal_won: "system", deal_lost: "system",
  opportunity_qualified: "system", opportunity_disqualified: "system",
  unsubscribed: "email",
};

const METRIC_MAP: Record<string, string> = {
  email_sent: "sent", email_delivered: "delivered",
  email_opened: "opened", email_replied: "replied",
  whatsapp_sent: "sent", whatsapp_replied: "replied",
  call_made: "sent", meeting_booked: "meetings",
  deal_won: "wins", deal_lost: "losses",
};

// --- Anti-overfitting delays (in minutes) -----------------------------------
const LEARNING_DELAY_MINUTES: Record<string, number> = {
  email_replied: 24 * 60,
  whatsapp_replied: 24 * 60,
  meeting_booked: 6 * 60,
  opportunity_qualified: 6 * 60,
  // immediate (delay = 0): deal_won, deal_lost, unsubscribed, email_bounced,
  // opportunity_disqualified
};

// Canonical attribution fields normalized into payload.attribution
const ATTRIBUTION_KEYS = [
  "playbook_id", "decision_rule_id", "sequence_id",
  "template_id", "template_variant", "channel",
  "owner_id", "touch_number", "source",
];

function normalizeAttribution(metadata: any, channel: string): Record<string, any> {
  const attr: Record<string, any> = {};
  for (const k of ATTRIBUTION_KEYS) {
    if (metadata?.[k] !== undefined && metadata?.[k] !== null) attr[k] = metadata[k];
    else if (metadata?.attribution?.[k] !== undefined) attr[k] = metadata.attribution[k];
  }
  if (!attr.channel) attr.channel = channel;
  return attr;
}

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
    const eventClass = classifyEvent(event_type);
    const channel = CHANNEL_MAP[event_type] ?? "system";
    const attribution = normalizeAttribution(metadata, channel);

    // Idempotency
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

    // 1. Insert canonical event with class + attribution
    const enrichedPayload = { ...metadata, attribution };
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
        event_class: eventClass,
        event_subtype: metadata?.subtype ?? null,
        payload: enrichedPayload,
        source: metadata?.source ?? "track-event",
        external_id: dedup_key,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[track-event] insert error:", insertError);
      return jsonResponse({ error: insertError.message }, 500);
    }

    // 2. Outreach metric increment (only for action/outcome on real channels)
    const metric = METRIC_MAP[event_type];
    if (metric && eventClass !== "system") {
      supabase.rpc("increment_outreach_metric", {
        p_organization_id: organization_id,
        p_channel: channel,
        p_template_type: metadata?.template_type ?? attribution.template_id ?? "default",
        p_variant: attribution.template_variant ?? "default",
        p_metric: metric,
        p_amount: 1,
      }).then(({ error }) => {
        if (error) console.error("[track-event] outreach increment error:", error);
      });
    }

    // 3. Learning loop dispatch — ONLY outcome events ever ensinam.
    if (eventClass === "outcome" && (prospect_id || opportunity_id)) {
      const isPositive = POSITIVE_OUTCOMES.has(event_type);
      const outcome = isPositive ? "positive" : "negative";
      const weight = event_type === "deal_won" ? 3
                   : event_type === "meeting_booked" ? 2 : 1;
      const delayMin = LEARNING_DELAY_MINUTES[event_type] ?? 0;

      if (delayMin === 0) {
        // Definitive outcomes — apply immediately
        fetch(`${SUPABASE_URL}/functions/v1/update-learning-signals`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            organization_id, prospect_id, opportunity_id,
            event_type, outcome, weight, attribution,
          }),
        }).catch((err) => console.error("[track-event] immediate learning failed:", err));
      } else {
        // Delayed outcomes — enqueue for anti-overfitting window.
        // Cancel contradicting earlier pending entries for the same prospect.
        if (prospect_id && event_type === "unsubscribed") {
          await supabase.from("learning_queue")
            .update({ status: "cancelled", cancelled_reason: "contradicted_by_unsubscribe" })
            .eq("prospect_id", prospect_id)
            .eq("status", "pending")
            .in("event_type", ["email_replied", "whatsapp_replied"]);
        }

        const processAfter = new Date(Date.now() + delayMin * 60 * 1000).toISOString();
        const { error: qErr } = await supabase.from("learning_queue").insert({
          organization_id,
          event_id: event.id,
          event_type,
          prospect_id,
          opportunity_id,
          outcome,
          weight,
          process_after: processAfter,
          payload: { attribution, source_metadata: metadata },
        });
        if (qErr) console.error("[track-event] queue insert error:", qErr);
      }
    }

    return jsonResponse({
      status: "ok",
      event_id: event.id,
      event_class: eventClass,
      channel,
      learning: eventClass === "outcome"
        ? (LEARNING_DELAY_MINUTES[event_type] ? "queued" : "immediate")
        : "skipped",
    });
  } catch (err) {
    console.error("[track-event] unhandled:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
