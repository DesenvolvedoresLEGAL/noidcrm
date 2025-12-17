import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeclineRequest {
  proposalId: string;
  reason: string;
  declineReasonId?: string; // UUID do loss_reason selecionado
  declinedByName?: string;
  declinedByIp?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { proposalId, reason, declineReasonId, declinedByName, declinedByIp }: DeclineRequest = await req.json();

    console.log("Processing proposal decline:", proposalId, "Reason ID:", declineReasonId);

    // Get proposal details with opportunity info
    const { data: proposal, error: proposalError } = await supabaseClient
      .from("proposals")
      .select(`
        *,
        opportunity:opportunities(
          id,
          title,
          owner_user_id,
          account:accounts(id, razao_social, nome_fantasia)
        ),
        organization:organizations(id, name)
      `)
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal) {
      console.error("Proposal not found:", proposalError);
      throw new Error("Proposal not found");
    }

    const declinedAt = new Date();

    // Update proposal with decline data
    const { error: updateError } = await supabaseClient
      .from("proposals")
      .update({
        status: "rejected",
        declined_at: declinedAt.toISOString(),
        declined_reason: reason,
        signature_status: "declined",
      })
      .eq("id", proposalId);

    if (updateError) {
      console.error("Failed to update proposal:", updateError);
      throw new Error("Failed to update proposal");
    }

    console.log("Proposal marked as rejected");

    // ========== MARK OPPORTUNITY AS LOST ==========
    const opportunity = proposal.opportunity;
    if (opportunity) {
      // Update opportunity status to lost with loss_reason_id
      const { error: oppUpdateError } = await supabaseClient
        .from("opportunities")
        .update({
          status: "lost",
          loss_reason_id: declineReasonId || null,
          lost_at: declinedAt.toISOString(),
        })
        .eq("id", opportunity.id);

      if (oppUpdateError) {
        console.error("Error updating opportunity status:", oppUpdateError);
      } else {
        console.log("Opportunity marked as lost:", opportunity.id);
      }

      // ========== CREATE WIN_LOSS_RECORD ==========
      try {
        // Check if win_loss_record already exists (anti-duplication)
        const { data: existingRecord } = await supabaseClient
          .from("win_loss_records")
          .select("id")
          .eq("opportunity_id", opportunity.id)
          .maybeSingle();

        if (!existingRecord) {
          const { error: winLossError } = await supabaseClient
            .from("win_loss_records")
            .insert({
              organization_id: proposal.organization_id,
              opportunity_id: opportunity.id,
              outcome: "lost",
              reason_id: declineReasonId || null,
              recorded_by_customer: true,
              customer_feedback: reason,
              final_value: proposal.value || proposal.total_amount,
              recorded_at: declinedAt.toISOString(),
            });

          if (winLossError) {
            console.error("Error creating win_loss_record:", winLossError);
          } else {
            console.log("Created win_loss_record for opportunity:", opportunity.id);
          }
        } else {
          console.log("Win_loss_record already exists, skipping creation");
        }
      } catch (winLossErr) {
        console.error("Exception creating win_loss_record:", winLossErr);
      }

      // ========== REGISTER DECLINE IN AUDIT LOG ==========
      try {
        await supabaseClient.from("audit_log").insert({
          organization_id: proposal.organization_id,
          actor_user_id: null, // External action (no internal user)
          action: "proposal_declined",
          entity_type: "opportunity",
          entity_id: opportunity.id,
          metadata: {
            proposal_id: proposalId,
            proposal_title: proposal.title,
            proposal_number: proposal.proposal_number,
            proposal_value: proposal.value || proposal.total_amount,
            declined_by: declinedByName || "Cliente",
            declined_reason: reason,
            decline_reason_id: declineReasonId,
            declined_at: declinedAt.toISOString(),
            declined_ip: declinedByIp,
          },
        });
        console.log("Registered proposal decline in opportunity history");
      } catch (historyError) {
        console.error("Error registering decline in history:", historyError);
      }

      // ========== NOTIFICATIONS ==========
      const accountName = opportunity.account?.nome_fantasia || opportunity.account?.razao_social || "Cliente";
      const proposalTitle = proposal.title || proposal.proposal_number || "Proposta";
      
      const notificationTitle = `❌ Proposta Recusada - ${proposalTitle}`;
      const notificationMessage = `A proposta "${proposalTitle}" para ${accountName} foi recusada. Motivo: ${reason || "Não informado"}`;
      const notificationMetadata = {
        proposal_id: proposalId,
        opportunity_id: opportunity.id,
        declined_reason: reason,
        value: proposal.value || proposal.total_amount,
        account_name: accountName,
      };

      const notifiedUsers = new Set<string>();

      // 1. Notify the opportunity owner (seller)
      if (opportunity.owner_user_id) {
        notifiedUsers.add(opportunity.owner_user_id);
        await supabaseClient.from("notifications").insert({
          user_id: opportunity.owner_user_id,
          organization_id: proposal.organization_id,
          type: "proposal_declined",
          title: notificationTitle,
          message: notificationMessage,
          metadata: { ...notificationMetadata, role: "seller" },
        });
        console.log("Created notification for seller:", opportunity.owner_user_id);
      }

      // 2. Notify the seller's manager (team leader)
      if (opportunity.owner_user_id) {
        const { data: sellerTeam } = await supabaseClient
          .from("team_members")
          .select("team_id")
          .eq("user_id", opportunity.owner_user_id)
          .maybeSingle();

        if (sellerTeam?.team_id) {
          const { data: managers } = await supabaseClient
            .from("team_members")
            .select("user_id")
            .eq("team_id", sellerTeam.team_id)
            .eq("role", "leader");

          for (const manager of managers || []) {
            if (!notifiedUsers.has(manager.user_id)) {
              notifiedUsers.add(manager.user_id);
              await supabaseClient.from("notifications").insert({
                user_id: manager.user_id,
                organization_id: proposal.organization_id,
                type: "proposal_declined",
                title: "📊 Proposta do seu time foi recusada",
                message: notificationMessage,
                metadata: { ...notificationMetadata, role: "manager" },
              });
              console.log("Created notification for manager:", manager.user_id);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Proposal declined successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in handle-proposal-decline:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process decline" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
