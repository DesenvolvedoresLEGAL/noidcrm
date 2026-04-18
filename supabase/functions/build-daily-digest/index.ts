// Builds daily digest summaries for active sellers and triggers email delivery.
// Schema-aligned with daily_digest_runs (user_id, scheduled_for, started_at, finished_at, summary_payload, email_sent).
// Honors notification_settings (daily_digest_enabled, daily_digest_time, daily_digest_email_enabled).
// Cron is hourly (0 * * * *); we filter users whose local 06:00 BRT == current UTC hour.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brazil is UTC-3 (no DST since 2019). We assume daily_digest_time is BRT.
const BRT_OFFSET_HOURS = -3;

function localHourToUtcHour(localHHmm: string): number {
  const [hStr] = localHHmm.split(":");
  const local = parseInt(hStr, 10);
  // local = utc + offset → utc = local - offset = local + 3
  return ((local - BRT_OFFSET_HOURS) % 24 + 24) % 24;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalSecret = Deno.env.get("INTERNAL_WORKFLOW_SECRET") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const forceUserId = url.searchParams.get("force_user_id"); // for manual testing
    const ignoreHour = url.searchParams.get("ignore_hour") === "1";

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const currentUtcHour = today.getUTCHours();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Active sellers + profile
    let sellersQuery = supabase
      .from("sellers")
      .select("id, user_id, organization_id, profiles!sellers_user_id_fkey(full_name, email)")
      .eq("active", true)
      .not("user_id", "is", null);

    if (forceUserId) sellersQuery = sellersQuery.eq("user_id", forceUserId);

    const { data: sellers } = await sellersQuery;

    if (!sellers || sellers.length === 0) {
      return new Response(JSON.stringify({ message: "No active sellers found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = sellers.map((s: any) => s.user_id).filter(Boolean);

    // Bulk-fetch settings
    const { data: settingsRows } = await supabase
      .from("notification_settings")
      .select("user_id, daily_digest_enabled, daily_digest_time, daily_digest_email_enabled")
      .in("user_id", userIds);

    const settingsMap = new Map<string, any>();
    for (const s of settingsRows ?? []) settingsMap.set(s.user_id, s);

    // Bulk-fetch existing cache for today (idempotency)
    const { data: cacheRows } = await supabase
      .from("daily_digest_cache")
      .select("user_id")
      .in("user_id", userIds)
      .eq("digest_date", todayStr);

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

      if (!enabled) {
        skippedDisabled++;
        continue;
      }

      // Hour filter (skip when running hourly cron unless this is their hour)
      if (!ignoreHour && !forceUserId) {
        const targetUtcHour = localHourToUtcHour(localTime);
        if (currentUtcHour !== targetUtcHour) {
          skippedHour++;
          continue;
        }
      }

      // Idempotency
      if (cachedSet.has(userId)) {
        skippedAlreadyDone++;
        continue;
      }

      const profile = seller.profiles;
      const userName = profile?.full_name || "Vendedor";
      const userEmail = profile?.email;

      // Per-user run row
      const { data: runRow } = await supabase
        .from("daily_digest_runs")
        .insert({
          user_id: userId,
          run_date: todayStr,
          scheduled_for: today.toISOString(),
          started_at: today.toISOString(),
          status: "running",
        })
        .select("id")
        .single();

      const runId = runRow?.id;

      try {
        // Aggregations
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

        const topItems: any[] = [];
        if ((expToday.count || 0) > 0) {
          const { data: expProps } = await supabase
            .from("proposals")
            .select("id, proposal_number, opportunities(id, title, accounts(razao_social))")
            .eq("organization_id", orgId).in("status", ["draft", "sent", "viewed"])
            .gte("expires_at", todayStr).lt("expires_at", todayStr + "T23:59:59.999Z").limit(3);
          for (const p of expProps || []) {
            const opp = (p as any).opportunities;
            const company = opp?.accounts?.razao_social || opp?.title || "Oportunidade";
            topItems.push({ type: "proposal_expiring", label: company, action_url: opp?.id ? `/crm/opportunities/${opp.id}` : "/crm/proposals" });
          }
        }
        for (const opp of (staleOpps.data || []).slice(0, 2)) {
          topItems.push({ type: "stale_opportunity", label: opp.title, action_url: `/crm/opportunities/${opp.id}` });
        }

        const summary = {
          date: todayStr,
          user_name: userName,
          overdue_activities: overdue.count || 0,
          today_activities: todayAct.count || 0,
          proposal_views_last_24h: views.count || 0,
          proposals_expiring_today: expToday.count || 0,
          proposals_expiring_tomorrow: expTomorrow.count || 0,
          client_replies_last_24h: replies.count || 0,
          stale_opportunities: staleOpps.data?.length || 0,
          top_items: topItems,
        };

        // Cache
        await supabase.from("daily_digest_cache").insert({
          user_id: userId, digest_date: todayStr, summary_json: summary,
        });

        // In-app
        await supabase.from("notifications_v2").insert({
          user_id: userId, organization_id: orgId,
          type: "daily_digest",
          title: "📊 Seu resumo diário está pronto",
          message: `${summary.overdue_activities} atrasadas, ${summary.proposals_expiring_today} propostas vencendo hoje`,
          action_url: "/app/dashboard", priority: "medium", metadata: summary,
        });

        // Email
        let emailSent = false;
        if (emailEnabled && userEmail) {
          try {
            const r = await fetch(`${supabaseUrl}/functions/v1/send-daily-digest-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-internal-secret": internalSecret,
              },
              body: JSON.stringify({ user_id: userId, email: userEmail, user_name: userName, summary }),
            });
            const er = await r.json();
            emailSent = r.ok && er.success === true && er.method !== "skipped_user_pref";
            if (emailSent) emailSentCount++;
            results.push({ userId, userName, email: userEmail, email_method: er.method, ok: r.ok });
          } catch (emailErr) {
            console.error(`Email send failed for ${userId}:`, emailErr);
            results.push({ userId, userName, email: userEmail, error: String(emailErr) });
          }
        }

        // Mark run completed
        if (runId) {
          await supabase.from("daily_digest_runs").update({
            status: "completed",
            finished_at: new Date().toISOString(),
            summary_payload: summary,
            email_sent: emailSent,
            dashboard_cached: true,
          }).eq("id", runId);
        }
        processedCount++;
      } catch (userErr) {
        console.error(`Failed processing user ${userId}:`, userErr);
        if (runId) {
          await supabase.from("daily_digest_runs").update({
            status: "failed",
            finished_at: new Date().toISOString(),
            summary_payload: { error: String(userErr) },
          }).eq("id", runId);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      email_sent: emailSentCount,
      skipped_disabled: skippedDisabled,
      skipped_hour: skippedHour,
      skipped_already_done: skippedAlreadyDone,
      total_sellers: sellers.length,
      current_utc_hour: currentUtcHour,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Build daily digest error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
