import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { proposalId, opportunityId } = await req.json();

    if (!proposalId) {
      return new Response(JSON.stringify({ error: "proposalId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Anti-duplication: check if deal_won notifications already exist for this proposal
    const { data: existingNotifications } = await supabase
      .from("notifications")
      .select("id")
      .in("type", ["deal_won", "team_deal_won", "new_contract", "new_onboarding"])
      .eq("metadata->>proposal_id", proposalId)
      .limit(1);

    if (existingNotifications && existingNotifications.length > 0) {
      console.log("Notifications already exist for proposal", proposalId, "— skipping to avoid duplicates");
      return new Response(JSON.stringify({ skipped: true, reason: "already_notified" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch proposal data
    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select("id, title, proposal_number, value, organization_id, total_amount, acceptor_name")
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal) {
      console.error("Proposal not found:", proposalError);
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch opportunity data
    let opportunity: any = null;
    if (opportunityId) {
      const { data: opp } = await supabase
        .from("opportunities")
        .select("id, title, owner_user_id, account_id, value")
        .eq("id", opportunityId)
        .single();
      opportunity = opp;
    }

    if (!opportunity) {
      const { data: propItems } = await supabase
        .from("proposal_items")
        .select("opportunity_id")
        .eq("proposal_id", proposalId)
        .not("opportunity_id", "is", null)
        .limit(1);

      if (propItems?.[0]?.opportunity_id) {
        const { data: opp } = await supabase
          .from("opportunities")
          .select("id, title, owner_user_id, account_id, value")
          .eq("id", propItems[0].opportunity_id)
          .single();
        opportunity = opp;
      }
    }

    // Get account name
    let accountName = "Cliente";
    if (opportunity?.account_id) {
      const { data: account, error: accountError } = await supabase
        .from("accounts")
        .select("razao_social, nome_fantasia")
        .eq("id", opportunity.account_id)
        .single();
      if (accountError) {
        console.error("Error fetching account:", accountError);
      }
      if (account) {
        accountName = account.nome_fantasia || account.razao_social || "Cliente";
      }
      console.log("Account resolved:", accountName, "from account_id:", opportunity.account_id);
    } else {
      // Try to get account from proposal's organization or other means
      console.log("No account_id found on opportunity, using fallback");
    }

    const acceptorName = proposal.acceptor_name || "Cliente";

    // Get seller name
    let sellerName = "Equipe";
    if (opportunity?.owner_user_id) {
      const { data: sellerProfile, error: sellerError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", opportunity.owner_user_id)
        .maybeSingle();
      if (sellerError) {
        console.error("Error fetching seller profile:", sellerError);
      }
      if (sellerProfile) {
        sellerName = sellerProfile.full_name || "Equipe";
      }
      console.log("Seller resolved:", sellerName, "from owner_user_id:", opportunity.owner_user_id);
    }

    // Get organization primary_color
    let primaryColor = "#020cbc";
    {
      const { data: org } = await supabase
        .from("organizations")
        .select("primary_color")
        .eq("id", proposal.organization_id)
        .single();
      if (org?.primary_color) {
        primaryColor = org.primary_color;
      }
    }

    // ========== BUILD NOTIFICATIONS FOR ALL ACTIVE ORG MEMBERS ==========
    const proposalValue = parseFloat(proposal.value || proposal.total_amount || "0");
    const totalValue = proposalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    const proposalTitle = proposal.title || proposal.proposal_number || "Proposta";
    const notificationMessage = `${sellerName} fechou negócio com ${accountName}! Proposta "${proposalTitle}" aceita por ${acceptorName}. Valor: R$ ${totalValue}`;

    const notificationMetadata = {
      proposal_id: proposalId,
      opportunity_id: opportunity?.id || null,
      acceptor_name: acceptorName,
      seller_name: sellerName,
      value: proposalValue,
      account_name: accountName,
      primary_color: primaryColor,
      show_celebration: true,
      effects_source: "post-acceptance-effects",
    };

    // Fetch ALL active members of the organization
    const { data: allMembers, error: membersError } = await supabase
      .from("organization_members")
      .select("user_id, org_role")
      .eq("organization_id", proposal.organization_id)
      .eq("status", "active");

    if (membersError) {
      console.error("Error fetching org members:", membersError);
    }

    const notifications: any[] = [];
    const notifiedUsers = new Set<string>();

    for (const member of allMembers || []) {
      if (notifiedUsers.has(member.user_id)) continue;
      notifiedUsers.add(member.user_id);

      const isSeller = member.user_id === opportunity?.owner_user_id;

      notifications.push({
        user_id: member.user_id,
        organization_id: proposal.organization_id,
        type: "deal_won",
        title: isSeller
          ? "🎉 Proposta Aceita! Você fechou negócio!"
          : `🎉 ${sellerName} fechou negócio!`,
        message: notificationMessage,
        metadata: {
          ...notificationMetadata,
          role: isSeller ? "seller" : member.org_role || "member",
        },
      });
    }

    // Insert all notifications in batch
    let notificationsCreated = 0;
    if (notifications.length > 0) {
      const { error: insertError } = await supabase.from("notifications").insert(notifications);
      if (insertError) {
        console.error("Error inserting notifications:", insertError);
      } else {
        notificationsCreated = notifications.length;
        console.log(`Created ${notificationsCreated} celebration notifications for ALL org members`);
      }
    }

    // ========== SLACK NOTIFICATION ==========
    let slackSent = false;
    try {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");

      if (LOVABLE_API_KEY && SLACK_API_KEY) {
        const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

        const formattedValue = proposalValue.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });

        const slackBlocks = [
          {
            type: "header",
            text: { type: "plain_text", text: "🎉 Nova contratação fechada!", emoji: true },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Cliente:*\n${accountName}` },
              { type: "mrkdwn", text: `*Proposta:*\n${proposal.proposal_number || ""} — ${proposalTitle}` },
              { type: "mrkdwn", text: `*Valor:*\n${formattedValue}` },
              { type: "mrkdwn", text: `*Vendedor:*\n${sellerName}` },
            ],
          },
          {
            type: "context",
            elements: [{ type: "mrkdwn", text: `Aprovado por ${acceptorName} 🚀` }],
          },
        ];

        const slackResponse = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": SLACK_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channel: "C05CKC6TBQB",
            text: `🎉 Nova contratação: ${accountName} — ${formattedValue} (vendedor: ${sellerName})`,
            blocks: slackBlocks,
            unfurl_links: false,
          }),
        });

        const slackResult = await slackResponse.json();
        if (slackResult.ok) {
          slackSent = true;
          console.log("Slack notification sent successfully to #geral");
        } else {
          console.error("Slack API error:", slackResult.error);
        }
      } else {
        console.log("Slack not configured, skipping");
      }
    } catch (slackError) {
      console.error("Error sending Slack:", slackError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_created: notificationsCreated,
        slack_sent: slackSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("post-acceptance-effects error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
