import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const now = today.toISOString();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const tomorrowEnd = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // Get active sellers with their org
    const { data: sellers } = await supabase
      .from("sellers")
      .select("id, user_id, organization_id, profiles!sellers_user_id_fkey(full_name, email)")
      .eq("active", true)
      .not("user_id", "is", null);

    if (!sellers || sellers.length === 0) {
      return new Response(JSON.stringify({ message: "No active sellers found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create digest run
    const { data: run } = await supabase
      .from("daily_digest_runs")
      .insert({ run_date: todayStr, status: "running", total_users: sellers.length })
      .select("id")
      .single();

    const runId = run?.id;
    let processedCount = 0;
    const results: any[] = [];

    for (const seller of sellers) {
      const userId = seller.user_id;
      const orgId = seller.organization_id;
      if (!userId || !orgId) continue;

      // Check if already processed today
      const { data: existing } = await supabase
        .from("daily_digest_cache")
        .select("id")
        .eq("user_id", userId)
        .eq("digest_date", todayStr)
        .maybeSingle();

      if (existing) continue;

      const profile = (seller as any).profiles;
      const userName = profile?.full_name || "Vendedor";

      // 1. Overdue activities
      const { count: overdueCount } = await supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("owner_user_id", userId)
        .eq("status", "pending")
        .is("deleted_at", null)
        .lt("scheduled_date", todayStr);

      // 2. Today's activities
      const { count: todayCount } = await supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("owner_user_id", userId)
        .eq("status", "pending")
        .is("deleted_at", null)
        .gte("scheduled_date", todayStr)
        .lt("scheduled_date", todayStr + "T23:59:59.999Z");

      // 3. Proposal views last 24h
      const { count: viewsCount } = await supabase
        .from("proposal_views")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .gte("viewed_at", yesterday);

      // 4. Proposals expiring today
      const { count: expiringToday } = await supabase
        .from("proposals")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", ["draft", "sent", "viewed"])
        .gte("expires_at", todayStr)
        .lt("expires_at", todayStr + "T23:59:59.999Z");

      // 5. Proposals expiring tomorrow
      const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const { count: expiringTomorrow } = await supabase
        .from("proposals")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", ["draft", "sent", "viewed"])
        .gte("expires_at", tomorrowStr)
        .lt("expires_at", tomorrowStr + "T23:59:59.999Z");

      // 6. Client replies last 24h
      const { count: repliesCount } = await supabase
        .from("notification_events")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("event_type", "client_replied")
        .gte("created_at", yesterday);

      // 7. Stale opportunities (no activity in 7+ days)
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: staleOpps } = await supabase
        .from("opportunities")
        .select("id, title")
        .eq("organization_id", orgId)
        .eq("owner_user_id", userId)
        .eq("status", "open")
        .is("deleted_at", null)
        .lt("updated_at", sevenDaysAgo)
        .limit(20);

      const staleCount = staleOpps?.length || 0;

      // Build top items
      const topItems: any[] = [];

      // Add expiring proposals as top items
      if ((expiringToday || 0) > 0) {
        const { data: expiringProps } = await supabase
          .from("proposals")
          .select("id, proposal_number, opportunities(id, title, accounts(razao_social))")
          .eq("organization_id", orgId)
          .in("status", ["draft", "sent", "viewed"])
          .gte("expires_at", todayStr)
          .lt("expires_at", todayStr + "T23:59:59.999Z")
          .limit(3);

        for (const p of expiringProps || []) {
          const opp = (p as any).opportunities;
          const company = opp?.accounts?.razao_social || opp?.title || "Oportunidade";
          topItems.push({
            type: "proposal_expiring",
            label: company,
            action_url: opp?.id ? `/crm/opportunities/${opp.id}` : "/crm/proposals",
          });
        }
      }

      // Add stale opps as top items
      for (const opp of (staleOpps || []).slice(0, 2)) {
        topItems.push({
          type: "stale_opportunity",
          label: opp.title,
          action_url: `/crm/opportunities/${opp.id}`,
        });
      }

      const summaryJson = {
        date: todayStr,
        user_name: userName,
        overdue_activities: overdueCount || 0,
        today_activities: todayCount || 0,
        proposal_views_last_24h: viewsCount || 0,
        proposals_expiring_today: expiringToday || 0,
        proposals_expiring_tomorrow: expiringTomorrow || 0,
        client_replies_last_24h: repliesCount || 0,
        stale_opportunities: staleCount,
        top_items: topItems,
      };

      // Save to cache
      await supabase.from("daily_digest_cache").insert({
        user_id: userId,
        organization_id: orgId,
        digest_date: todayStr,
        summary_json: summaryJson,
      });

      // Create in-app notification
      await supabase.from("notification_events").insert({
        organization_id: orgId,
        event_type: "daily_digest",
        entity_type: "digest",
        entity_id: runId || userId,
        title: "Resumo diário disponível",
        description: `Você tem ${overdueCount || 0} atividades atrasadas e ${expiringToday || 0} propostas vencendo hoje.`,
        priority: "medium",
        metadata: summaryJson,
      });

      // Distribute notification to user
      await supabase.from("notifications_v2").insert({
        user_id: userId,
        organization_id: orgId,
        type: "daily_digest",
        title: "📊 Seu resumo diário está pronto",
        message: `${overdueCount || 0} atrasadas, ${expiringToday || 0} propostas vencendo hoje`,
        action_url: "/app/dashboard",
        priority: "medium",
        metadata: summaryJson,
      });

      processedCount++;
      results.push({ userId, userName, summary: summaryJson });

      // Trigger email sending
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-daily-digest-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            user_id: userId,
            email: profile?.email,
            user_name: userName,
            summary: summaryJson,
          }),
        });
      } catch (emailErr) {
        console.error(`Failed to send digest email to ${userId}:`, emailErr);
      }
    }

    // Update run status
    if (runId) {
      await supabase
        .from("daily_digest_runs")
        .update({
          status: "completed",
          processed_users: processedCount,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        total_sellers: sellers.length,
        run_id: runId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Build daily digest error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
