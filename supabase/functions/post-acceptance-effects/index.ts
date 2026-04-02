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

    // Fetch minimal proposal data
    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select("id, title, proposal_number, value, organization_id, total_amount")
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
    const resolvedOpportunityId = opportunityId;

    if (resolvedOpportunityId) {
      const { data: opp } = await supabase
        .from("opportunities")
        .select("id, title, owner_user_id, account_id, value")
        .eq("id", resolvedOpportunityId)
        .single();
      opportunity = opp;
    }

    if (!opportunity) {
      // Try to find via proposal_items or proposals link
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
      const { data: account } = await supabase
        .from("accounts")
        .select("razao_social, nome_fantasia")
        .eq("id", opportunity.account_id)
        .single();
      if (account) accountName = account.nome_fantasia || account.razao_social;
    }

    // Get acceptor name from proposal
    const { data: proposalFull } = await supabase
      .from("proposals")
      .select("acceptor_name")
      .eq("id", proposalId)
      .single();
    const acceptorName = proposalFull?.acceptor_name || "Cliente";

    // ========== FETCH CELEBRATION RECIPIENTS CONFIG ==========
    let celebrationRecipients = ["seller", "manager", "admin", "finance", "cs", "operations"];
    try {
      const { data: orgSettings } = await supabase
        .from("organization_settings")
        .select("settings")
        .eq("organization_id", proposal.organization_id)
        .maybeSingle();

      if (orgSettings?.settings?.celebration_recipients) {
        celebrationRecipients = orgSettings.settings.celebration_recipients;
      }
    } catch (e) {
      console.log("Using default celebration recipients");
    }

    // ========== BUILD NOTIFICATIONS ==========
    const proposalValue = parseFloat(proposal.value || proposal.total_amount || "0");
    const totalValue = proposalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    const proposalTitle = proposal.title || proposal.proposal_number || "Proposta";
    const notificationMessage = `A proposta "${proposalTitle}" foi aceita por ${acceptorName}! Valor: R$ ${totalValue}`;

    const notificationMetadata = {
      proposal_id: proposalId,
      opportunity_id: opportunity?.id || null,
      acceptor_name: acceptorName,
      value: proposal.value,
      account_name: accountName,
      show_celebration: true,
      effects_source: "post-acceptance-effects",
    };

    const notifiedUsers = new Set<string>();
    const notifications: any[] = [];

    // Notify seller
    if (celebrationRecipients.includes("seller") && opportunity?.owner_user_id) {
      notifiedUsers.add(opportunity.owner_user_id);
      notifications.push({
        user_id: opportunity.owner_user_id,
        organization_id: proposal.organization_id,
        type: "deal_won",
        title: "🎉 Proposta Aceita! Você fechou negócio!",
        message: notificationMessage,
        metadata: { ...notificationMetadata, role: "seller" },
      });
    }

    // Notify managers
    if (celebrationRecipients.includes("manager") && opportunity?.owner_user_id) {
      const { data: sellerTeam } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", opportunity.owner_user_id)
        .maybeSingle();

      if (sellerTeam?.team_id) {
        const { data: managers } = await supabase
          .from("team_members")
          .select("user_id")
          .eq("team_id", sellerTeam.team_id)
          .eq("role", "leader");

        for (const mgr of managers || []) {
          if (!notifiedUsers.has(mgr.user_id)) {
            notifiedUsers.add(mgr.user_id);
            notifications.push({
              user_id: mgr.user_id,
              organization_id: proposal.organization_id,
              type: "team_deal_won",
              title: "👔 Membro do seu time fechou negócio!",
              message: notificationMessage,
              metadata: { ...notificationMetadata, role: "manager" },
            });
          }
        }
      }
    }

    // Notify stakeholders by org_role
    const enabledRoles: string[] = [];
    if (celebrationRecipients.includes("admin")) enabledRoles.push("owner", "admin");
    if (celebrationRecipients.includes("finance")) enabledRoles.push("finance");
    if (celebrationRecipients.includes("cs")) enabledRoles.push("cs");
    if (celebrationRecipients.includes("operations")) enabledRoles.push("operations");

    if (enabledRoles.length > 0) {
      const { data: stakeholders } = await supabase
        .from("organization_members")
        .select("user_id, org_role")
        .eq("organization_id", proposal.organization_id)
        .eq("status", "active")
        .in("org_role", enabledRoles);

      const roleTypes: Record<string, string> = {
        owner: "deal_won",
        admin: "deal_won",
        finance: "new_contract",
        cs: "new_onboarding",
        operations: "deal_won",
      };

      const roleTitles: Record<string, string> = {
        owner: "👑 Negócio fechado na sua organização!",
        admin: "👑 Negócio fechado na sua organização!",
        finance: "💰 Novo contrato para faturamento!",
        cs: "🤝 Nova conta para onboarding!",
        operations: "⚙️ Novo contrato fechado!",
      };

      for (const s of stakeholders || []) {
        if (notifiedUsers.has(s.user_id)) continue;
        notifiedUsers.add(s.user_id);
        notifications.push({
          user_id: s.user_id,
          organization_id: proposal.organization_id,
          type: roleTypes[s.org_role] || "deal_won",
          title: roleTitles[s.org_role] || `🎉 Proposta Aceita - ${proposalTitle}`,
          message: notificationMessage,
          metadata: { ...notificationMetadata, role: s.org_role },
        });
      }
    }

    // Insert all notifications in batch
    if (notifications.length > 0) {
      const { error: insertError } = await supabase.from("notifications").insert(notifications);
      if (insertError) {
        console.error("Error inserting notifications:", insertError);
      } else {
        console.log(`Created ${notifications.length} celebration notifications`);
      }
    }

    // ========== SLACK NOTIFICATION ==========
    try {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");

      if (LOVABLE_API_KEY && SLACK_API_KEY) {
        const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

        let sellerName = "Equipe";
        if (opportunity?.owner_user_id) {
          const { data: sellerProfile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", opportunity.owner_user_id)
            .maybeSingle();
          if (sellerProfile) {
            sellerName = [sellerProfile.first_name, sellerProfile.last_name].filter(Boolean).join(" ") || "Equipe";
          }
        }

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
            elements: [{ type: "mrkdwn", text: "Parabéns ao time! 🚀" }],
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
            text: `🎉 Nova contratação: ${accountName} — ${formattedValue}`,
            blocks: slackBlocks,
            unfurl_links: false,
          }),
        });

        const slackResult = await slackResponse.json();
        if (slackResult.ok) {
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
        notifications_created: notifications.length,
        slack_sent: true,
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
