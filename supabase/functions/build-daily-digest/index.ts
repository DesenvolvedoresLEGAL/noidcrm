// Builds daily digest summaries for active sellers and triggers email delivery.
// Schema-aligned with daily_digest_runs (user_id, scheduled_for, started_at, finished_at, summary_payload, email_sent).
// Honors notification_settings (daily_digest_enabled, daily_digest_time, daily_digest_email_enabled).
// Cron is hourly (0 * * * *); we filter users whose local 06:00 BRT == current UTC hour.
//
// v2 (Briefing de Ataque do Dia):
//   - For closers, calls crm_get_closer_dashboard_data + crm_get_closer_pace_data to build
//     a rich `attack_plan` payload (scoreboard, top_priorities scored, critical activities, risks).
//   - Falls back to legacy counters if the RPC is unavailable or the user is not a closer.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BRT_OFFSET_HOURS = -3;

function localHourToUtcHour(localHHmm: string): number {
  const [hStr] = localHHmm.split(":");
  const local = parseInt(hStr, 10);
  return ((local - BRT_OFFSET_HOURS) % 24 + 24) % 24;
}

// --- Attack plan builder ---------------------------------------------------

type AnyObj = Record<string, any>;

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function buildScoreboard(pace: AnyObj | null): AnyObj | null {
  if (!pace || pace.available === false) return null;
  return {
    goal_value: safeNum(pace.goal_value),
    realized_value: safeNum(pace.realized_value),
    attainment_percent: safeNum(pace.goal_attainment_percent),
    remaining_to_goal: safeNum(pace.remaining_to_goal),
    expected_pace_today: safeNum(pace.expected_pace_today),
    pace_gap_value: safeNum(pace.pace_gap_value),
    required_daily_rate: safeNum(pace.required_daily_rate),
    business_days_remaining: safeNum(pace.business_days_remaining),
    business_days_elapsed: safeNum(pace.business_days_elapsed),
    status: pace.status ?? null,
    severity: pace.severity ?? null,
  };
}

function buildTopPriorities(dashboard: AnyObj | null): AnyObj[] {
  if (!dashboard || dashboard.error) return [];
  const actions: AnyObj[] = dashboard?.lists?.top_actions_today ?? [];
  // RPC já entrega priorizado/excluindo perdidos/ganhos/eventos passados.
  return actions.slice(0, 5).map((a, idx) => ({
    rank: idx + 1,
    priority_score: safeNum(a.priority),
    type: a.type ?? null,
    severity: a.severity ?? "info",
    title: a.title ?? null,
    customer: a.customer_name ?? null,
    value: safeNum(a.value),
    opportunity_id: a.opportunity_id ?? null,
    proposal_id: a.proposal_id ?? null,
    action_label: a.action_label ?? null,
    why_here: a.why_here ?? null,
    priority_reasons: a.why_here ? [a.why_here] : [],
  }));
}

function buildCriticalActivities(dashboard: AnyObj | null): AnyObj {
  const lists = dashboard?.lists ?? {};
  const central = dashboard?.central_do_dia ?? {};
  const overdue: AnyObj[] = lists.overdue_followups ?? [];
  const today: AnyObj[] = lists.today_agenda ?? [];
  // Top 5 críticas: prioriza atrasadas, completa com hoje.
  const top = [...overdue, ...today]
    .slice(0, 5)
    .map((a) => ({
      kind: a.kind ?? "activity",
      type: a.type ?? null,
      title: a.title ?? null,
      customer: a.customer_name ?? null,
      scheduled_date: a.scheduled_date ?? null,
      days_overdue: a.days_overdue ?? null,
      opportunity_id: a.opportunity_id ?? null,
      why_here: a.why_here ?? null,
    }));
  return {
    overdue_count: safeNum(central.overdue_followups_count),
    today_count: safeNum(central.today_activities_count),
    top,
  };
}

function buildRisks(dashboard: AnyObj | null): AnyObj {
  const lists = dashboard?.lists ?? {};
  const central = dashboard?.central_do_dia ?? {};
  const sumValue = (arr: AnyObj[] = []) =>
    arr.reduce((acc, it) => acc + safeNum(it.value), 0);
  const valueAtRisk =
    sumValue(lists.proposals_expiring_today) +
    sumValue(lists.proposals_expiring_48h) +
    sumValue(lists.proposals_expired) +
    sumValue(lists.risk_deals);
  return {
    proposals_expiring_today: safeNum(central.proposals_expiring_today),
    proposals_viewed_no_followup: safeNum(central.proposals_viewed_no_followup),
    opportunities_without_next_activity: safeNum(central.opportunities_without_next_activity),
    deals_event_lt_10_days: (lists.risk_deals ?? []).filter((d: AnyObj) => {
      // risk_deals already filtered; we just count those whose risk relates to event proximity
      return /evento/i.test(String(d.risk_reason ?? d.why_here ?? ""));
    }).length,
    value_at_risk: valueAtRisk,
  };
}

