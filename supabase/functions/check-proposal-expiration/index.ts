import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ProposalRow {
  id: string;
  proposal_number: string | null;
  title: string | null;
  client_name: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  expires_at: string;
  opportunity_id: string;
  organization_id: string;
  total_amount: number | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Fetch proposals expiring within 48h that are still open (sent/viewed)
    // and whose parent opportunity is still active (open, not deleted, sales pipeline)
    // NOTE: PostgREST embed filters do NOT filter the parent row — we must filter in JS.
    const { data: proposalsRaw, error } = await supabase
      .from("proposals")
      .select(
        `id, proposal_number, title, client_name, accepted_at, declined_at, expires_at, opportunity_id, organization_id, total_amount,
         opportunity:opportunities!proposals_opportunity_id_fkey!inner(id, status, deleted_at, pipeline_id, pipelines:pipelines(pipeline_type))`
      )
      .not("expires_at", "is", null)
      .in("status", ["sent", "viewed"])
      .is("accepted_at", null)
      .is("declined_at", null)
      .is("deleted_at", null)
      .lte("expires_at", in48h.toISOString()) as { data: any[] | null; error: any };

    if (error) {
      console.error("Error fetching proposals:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hard filter in JS: only opportunities that are open, not deleted, and from a 'sales' pipeline
    const proposals = (proposalsRaw || []).filter((p: any) => {
      const opp = p.opportunity;
      if (!opp) return false;
      if (opp.deleted_at) return false;
      if (opp.status !== "open" && opp.status !== "new" && opp.status !== "in_progress") return false;
      const pipelineType = opp.pipelines?.pipeline_type;
      if (pipelineType !== "sales") return false;
      return true;
    }) as ProposalRow[];

    if (!proposals || proposals.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No expiring proposals found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processedCount = 0;

    for (const proposal of proposals) {
      if (proposal.accepted_at || proposal.declined_at) {
        console.log(
          `[check-proposal-expiration] skipped terminal proposal ${proposal.id}`,
          { accepted_at: proposal.accepted_at, declined_at: proposal.declined_at }
        );
        continue;
      }

      const expiresAt = new Date(proposal.expires_at);
      const hoursRemaining = Math.max(
        0,
        Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60))
      );
      const isExpired = expiresAt <= now;
      const expiresIn24h = !isExpired && expiresAt <= in24h;
      const expiresIn48h = !isExpired && !expiresIn24h && expiresAt <= in48h;
      const expiresToday = !isExpired && expiresAt <= todayEnd;

      // Determine priority and event subtype
      let priority: string;
      let eventSubtype: string;
      if (isExpired) {
        priority = "critical";
        eventSubtype = "proposal_expired";
      } else if (expiresIn24h || expiresToday) {
        priority = "high";
        eventSubtype = "proposal_expiring_24h";
      } else if (expiresIn48h) {
        priority = "medium";
        eventSubtype = "proposal_expiring_48h";
      } else {
        continue;
      }

      const proposalLabel =
        proposal.proposal_number || proposal.title || proposal.id.slice(0, 8);
      const companyName = proposal.client_name || "Cliente";

      // Check if we already sent this alert today for this proposal + subtype
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      // Dedup centralizado (1 alerta por proposta + faixa por dia)
      const dedupKey = `${eventSubtype}:${proposal.id}`;
      const { data: lockAcquired } = await supabase.rpc("try_acquire_dedup_lock", {
        p_organization_id: proposal.organization_id,
        p_dedup_key: dedupKey,
        p_event_type: eventSubtype,
        p_window_seconds: 86400,
      });

      if (!lockAcquired) {
        console.log(`[check-proposal-expiration] [dedup] skipped ${dedupKey}`);
        continue;
      }

      // Create notification_event
      const payload = {
        proposal_id: proposal.id,
        proposal_number: proposalLabel,
        company_name: companyName,
        opportunity_id: proposal.opportunity_id,
        expires_at: proposal.expires_at,
        hours_remaining: hoursRemaining,
      };

      const { data: evt, error: evtErr } = await supabase
        .from("notification_events")
        .insert({
          event_type: eventSubtype,
          entity_type: "proposal",
          entity_id: proposal.id,
          proposal_id: proposal.id,
          opportunity_id: proposal.opportunity_id,
          organization_id: proposal.organization_id,
          payload,
        })
        .select("id")
        .single();

      if (evtErr) {
        console.error(
          `[check-proposal-expiration] event insert error for ${proposal.id}:`,
          evtErr
        );
        continue;
      }

      // Resolve recipients: opportunity owner + manager
      const { data: opp } = await supabase
        .from("opportunities")
        .select("owner_user_id")
        .eq("id", proposal.opportunity_id)
        .single();

      if (!opp?.owner_user_id) {
        console.warn(
          `[check-proposal-expiration] No owner found for opportunity ${proposal.opportunity_id}`
        );
        continue;
      }

      const ownerId = opp.owner_user_id;

      // Get manager via team membership (teams.manager_id)
      const { data: teamRows } = await supabase
        .from("team_members")
        .select("teams!inner(manager_id)")
        .eq("user_id", ownerId)
        .eq("organization_id", proposal.organization_id);

      const managerId = (teamRows || [])
        .map((r: any) => r.teams?.manager_id)
        .find((m: string | null) => m && m !== ownerId) || null;

      const recipientIds = [ownerId, managerId].filter(Boolean) as string[];
      const uniqueRecipients = [...new Set(recipientIds)];

      // Build notification message
      let titleText: string;
      let messageText: string;

      if (isExpired) {
        titleText = "Proposta vencida";
        messageText = `A proposta ${proposalLabel} da ${companyName} venceu e ainda está aberta.`;
      } else {
        titleText = "Proposta vencendo";
        if (hoursRemaining <= 24) {
          messageText = `A proposta ${proposalLabel} da ${companyName} vence em ${hoursRemaining} horas.`;
        } else {
          messageText = `A proposta ${proposalLabel} da ${companyName} vence em ${Math.ceil(hoursRemaining / 24)} dias.`;
        }
      }

      const actionUrl = `/app/opportunities/${proposal.opportunity_id}`;

      for (const userId of uniqueRecipients) {
        // Check notification settings
        const { data: settings } = await supabase
          .from("notification_settings")
          .select(
            "proposal_expiring_alert_enabled, realtime_in_app_enabled, realtime_email_enabled"
          )
          .eq("user_id", userId)
          .maybeSingle();

        const alertEnabled = settings?.proposal_expiring_alert_enabled ?? true;
        if (!alertEnabled) continue;

        const channelInApp = settings?.realtime_in_app_enabled ?? true;
        const channelEmail = settings?.realtime_email_enabled ?? false;

        const { error: nErr } = await supabase.from("notifications_v2").insert({
          user_id: userId,
          event_id: evt.id,
          type: eventSubtype,
          title: titleText,
          message: messageText,
          priority,
          channel_in_app: channelInApp,
          channel_email: channelEmail,
          channel_push: false,
          status: "pending",
          action_url: actionUrl,
        });

        if (nErr) {
          console.error(
            `[check-proposal-expiration] notification insert error for ${userId}:`,
            nErr
          );
        } else {
          console.log(
            `[check-proposal-expiration] ${eventSubtype} notification for user ${userId} re: ${proposalLabel}`
          );
        }
      }

      processedCount++;
    }

    return new Response(
      JSON.stringify({
        processed: processedCount,
        total_checked: proposals.length,
        timestamp: now.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[check-proposal-expiration] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
