import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrowEnd = new Date(now);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setHours(23, 59, 59, 999);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    // Get all active sellers with digest enabled
    const { data: sellers } = await supabase
      .from("sellers")
      .select("user_id, organization_id")
      .eq("active", true);

    if (!sellers || sellers.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get notification settings for digest-enabled users
    const userIds = sellers.map((s: any) => s.user_id).filter(Boolean);
    const { data: allSettings } = await supabase
      .from("notification_settings")
      .select("user_id, daily_digest_enabled, daily_digest_email_enabled, daily_digest_dashboard_enabled")
      .in("user_id", userIds);

    const settingsMap = new Map((allSettings || []).map((s: any) => [s.user_id, s]));

    // Get profiles for names
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    let processedCount = 0;

    for (const seller of sellers) {
      const userId = seller.user_id;
      if (!userId) continue;

      const settings = settingsMap.get(userId);
      const digestEnabled = settings?.daily_digest_enabled ?? true;
      if (!digestEnabled) continue;

      const orgId = seller.organization_id;
      const profile = profileMap.get(userId);
      const firstName = profile?.full_name?.split(" ")[0] || "Usuário";

      try {
        // Check if already generated today
        const { data: existing } = await supabase
          .from("daily_digest_cache")
          .select("id")
          .eq("user_id", userId)
          .eq("digest_date", todayStr)
          .limit(1);

        if (existing && existing.length > 0) continue;

        // 1. Overdue activities
        const { count: overdueActivities } = await supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("owner_user_id", userId)
          .eq("status", "pending")
          .lt("scheduled_date", todayStr)
          .is("deleted_at", null);

        // 2. Today's activities
        const { count: todayActivities } = await supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("owner_user_id", userId)
          .eq("status", "pending")
          .gte("scheduled_date", todayStart.toISOString())
          .lte("scheduled_date", todayEnd.toISOString())
          .is("deleted_at", null);

        // 3. Get user's opportunity IDs for proposal queries
        const { data: userOpps } = await supabase
          .from("opportunities")
          .select("id")
          .eq("owner_user_id", userId);

        const oppIds = (userOpps || []).map((o: any) => o.id);
        const safeOppIds = oppIds.length > 0 ? oppIds : ["none"];

        // 4. Proposals viewed in last 24h
        const { count: proposalViews } = await supabase
          .from("proposals")
          .select("id", { count: "exact", head: true })
          .in("opportunity_id", safeOppIds)
          .gte("last_viewed_at", yesterday.toISOString())
          .is("deleted_at", null);

        // 5. Proposals expiring today
        const { count: expiringToday } = await supabase
          .from("proposals")
          .select("id", { count: "exact", head: true })
          .in("opportunity_id", safeOppIds)
          .in("status", ["sent", "viewed"])
          .gte("expires_at", todayStart.toISOString())
          .lte("expires_at", todayEnd.toISOString())
          .is("deleted_at", null);

        // 6. Proposals expiring tomorrow
        const { count: expiringTomorrow } = await supabase
          .from("proposals")
          .select("id", { count: "exact", head: true })
          .in("opportunity_id", safeOppIds)
          .in("status", ["sent", "viewed"])
          .gte("expires_at", tomorrowStart.toISOString())
          .lte("expires_at", tomorrowEnd.toISOString())
          .is("deleted_at", null);

        // 7. Client replies in last 24h
        const { count: clientReplies } = await supabase
          .from("notification_events")
          .select("id", { count: "exact", head: true })
          .eq("event_type", "client_replied")
          .in("opportunity_id", safeOppIds)
          .gte("created_at", yesterday.toISOString());

        // 8. Stale opportunities (no update in 7+ days)
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const { count: staleOpportunities } = await supabase
          .from("opportunities")
          .select("id", { count: "exact", head: true })
          .eq("owner_user_id", userId)
          .eq("status", "open")
          .lt("updated_at", sevenDaysAgo.toISOString())
          .is("deleted_at", null);

        // Build top_items (most urgent items)
        const topItems: any[] = [];

        // Top expiring proposals
        if (oppIds.length > 0) {
          const { data: urgentProposals } = await supabase
            .from("proposals")
            .select("id, proposal_number, title, client_name, expires_at, opportunity_id")
            .in("opportunity_id", safeOppIds)
            .in("status", ["sent", "viewed"])
            .gte("expires_at", todayStart.toISOString())
            .lte("expires_at", tomorrowEnd.toISOString())
            .is("deleted_at", null)
            .order("expires_at", { ascending: true })
            .limit(3);

          for (const p of urgentProposals || []) {
            topItems.push({
              type: "proposal_expiring",
              label: p.client_name || p.proposal_number || p.title || "Proposta",
              action_url: `/app/opportunities/${p.opportunity_id}`,
            });
          }
        }

        // Top overdue activities
        const { data: urgentActivities } = await supabase
          .from("activities")
          .select("id, title, scheduled_date, opportunity_id, account_id")
          .eq("owner_user_id", userId)
          .eq("status", "pending")
          .lt("scheduled_date", todayStr)
          .is("deleted_at", null)
          .order("scheduled_date", { ascending: true })
          .limit(3);

        for (const a of urgentActivities || []) {
          const url = a.opportunity_id
            ? `/app/opportunities/${a.opportunity_id}`
            : a.account_id
            ? `/app/accounts/${a.account_id}`
            : "/app/activities";
          topItems.push({
            type: "overdue_activity",
            label: a.title,
            action_url: url,
          });
        }

        const summaryJson = {
          date: todayStr,
          overdue_activities: overdueActivities || 0,
          today_activities: todayActivities || 0,
          proposal_views_last_24h: proposalViews || 0,
          proposals_expiring_today: expiringToday || 0,
          proposals_expiring_tomorrow: expiringTomorrow || 0,
          client_replies_last_24h: clientReplies || 0,
          stale_opportunities: staleOpportunities || 0,
          top_items: topItems.slice(0, 5),
        };

        // Store in cache
        await supabase.from("daily_digest_cache").insert({
          user_id: userId,
          digest_date: todayStr,
          summary_json: summaryJson,
          generated_at: now.toISOString(),
        });

        // Store run
        await supabase.from("daily_digest_runs").insert({
          run_date: todayStr,
          user_id: userId,
          scheduled_for: now.toISOString(),
          started_at: now.toISOString(),
          finished_at: new Date().toISOString(),
          status: "completed",
          summary_payload: summaryJson,
          email_sent: false,
          dashboard_cached: true,
        });

        // Create notification (in-app)
        const dashboardEnabled = settings?.daily_digest_dashboard_enabled ?? true;
        if (dashboardEnabled) {
          const totalPriorities =
            (overdueActivities || 0) +
            (expiringToday || 0) +
            (clientReplies || 0);

          const { data: evt } = await supabase
            .from("notification_events")
            .insert({
              event_type: "daily_digest",
              entity_type: "digest",
              entity_id: userId,
              organization_id: orgId,
              payload: summaryJson,
            })
            .select("id")
            .single();

          if (evt) {
            await supabase.from("notifications_v2").insert({
              user_id: userId,
              event_id: evt.id,
              type: "daily_digest",
              title: "Seu resumo diário do NOID",
              message: `Bom dia, ${firstName}! Você tem ${totalPriorities} prioridade(s) hoje.`,
              priority: totalPriorities > 5 ? "high" : "medium",
              channel_in_app: true,
              channel_email: false,
              channel_push: false,
              status: "pending",
              action_url: "/app/dashboard",
            });
          }
        }

        // Send email if enabled
        const emailEnabled = settings?.daily_digest_email_enabled ?? false;
        if (emailEnabled && profile?.email) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/send-daily-digest-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                user_id: userId,
                email: profile.email,
                first_name: firstName,
                summary: summaryJson,
              }),
            });
          } catch (emailErr) {
            console.error(`[build-daily-digest] Email send failed for ${userId}:`, emailErr);
          }
        }

        processedCount++;
      } catch (userErr) {
        console.error(`[build-daily-digest] Error for user ${userId}:`, userErr);
      }
    }

    return new Response(
      JSON.stringify({ processed: processedCount, total_users: sellers.length, date: todayStr }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[build-daily-digest] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