async function buildAttackPlan(
  supabase: any,
  orgId: string,
  userId: string,
): Promise<AnyObj | null> {
  try {
    const [dashRes, paceRes] = await Promise.all([
      supabase.rpc("crm_get_closer_dashboard_data", {
        p_tenant_id: orgId,
        p_user_id: userId,
        p_period: "current_month",
        p_start_date: null,
        p_end_date: null,
      }),
      supabase.rpc("crm_get_closer_pace_data", {
        p_tenant_id: orgId,
        p_user_id: userId,
      }),
    ]);
    if (dashRes.error) {
      console.warn(`attack_plan dashboard rpc failed for ${userId}:`, dashRes.error.message);
      return null;
    }
    const dashboard = dashRes.data as AnyObj | null;
    if (!dashboard || dashboard?.error === "not_a_closer") return null;
    const pace = (paceRes.data ?? dashboard?.pace) as AnyObj | null;
    return {
      scoreboard: buildScoreboard(pace),
      top_priorities: buildTopPriorities(dashboard),
      critical_activities: buildCriticalActivities(dashboard),
      risks: buildRisks(dashboard),
    };
  } catch (e) {
    console.warn(`attack_plan exception for ${userId}:`, e);
    return null;
  }
}

// --- Main handler ----------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalSecret = Deno.env.get("INTERNAL_WORKFLOW_SECRET") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const forceUserId = url.searchParams.get("force_user_id");
    const ignoreHour = url.searchParams.get("ignore_hour") === "1";

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const currentUtcHour = today.getUTCHours();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    let sellersQuery = supabase
      .from("sellers")
      .select("id, user_id, organization_id")
      .eq("active", true)
      .not("user_id", "is", null);
    if (forceUserId) sellersQuery = sellersQuery.eq("user_id", forceUserId);

    const { data: sellers, error: sellersError } = await sellersQuery;
    if (sellersError) {
      console.error("Sellers query error:", sellersError);
      return new Response(JSON.stringify({ error: sellersError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!sellers || sellers.length === 0) {
      return new Response(JSON.stringify({ message: "No active sellers found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = sellers.map((s: any) => s.user_id).filter(Boolean);

    const { data: profilesRows } = await supabase
      .from("profiles").select("id, user_id, full_name, email").in("user_id", userIds);
    const profilesMap = new Map<string, any>();
    for (const p of profilesRows ?? []) profilesMap.set(p.user_id, p);

    const { data: settingsRows } = await supabase
      .from("notification_settings")
      .select("user_id, daily_digest_enabled, daily_digest_time, daily_digest_email_enabled")
      .in("user_id", userIds);
    const settingsMap = new Map<string, any>();
    for (const s of settingsRows ?? []) settingsMap.set(s.user_id, s);

    const { data: cacheRows } = await supabase
      .from("daily_digest_cache").select("user_id")
      .in("user_id", userIds).eq("digest_date", todayStr);
    const cachedSet = new Set((cacheRows ?? []).map((c: any) => c.user_id));

    const results: any[] = [];
    let processedCount = 0;
    let emailSentCount = 0;
    let skippedDisabled = 0;
    let skippedHour = 0;
    let skippedAlreadyDone = 0;

    for (const seller of sellers as any[]) {
      const userId = seller.user_id;
      const orgId = seller.organization_id;
      if (!userId || !orgId) continue;

      const settings = settingsMap.get(userId);
      const enabled = settings?.daily_digest_enabled ?? true;
      const localTime = settings?.daily_digest_time ?? "06:00";
      const emailEnabled = settings?.daily_digest_email_enabled ?? true;

      if (!enabled) { skippedDisabled++; continue; }
      if (!ignoreHour && !forceUserId) {
        const targetUtcHour = localHourToUtcHour(localTime);
        if (currentUtcHour !== targetUtcHour) { skippedHour++; continue; }
      }
      if (cachedSet.has(userId)) { skippedAlreadyDone++; continue; }

      const profile = profilesMap.get(userId);
      const userName = profile?.full_name || "Vendedor";
      const userEmail = profile?.email;

      const { data: runRow } = await supabase
        .from("daily_digest_runs")
        .insert({
          user_id: userId, run_date: todayStr,
          scheduled_for: today.toISOString(),
          started_at: today.toISOString(),
          status: "running",
        }).select("id").single();
      const runId = runRow?.id;

      if (emailEnabled && !userEmail) {
        if (runId) {
          await supabase.from("daily_digest_runs").update({
            status: "skipped", finished_at: new Date().toISOString(),
            summary_payload: { reason: "no_profile_email", user_id: userId },
            email_sent: false,
          }).eq("id", runId);
        }
        results.push({ userId, userName, skipped: true, reason: "no_profile_email" });
        continue;
      }

      try {
        // Legacy aggregations (kept for backward compatibility / in-app digest)
        const [overdue, todayAct, views, expToday, expTomorrow, replies, staleOpps] = await Promise.all([
          supabase.from("activities").select("id", { count: "exact", head: true })
            .eq("organization_id", orgId).eq("owner_user_id", userId).eq("status", "pending")
            .is("deleted_at", null).lt("scheduled_date", todayStr),
          supabase.from("activities").select("id", { count: "exact", head: true })
            .eq("organization_id", orgId).eq("owner_user_id", userId).eq("status", "pending")
            .is("deleted_at", null).gte("scheduled_date", todayStr).lt("scheduled_date", todayStr + "T23:59:59.999Z"),
          supabase.from("proposal_views").select("id", { count: "exact", head: true })
            .eq("organization_id", orgId).gte("viewed_at", yesterday),
          supabase.from("proposals").select("id", { count: "exact", head: true })
            .eq("organization_id", orgId).in("status", ["draft", "sent", "viewed"])
            .gte("expires_at", todayStr).lt("expires_at", todayStr + "T23:59:59.999Z"),
          supabase.from("proposals").select("id", { count: "exact", head: true })
            .eq("organization_id", orgId).in("status", ["draft", "sent", "viewed"])
            .gte("expires_at", tomorrowStr).lt("expires_at", tomorrowStr + "T23:59:59.999Z"),
          supabase.from("notification_events").select("id", { count: "exact", head: true })
            .eq("organization_id", orgId).eq("event_type", "client_replied").gte("created_at", yesterday),
          supabase.from("opportunities").select("id, title")
            .eq("organization_id", orgId).eq("owner_user_id", userId).eq("status", "open")
            .is("deleted_at", null).lt("updated_at", new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()).limit(20),
        ]);

        // Rich attack plan via closer dashboard RPC
        const attackPlan = await buildAttackPlan(supabase, orgId, userId);

        const summary: AnyObj = {
          date: todayStr,
          user_name: userName,
          // legacy counters (in-app + fallback email)
          overdue_activities: overdue.count || 0,
          today_activities: todayAct.count || 0,
          proposal_views_last_24h: views.count || 0,
          proposals_expiring_today: expToday.count || 0,
          proposals_expiring_tomorrow: expTomorrow.count || 0,
          client_replies_last_24h: replies.count || 0,
          stale_opportunities: staleOpps.data?.length || 0,
          top_items: [], // legacy field, no longer populated (attack_plan.top_priorities replaces it)
          // new attack-plan payload (may be null for non-closers)
          attack_plan: attackPlan,
        };

        await supabase.from("daily_digest_cache").insert({
          user_id: userId, digest_date: todayStr, summary_json: summary,
        });

        await supabase.from("notifications_v2").insert({
          user_id: userId, organization_id: orgId,
          type: "daily_digest",
          title: "🎯 Seu plano de ataque do dia está pronto",
          message: attackPlan
            ? `Top ${attackPlan.top_priorities?.length ?? 0} prioridades · ${summary.overdue_activities} atividades atrasadas`
            : `${summary.overdue_activities} atrasadas, ${summary.proposals_expiring_today} propostas vencendo hoje`,
          action_url: "/app/dashboard", priority: "medium", metadata: summary,
        });

        let emailSent = false;
        let emailErrorPayload: any = null;
        let emailMethodUsed: string | null = null;
        if (emailEnabled && userEmail) {
          try {
            const r = await fetch(`${supabaseUrl}/functions/v1/send-daily-digest-email`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-internal-secret": internalSecret },
              body: JSON.stringify({ user_id: userId, email: userEmail, user_name: userName, summary }),
            });
            const er = await r.json();
            emailSent = r.ok && er.success === true && er.method !== "skipped_user_pref";
            emailMethodUsed = er.method ?? null;
            if (emailSent) emailSentCount++;
            else emailErrorPayload = {
              error: er.error ?? "unknown_failure", method: er.method,
              status: r.status, error_at: new Date().toISOString(),
            };
            results.push({ userId, userName, email: userEmail, email_method: er.method, ok: r.ok, error: er.error });
          } catch (emailErr) {
            console.error(`Email send failed for ${userId}:`, emailErr);
            emailErrorPayload = { error: String(emailErr), error_at: new Date().toISOString(), channel: "fetch_exception" };
            results.push({ userId, userName, email: userEmail, error: String(emailErr) });
          }
        }

        if (runId) {
          await supabase.from("daily_digest_runs").update({
            status: emailErrorPayload ? "failed" : "completed",
            finished_at: new Date().toISOString(),
            summary_payload: emailErrorPayload
              ? { ...summary, email_error: emailErrorPayload, email_method_attempted: emailMethodUsed }
              : { ...summary, email_method: emailMethodUsed },
            email_sent: emailSent, dashboard_cached: true,
          }).eq("id", runId);
        }
        processedCount++;
      } catch (userErr) {
        console.error(`Failed processing user ${userId}:`, userErr);
        if (runId) {
          await supabase.from("daily_digest_runs").update({
            status: "failed", finished_at: new Date().toISOString(),
            summary_payload: { error: String(userErr) },
          }).eq("id", runId);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true, processed: processedCount, email_sent: emailSentCount,
      skipped_disabled: skippedDisabled, skipped_hour: skippedHour,
      skipped_already_done: skippedAlreadyDone, total_sellers: sellers.length,
      current_utc_hour: currentUtcHour, results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Build daily digest error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
