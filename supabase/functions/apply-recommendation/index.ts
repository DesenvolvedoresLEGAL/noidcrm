// Sprint D — Apply optimization recommendation
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const MAX_SCORE_ABS = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { recommendation_id, auto = false } = await req.json();
    if (!recommendation_id) {
      return new Response(JSON.stringify({ error: "recommendation_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Resolve user (manual path)
    let userId: string | null = null;
    if (!auto) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: u } = await userClient.auth.getUser();
      userId = u?.user?.id ?? null;
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: rec, error: recErr } = await admin
      .from("optimization_recommendations")
      .select("*")
      .eq("id", recommendation_id)
      .maybeSingle();
    if (recErr || !rec) {
      return new Response(JSON.stringify({ error: "Recommendation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (rec.status !== "pending") {
      return new Response(JSON.stringify({ ok: true, skipped: true, status: rec.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Manual path: verify admin role for this org
    if (!auto && userId) {
      const { data: isAdmin } = await admin.rpc("is_org_admin", {
        _org_id: rec.organization_id,
        _user_id: userId,
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let result: Record<string, unknown> = {};
    let success = true;
    let errorMessage: string | null = null;

    try {
      const payload = (rec.action_payload ?? {}) as any;

      // Sprint E — Route experiment-driven promotions to the dedicated function.
      if (payload?.promote_via === "promote-winning-variant" && payload?.hypothesis_id) {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/promote-winning-variant`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({
            hypothesis_id: payload.hypothesis_id,
            recommendation_id: rec.id,
            executed_by: userId,
          }),
        });
        const text = await resp.text();
        let parsed: any = null; try { parsed = JSON.parse(text); } catch (_) {}
        if (!resp.ok || !parsed?.ok) throw new Error(parsed?.error || `promote failed (${resp.status})`);
        result = { promoted: true, hypothesis_id: payload.hypothesis_id, applied: parsed.applied };
        break_switch_label: {
          // Skip the regular switch; logging + status update below still runs.
        }
      } else {
      switch (rec.recommendation_type) {
        case "score_adjustment": {
          const { signal_type, signal_value, adjustment } = payload;
          if (!signal_type || !signal_value || typeof adjustment !== "number") {
            throw new Error("Invalid score_adjustment payload");
          }
          const { data: current } = await admin
            .from("learning_signals")
            .select("id, impact_score")
            .eq("organization_id", rec.organization_id)
            .eq("signal_type", signal_type)
            .eq("signal_value", signal_value)
            .maybeSingle();
          if (!current) throw new Error("Signal not found");
          const newScore = Math.max(-MAX_SCORE_ABS, Math.min(MAX_SCORE_ABS, (Number(current.impact_score) || 0) + adjustment));
          await admin.from("learning_signals").update({ impact_score: newScore, last_recalculated_at: new Date().toISOString() }).eq("id", current.id);
          result = { previous: current.impact_score, new: newScore };
          break;
        }
        case "template_change": {
          // Soft signal: store deprecation in organizations.settings
          const { data: org } = await admin.from("organizations").select("settings").eq("id", rec.organization_id).maybeSingle();
          const settings = (org?.settings as any) ?? {};
          const deprecated: string[] = settings.deprecated_templates ?? [];
          if (!deprecated.includes(payload.entity_id)) deprecated.push(payload.entity_id);
          await admin.from("organizations").update({ settings: { ...settings, deprecated_templates: deprecated } }).eq("id", rec.organization_id);
          result = { deprecated_templates: deprecated };
          break;
        }
        case "channel_shift": {
          const { data: org } = await admin.from("organizations").select("settings").eq("id", rec.organization_id).maybeSingle();
          const settings = (org?.settings as any) ?? {};
          await admin.from("organizations").update({ settings: { ...settings, preferred_channel: payload.preferred_channel } }).eq("id", rec.organization_id);
          result = { preferred_channel: payload.preferred_channel };
          break;
        }
        case "rule_change": {
          if (payload.rule_id && typeof payload.is_active === "boolean") {
            await admin.from("decision_rules").update({ is_active: payload.is_active }).eq("id", payload.rule_id).eq("organization_id", rec.organization_id);
            result = { rule_id: payload.rule_id, is_active: payload.is_active };
          } else {
            throw new Error("Invalid rule_change payload");
          }
          break;
        }
        case "playbook_change":
        default:
          throw new Error(`Unsupported recommendation_type: ${rec.recommendation_type}`);
      }
      } // end else (non-experiment branch)
    } catch (e) {
      success = false;
      errorMessage = e instanceof Error ? e.message : "Unknown error";
      console.error("[apply-recommendation] action failed", errorMessage);
    }

    // Log
    await admin.from("optimization_actions_log").insert({
      organization_id: rec.organization_id,
      recommendation_id: rec.id,
      action_type: rec.recommendation_type,
      executed: success,
      result,
      error_message: errorMessage,
      executed_by: userId,
    });

    // Update status
    const newStatus = success ? (auto ? "auto_applied" : "accepted") : "failed";
    await admin
      .from("optimization_recommendations")
      .update({ status: newStatus, reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq("id", rec.id);

    return new Response(JSON.stringify({ ok: success, status: newStatus, result, error: errorMessage }), {
      status: success ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[apply-recommendation] fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
