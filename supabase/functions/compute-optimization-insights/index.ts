// Sprint D — Compute optimization insights from learning data
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface OrgSettings {
  optimization_auto_mode?: boolean;
  min_sample_size_for_insight?: number;
  max_score_adjustment_per_cycle?: number;
}

const DEFAULT_MIN_SAMPLE = 20;

async function processOrg(
  client: ReturnType<typeof createClient>,
  orgId: string,
  settings: OrgSettings,
) {
  const minSample = Math.max(5, settings.min_sample_size_for_insight ?? DEFAULT_MIN_SAMPLE);
  const insights: Array<Record<string, unknown>> = [];

  // ---------- 1. Signals ----------
  const { data: signals, error: sigErr } = await client
    .from("learning_signals")
    .select("signal_type, signal_value, occurrences, positive_outcomes, negative_outcomes, impact_score, confidence")
    .eq("organization_id", orgId);

  if (sigErr) console.error("[insights] signals fetch error", orgId, sigErr.message);

  if (signals && signals.length > 0) {
    const eligible = signals.filter((s: any) => (s.occurrences ?? 0) >= minSample);
    const baseline =
      eligible.reduce((acc: number, s: any) => acc + (s.positive_outcomes / Math.max(1, s.occurrences)), 0) /
      Math.max(1, eligible.length);

    for (const s of eligible) {
      const rate = s.positive_outcomes / Math.max(1, s.occurrences);
      const delta = rate - baseline;
      if (delta >= 0.2) {
        insights.push({
          organization_id: orgId,
          insight_type: "signal",
          entity_id: `${s.signal_type}::${s.signal_value}`,
          entity_label: `${s.signal_type} = ${s.signal_value}`,
          metric_name: "positive_rate",
          metric_value: Number(rate.toFixed(4)),
          baseline_value: Number(baseline.toFixed(4)),
          delta: Number(delta.toFixed(4)),
          sample_size: s.occurrences,
          confidence_score: Math.min(1, Math.max(0, (s.confidence ?? 0) || Math.min(1, s.occurrences / 100))),
        });
      }
    }
  }

  // ---------- 2 & 3. Templates and channels ----------
  const { data: outreach, error: outErr } = await client
    .from("outreach_performance")
    .select("channel, template_type, variant, sent, delivered, opened, replied, meetings, wins")
    .eq("organization_id", orgId);

  if (outErr) console.error("[insights] outreach fetch error", orgId, outErr.message);

  if (outreach && outreach.length > 0) {
    // Bad templates
    for (const t of outreach as any[]) {
      if ((t.sent ?? 0) >= 100) {
        const replyRate = t.replied / Math.max(1, t.sent);
        if (replyRate < 0.05) {
          insights.push({
            organization_id: orgId,
            insight_type: "template",
            entity_id: `${t.channel}::${t.template_type}::${t.variant}`,
            entity_label: `${t.channel} / ${t.template_type} / ${t.variant}`,
            metric_name: "reply_rate",
            metric_value: Number(replyRate.toFixed(4)),
            baseline_value: 0.05,
            delta: Number((replyRate - 0.05).toFixed(4)),
            sample_size: t.sent,
            confidence_score: Math.min(1, t.sent / 500),
          });
        }
      }
    }

    // Channel comparison
    const byChannel = new Map<string, { sent: number; replied: number }>();
    for (const r of outreach as any[]) {
      const cur = byChannel.get(r.channel) ?? { sent: 0, replied: 0 };
      cur.sent += r.sent ?? 0;
      cur.replied += r.replied ?? 0;
      byChannel.set(r.channel, cur);
    }
    const channelRates = Array.from(byChannel.entries())
      .filter(([_, v]) => v.sent >= minSample)
      .map(([k, v]) => ({ channel: k, rate: v.replied / Math.max(1, v.sent), sent: v.sent }));

    if (channelRates.length >= 2) {
      const sorted = [...channelRates].sort((a, b) => b.rate - a.rate);
      const winner = sorted[0];
      const others = sorted.slice(1);
      const otherAvg = others.reduce((a, b) => a + b.rate, 0) / others.length;
      if (winner.rate >= otherAvg * 2 && winner.rate > 0) {
        insights.push({
          organization_id: orgId,
          insight_type: "channel",
          entity_id: winner.channel,
          entity_label: winner.channel,
          metric_name: "reply_rate",
          metric_value: Number(winner.rate.toFixed(4)),
          baseline_value: Number(otherAvg.toFixed(4)),
          delta: Number((winner.rate - otherAvg).toFixed(4)),
          sample_size: winner.sent,
          confidence_score: Math.min(1, winner.sent / 500),
        });
      }
    }
  }

  if (insights.length === 0) return { org_id: orgId, inserted: 0 };

  const { error: upErr } = await client
    .from("optimization_insights")
    .upsert(insights, { onConflict: "organization_id,insight_type,entity_id,metric_name" });

  if (upErr) {
    console.error("[insights] upsert error", orgId, upErr.message);
    return { org_id: orgId, inserted: 0, error: upErr.message };
  }
  return { org_id: orgId, inserted: insights.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("INTERNAL_WORKFLOW_SECRET");
    if (!expectedSecret || internalSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = createClient(SUPABASE_URL, SERVICE_KEY);
    let orgIds: string[] = [];

    let body: { organization_id?: string } = {};
    try { body = await req.json(); } catch (_) { /* empty body ok */ }

    if (body.organization_id) {
      orgIds = [body.organization_id];
    } else {
      const { data, error } = await client
        .from("organizations")
        .select("id")
        .neq("status", "deleted");
      if (error) throw error;
      orgIds = (data ?? []).map((o: any) => o.id);
    }

    const results: any[] = [];
    for (const id of orgIds) {
      const { data: org } = await client.from("organizations").select("settings").eq("id", id).maybeSingle();
      const settings: OrgSettings = (org?.settings as any) ?? {};
      results.push(await processOrg(client, id, settings));
    }

    const total = results.reduce((a, b) => a + (b.inserted ?? 0), 0);
    return new Response(
      JSON.stringify({ ok: true, processed_orgs: orgIds.length, total_insights: total, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[compute-optimization-insights] fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
