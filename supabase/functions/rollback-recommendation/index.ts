// Sprint D — Rollback an applied recommendation
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
    const { recommendation_id } = await req.json();
    if (!recommendation_id) {
      return new Response(JSON.stringify({ error: "recommendation_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Auth: only Owner/Admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    const userId = u?.user?.id ?? null;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: rec } = await admin
      .from("optimization_recommendations")
      .select("*")
      .eq("id", recommendation_id)
      .maybeSingle();
    if (!rec) {
      return new Response(JSON.stringify({ error: "Recommendation not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["accepted", "auto_applied"].includes(rec.status)) {
      return new Response(JSON.stringify({ error: `Cannot rollback recommendation with status ${rec.status}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await admin.rpc("is_org_admin", {
      _org_id: rec.organization_id, _user_id: userId,
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the most recent successful apply log for this rec
    const { data: lastLog } = await admin
      .from("optimization_actions_log")
      .select("*")
      .eq("recommendation_id", rec.id)
      .eq("executed", true)
      .order("executed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastLog) {
      return new Response(JSON.stringify({ error: "No successful apply log found to rollback" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (rec.action_payload ?? {}) as any;
    const result = (lastLog.result ?? {}) as any;
    let rollbackResult: Record<string, unknown> = {};

    switch (rec.recommendation_type) {
      case "score_adjustment": {
        const { signal_type, signal_value } = payload;
        const previous = result.previous;
        if (previous == null) throw new Error("Previous score not found in log");
        const safe = Math.max(-MAX_SCORE_ABS, Math.min(MAX_SCORE_ABS, Number(previous)));
        const { data: current } = await admin
          .from("learning_signals")
          .select("id, impact_score")
          .eq("organization_id", rec.organization_id)
          .eq("signal_type", signal_type)
          .eq("signal_value", signal_value)
          .maybeSingle();
        if (!current) throw new Error("Signal not found");
        await admin
          .from("learning_signals")
          .update({ impact_score: safe, last_recalculated_at: new Date().toISOString() })
          .eq("id", current.id);
        rollbackResult = { restored_score: safe, was: current.impact_score };
        break;
      }
      case "template_change": {
        const { data: org } = await admin.from("organizations").select("settings").eq("id", rec.organization_id).maybeSingle();
        const settings = (org?.settings as any) ?? {};
        const deprecated: string[] = (settings.deprecated_templates ?? []).filter((id: string) => id !== payload.entity_id);
        await admin.from("organizations").update({ settings: { ...settings, deprecated_templates: deprecated } }).eq("id", rec.organization_id);
        rollbackResult = { deprecated_templates: deprecated };
        break;
      }
      case "channel_shift": {
        const { data: org } = await admin.from("organizations").select("settings").eq("id", rec.organization_id).maybeSingle();
        const settings = (org?.settings as any) ?? {};
        delete settings.preferred_channel;
        await admin.from("organizations").update({ settings }).eq("id", rec.organization_id);
        rollbackResult = { preferred_channel: null };
        break;
      }
      case "rule_change": {
        if (payload.rule_id && typeof payload.is_active === "boolean") {
          await admin.from("decision_rules").update({ is_active: !payload.is_active }).eq("id", payload.rule_id).eq("organization_id", rec.organization_id);
          rollbackResult = { rule_id: payload.rule_id, is_active: !payload.is_active };
        } else {
          throw new Error("Cannot rollback rule_change without rule_id");
        }
        break;
      }
      default:
        throw new Error(`Rollback not supported for type ${rec.recommendation_type}`);
    }

    // Log the rollback action
    await admin.from("optimization_actions_log").insert({
      organization_id: rec.organization_id,
      recommendation_id: rec.id,
      action_type: `${rec.recommendation_type}_rollback`,
      executed: true,
      result: rollbackResult,
      executed_by: userId,
    });

    // Mark rec as rolled_back
    await admin.rpc("mark_recommendation_rolled_back", {
      _rec_id: rec.id,
      _user_id: userId,
      _payload: rollbackResult as any,
    });

    return new Response(JSON.stringify({ ok: true, rollback: rollbackResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[rollback-recommendation] fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
