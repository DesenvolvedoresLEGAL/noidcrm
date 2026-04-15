import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const {
      opportunity_id,
      account_id,
      channel, // 'email' | 'whatsapp' | 'chat' | 'omnichannel'
      company_name,
      contact_name,
      message_preview,
      channel_user_id, // optional: user responsible for the channel
    } = body;

    if (!opportunity_id || !channel) {
      return new Response(
        JSON.stringify({ error: "opportunity_id and channel are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get opportunity details
    const { data: opp, error: oppErr } = await supabase
      .from("opportunities")
      .select("id, title, owner_user_id, organization_id, account_id")
      .eq("id", opportunity_id)
      .single();

    if (oppErr || !opp) {
      console.error("[notify-client-reply] Opportunity not found:", oppErr);
      return new Response(
        JSON.stringify({ error: "Opportunity not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resolvedAccountId = account_id || opp.account_id;
    let resolvedCompanyName = company_name;

    // Resolve company name if not provided
    if (!resolvedCompanyName && resolvedAccountId) {
      const { data: account } = await supabase
        .from("accounts")
        .select("nome_fantasia, razao_social")
        .eq("id", resolvedAccountId)
        .single();
      resolvedCompanyName = account?.nome_fantasia || account?.razao_social || "Cliente";
    }
    resolvedCompanyName = resolvedCompanyName || "Cliente";

    const oppTitle = opp.title || "oportunidade";

    // Dedup: check if we already notified for this opp + channel in last 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentEvents } = await supabase
      .from("notification_events")
      .select("id")
      .eq("event_type", "client_replied")
      .eq("entity_id", opportunity_id)
      .gte("created_at", fiveMinAgo)
      .limit(1);

    if (recentEvents && recentEvents.length > 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "duplicate within 5 min window" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create notification_event
    const payload = {
      opportunity_id,
      opportunity_title: oppTitle,
      account_id: resolvedAccountId,
      company_name: resolvedCompanyName,
      contact_name: contact_name || null,
      channel,
      message_preview: message_preview?.slice(0, 200) || null,
      replied_at: new Date().toISOString(),
    };

    const { data: evt, error: evtErr } = await supabase
      .from("notification_events")
      .insert({
        event_type: "client_replied",
        entity_type: "opportunity",
        entity_id: opportunity_id,
        opportunity_id,
        company_id: resolvedAccountId || null,
        organization_id: opp.organization_id,
        payload,
      })
      .select("id")
      .single();

    if (evtErr) {
      console.error("[notify-client-reply] event insert error:", evtErr);
      return new Response(
        JSON.stringify({ error: "Failed to create event" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve recipients: owner + manager + channel_user
    const recipientIds: string[] = [];
    if (opp.owner_user_id) recipientIds.push(opp.owner_user_id);

    // Get manager
    const { data: seller } = await supabase
      .from("sellers")
      .select("manager_id")
      .eq("user_id", opp.owner_user_id)
      .eq("organization_id", opp.organization_id)
      .maybeSingle();

    if (seller?.manager_id) recipientIds.push(seller.manager_id);

    // Channel responsible user
    if (channel_user_id) recipientIds.push(channel_user_id);

    const uniqueRecipients = [...new Set(recipientIds)];

    const channelLabels: Record<string, string> = {
      email: "por e-mail",
      whatsapp: "via WhatsApp",
      chat: "no chat da proposta",
      omnichannel: "",
    };
    const channelLabel = channelLabels[channel] || "";

    const titleText = "Cliente respondeu";
    const messageText = `${resolvedCompanyName} respondeu ${channelLabel} na oportunidade ${oppTitle}.`.replace(/  +/g, " ");
    const actionUrl = `/app/opportunities/${opportunity_id}`;

    let notifiedCount = 0;

    for (const userId of uniqueRecipients) {
      const { data: settings } = await supabase
        .from("notification_settings")
        .select("client_reply_alert_enabled, realtime_in_app_enabled, realtime_email_enabled")
        .eq("user_id", userId)
        .maybeSingle();

      const alertEnabled = settings?.client_reply_alert_enabled ?? true;
      if (!alertEnabled) continue;

      const channelInApp = settings?.realtime_in_app_enabled ?? true;
      const channelEmail = settings?.realtime_email_enabled ?? false;

      const { error: nErr } = await supabase.from("notifications_v2").insert({
        user_id: userId,
        event_id: evt.id,
        type: "client_replied",
        title: titleText,
        message: messageText,
        priority: "critical",
        channel_in_app: channelInApp,
        channel_email: channelEmail,
        channel_push: false,
        status: "pending",
        action_url: actionUrl,
      });

      if (nErr) {
        console.error(`[notify-client-reply] notification error for ${userId}:`, nErr);
      } else {
        notifiedCount++;
        console.log(`[notify-client-reply] notified ${userId} for ${opportunity_id}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_id: evt.id,
        notified: notifiedCount,
        recipients: uniqueRecipients.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[notify-client-reply] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
