import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  resolveApprovedProposalAmount,
  APPROVED_VALUE_SELECT_COLUMNS,
} from "../_shared/approved-proposal-value.ts";
import { generatePreReservationFromProposalServer } from "../_shared/inventory-from-proposal.ts";


const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth model:
  //  1. Worker/cron: presents x-internal-secret = INTERNAL_WORKFLOW_SECRET → may run in worker mode (no body)
  //  2. Public/anon caller (proposal acceptance page) OR authenticated CRM user:
  //     must pass { proposalId } in body. We then validate via service_role that the proposal
  //     is actually `accepted` AND has a pending/failed job in acceptance_effect_jobs.
  //     This prevents anon abuse: they cannot forge a job (only the DB trigger inserts).
  const internalSecret = req.headers.get('x-internal-secret');
  const expectedSecret = Deno.env.get('INTERNAL_WORKFLOW_SECRET');
  const isInternalCaller = !!expectedSecret && internalSecret === expectedSecret;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { proposalId } = body;

    // Authorization rules:
    //  - Worker mode (no proposalId): requires internal secret.
    //  - Specific proposalId: must reference a proposal that is currently `accepted`.
    //    Internal callers can additionally bootstrap the job if missing.
    let jobs: any[] = [];

    if (!proposalId && !isInternalCaller) {
      return new Response(JSON.stringify({ error: 'Unauthorized: worker mode requires internal secret' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (proposalId) {
      // Validate proposal exists and is accepted (anti-abuse for anon callers)
      const { data: prop } = await supabase
        .from("proposals")
        .select("id, organization_id, status, accepted_at")
        .eq("id", proposalId)
        .maybeSingle();

      if (!prop) {
        return new Response(JSON.stringify({ error: 'Proposal not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (prop.status !== 'accepted' || !prop.accepted_at) {
        return new Response(JSON.stringify({ error: 'Proposal is not accepted' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Ensure job exists (trigger should have created it, but be safe — only for internal callers
      // OR when proposal is verifiably accepted, which we just checked above).
      const { data: existingJob } = await supabase
        .from("acceptance_effect_jobs")
        .select("*")
        .eq("proposal_id", proposalId)
        .maybeSingle();

      if (!existingJob) {
        await supabase.from("acceptance_effect_jobs").upsert({
          proposal_id: proposalId,
          organization_id: prop.organization_id,
          accepted_at: prop.accepted_at,
          status: "pending",
        }, { onConflict: "proposal_id,accepted_at" });
      }

      const { data } = await supabase
        .from("acceptance_effect_jobs")
        .select("*")
        .eq("proposal_id", proposalId)
        .in("status", ["pending", "failed"])
        .or("notifications_processed_at.is.null,slack_processed_at.is.null,inventory_processed_at.is.null")
        .limit(1);
      jobs = data || [];
    } else {
      // Worker mode is a safety net for fresh acceptance events only.
      // Historical replays/backfills must always be invoked with an explicit proposalId.
      const workerCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("acceptance_effect_jobs")
        .select("*")
        .in("status", ["pending", "failed"])
        .lt("attempt_count", 5)
        .gte("accepted_at", workerCutoff)
        .gte("created_at", workerCutoff)
        .order("created_at", { ascending: true })
        .limit(10);
      jobs = data || [];
    }

    if (jobs.length === 0) {
      console.log("No pending acceptance effect jobs to process");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const job of jobs) {
      console.log(`Processing acceptance effect job ${job.id} for proposal ${job.proposal_id}`);
      const result = await processJob(supabase, job);
      results.push(result);
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("post-acceptance-effects error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processJob(supabase: any, job: any) {
  const { proposal_id, id: jobId } = job;

  // Mark as processing
  await supabase
    .from("acceptance_effect_jobs")
    .update({ status: "processing", attempt_count: job.attempt_count + 1, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  try {
    // ===== LOAD DATA =====
    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select(
        `id, title, proposal_number, organization_id, acceptor_name, opportunity_id, client_name, ${APPROVED_VALUE_SELECT_COLUMNS}`,
      )
      .eq("id", proposal_id)
      .single();

    if (proposalError || !proposal) {
      throw new Error(`Proposal not found: ${proposalError?.message}`);
    }

    

    // Find opportunity — use the direct relation on proposals first
    let opportunity: any = null;
    const opportunityId = proposal.opportunity_id || job.opportunity_id;

    if (opportunityId) {
      const { data: opp } = await supabase
        .from("opportunities")
        .select("id, title, owner_user_id, account_id, valor_previsto")
        .eq("id", opportunityId)
        .single();
      opportunity = opp;
    }

    // Fallback: try via proposal_items only if direct relation didn't work
    if (!opportunity) {
      const { data: propItems } = await supabase
        .from("proposal_items")
        .select("opportunity_id")
        .eq("proposal_id", proposal_id)
        .not("opportunity_id", "is", null)
        .limit(1);
      if (propItems?.[0]?.opportunity_id) {
        const { data: opp } = await supabase
          .from("opportunities")
          .select("id, title, owner_user_id, account_id, valor_previsto")
          .eq("id", propItems[0].opportunity_id)
          .single();
        opportunity = opp;
      }
    }

    console.log(`[post-acceptance-effects] Proposal ${proposal_id}: opportunity_id=${opportunity?.id || 'NOT FOUND'}, account_id=${opportunity?.account_id || 'NONE'}, owner=${opportunity?.owner_user_id || 'NONE'}`);

    // Update job with opportunity_id if found
    if (opportunity?.id && !job.opportunity_id) {
      await supabase.from("acceptance_effect_jobs").update({ opportunity_id: opportunity.id }).eq("id", jobId);
    }

    let accountName = "Cliente";
    if (opportunity?.account_id) {
      const { data: account } = await supabase
        .from("accounts")
        .select("razao_social, nome_fantasia")
        .eq("id", opportunity.account_id)
        .single();
      if (account) {
        accountName = account.nome_fantasia || account.razao_social || proposal.client_name || "Cliente";
      } else {
        accountName = proposal.client_name || "Cliente";
      }
    } else {
      accountName = proposal.client_name || "Cliente";
    }

    console.log(`[post-acceptance-effects] Resolved: accountName="${accountName}", acceptor="${proposal.acceptor_name || 'N/A'}"`);

    const acceptorName = proposal.acceptor_name || "Cliente";

    // Get seller name
    let sellerName = "Equipe";
    if (opportunity?.owner_user_id) {
      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", opportunity.owner_user_id)
        .maybeSingle();
      if (sellerProfile?.full_name) {
        sellerName = sellerProfile.full_name;
      }
    }

    // Get org primary_color
    let primaryColor = "#020cbc";
    const { data: org } = await supabase
      .from("organizations")
      .select("primary_color")
      .eq("id", proposal.organization_id)
      .single();
    if (org?.primary_color) primaryColor = org.primary_color;

    // Source of truth for the COMMERCIAL APPROVED value:
    // dynamic pricing (when active) > total_amount > value.
    const approved = resolveApprovedProposalAmount(proposal as any);
    const proposalValue = approved.amount;
    const totalValue = proposalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    const proposalTitle = proposal.title || proposal.proposal_number || "Proposta";
    console.log(
      `[post-acceptance-effects] Approved value for ${proposal_id}: ${proposalValue} (source=${approved.source}, base=${approved.base_amount}, dyn=${approved.dynamic_amount})`,
    );

    // ===== STAGE 1: NOTIFICATIONS (per-stage idempotency) =====
    let notificationsCreated = 0;
    if (!job.notifications_processed_at) {
      // Check if notifications already exist for this proposal (idempotency)
      const { data: existingNotifs } = await supabase
        .from("notifications")
        .select("id")
        .in("type", ["deal_won", "team_deal_won", "new_contract", "new_onboarding"])
        .eq("metadata->>proposal_id", proposal_id)
        .limit(1);

      if (existingNotifs && existingNotifs.length > 0) {
        console.log(`Notifications already exist for proposal ${proposal_id}, marking stage done`);
        await supabase.from("acceptance_effect_jobs")
          .update({ notifications_processed_at: new Date().toISOString() })
          .eq("id", jobId);
      } else {
        const notificationMessage = `${sellerName} fechou negócio com ${accountName}! Proposta "${proposalTitle}" aceita por ${acceptorName}. Valor: R$ ${totalValue}`;
        const notificationMetadata = {
          proposal_id: proposal_id,
          opportunity_id: opportunity?.id || null,
          acceptor_name: acceptorName,
          seller_name: sellerName,
          value: proposalValue,
          amount_source: approved.source,
          base_amount: approved.base_amount,
          dynamic_amount: approved.dynamic_amount,
          account_name: accountName,
          primary_color: primaryColor,
          show_celebration: true,
          effects_source: "post-acceptance-effects-v2",
        };

        const { data: allMembers } = await supabase
          .from("organization_members")
          .select("user_id, org_role")
          .eq("organization_id", proposal.organization_id)
          .eq("status", "active");

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
            title: isSeller ? "🎉 Proposta Aceita! Você fechou negócio!" : `🎉 ${sellerName} fechou negócio!`,
            message: notificationMessage,
            metadata: { ...notificationMetadata, role: isSeller ? "seller" : member.org_role || "member" },
          });
        }

        if (notifications.length > 0) {
          const { error: insertError } = await supabase.from("notifications").insert(notifications);
          if (insertError) {
            console.error("Error inserting notifications:", insertError);
            throw new Error(`Notifications insert failed: ${insertError.message}`);
          }
          notificationsCreated = notifications.length;
          console.log(`Created ${notificationsCreated} celebration notifications`);

          // Additive v2 enrichment path (non-fatal): create event payload + notifications_v2
          try {
            const celebrationPayload = {
              proposal_id: proposal_id,
              opportunity_id: opportunity?.id || null,
              acceptor_name: acceptorName,
              seller_name: sellerName,
              value: proposalValue,
              amount_source: approved.source,
              base_amount: approved.base_amount,
              dynamic_amount: approved.dynamic_amount,
              account_name: accountName,
              primary_color: primaryColor,
              show_celebration: true,
              effects_source: "post-acceptance-effects-v2",
            };

            const { data: evt, error: evtErr } = await supabase
              .from("notification_events")
              .insert({
                event_type: "deal_won",
                entity_type: "opportunity",
                entity_id: opportunity?.id || null,
                opportunity_id: opportunity?.id || null,
                proposal_id: proposal_id,
                company_id: opportunity?.account_id || null,
                organization_id: proposal.organization_id,
                triggered_by_user_id: opportunity?.owner_user_id || null,
                payload: celebrationPayload,
              })
              .select("id")
              .single();

            if (evtErr) {
              console.error("[post-acceptance-effects] failed to create celebration event for v2:", evtErr);
            } else {
              const recipientIds = notifications.map((n) => n.user_id);
              const { data: settingsRows } = await supabase
                .from("notification_settings")
                .select("user_id, realtime_in_app_enabled, realtime_email_enabled")
                .in("user_id", recipientIds);

              const settingsByUser = new Map((settingsRows || []).map((s) => [s.user_id, s]));
              const actionUrl = opportunity?.id ? `/app/opportunities/${opportunity.id}` : null;
              const notificationsV2 = notifications.map((n) => {
                const userSettings = settingsByUser.get(n.user_id);
                return {
                  user_id: n.user_id,
                  event_id: evt.id,
                  type: n.type,
                  title: n.title,
                  message: n.message,
                  priority: "high",
                  channel_in_app: userSettings?.realtime_in_app_enabled ?? true,
                  channel_email: userSettings?.realtime_email_enabled ?? false,
                  channel_push: false,
                  status: "pending",
                  action_url: actionUrl,
                };
              });

              if (notificationsV2.length > 0) {
                const { error: v2Err } = await supabase.from("notifications_v2").insert(notificationsV2);
                if (v2Err) {
                  console.error("[post-acceptance-effects] failed to create celebration notifications_v2:", v2Err);
                } else {
                  console.log(`Created ${notificationsV2.length} celebration notifications_v2`);
                }
              }
            }
          } catch (v2Err) {
            console.error("[post-acceptance-effects] non-fatal v2 celebration enrichment error:", v2Err);
          }
        }

        await supabase.from("acceptance_effect_jobs")
          .update({ notifications_processed_at: new Date().toISOString() })
          .eq("id", jobId);
      }
    } else {
      console.log(`Notifications already processed for job ${jobId}`);
    }

    // ===== STAGE 2: SLACK (per-stage idempotency with retry) =====
    let slackSent = false;
    if (!job.slack_processed_at) {
      try {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
        const SLACK_DEFAULT_CHANNEL = Deno.env.get("SLACK_DEFAULT_CHANNEL");

        // Resolve channel: org-level config first, then env fallback
        const { data: orgSlack } = await supabase
          .from("organizations")
          .select("slack_channel_id")
          .eq("id", proposal.organization_id)
          .maybeSingle();
        const slackChannel = orgSlack?.slack_channel_id || SLACK_DEFAULT_CHANNEL || null;

        if (!LOVABLE_API_KEY || !SLACK_API_KEY) {
          console.log("[slack] LOVABLE_API_KEY or SLACK_API_KEY missing — marking Slack stage as done (non-blocking)");
          slackSent = true;
        } else if (!slackChannel) {
          console.warn(`[slack] No slack_channel_id configured for org ${proposal.organization_id} and no SLACK_DEFAULT_CHANNEL env — skipping Slack (non-blocking)`);
          await supabase.from("acceptance_effect_jobs")
            .update({ last_error: "Slack channel not configured for organization" })
            .eq("id", jobId);
          slackSent = true;
        } else {
          const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
          const formattedValue = proposalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

          const slackBlocks = [
            { type: "header", text: { type: "plain_text", text: "🎉 Nova contratação fechada!", emoji: true } },
            {
              type: "section",
              fields: [
                { type: "mrkdwn", text: `*Cliente:*\n${accountName}` },
                { type: "mrkdwn", text: `*Proposta:*\n${proposal.proposal_number || ""} — ${proposalTitle}` },
                { type: "mrkdwn", text: `*Valor:*\n${formattedValue}` },
                { type: "mrkdwn", text: `*Vendedor:*\n${sellerName}` },
              ],
            },
            { type: "context", elements: [{ type: "mrkdwn", text: `Aprovado por ${acceptorName} 🚀` }] },
          ];

          const slackPayload = JSON.stringify({
            channel: slackChannel,
            text: `🎉 Nova contratação: ${accountName} — ${formattedValue} (vendedor: ${sellerName})`,
            blocks: slackBlocks,
            unfurl_links: false,
          });

          // Retry up to 3 times with exponential backoff for transient errors
          const MAX_RETRIES = 3;
          let lastSlackError = "";
          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              const slackResponse = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "X-Connection-Api-Key": SLACK_API_KEY,
                  "Content-Type": "application/json",
                },
                body: slackPayload,
              });

              const slackResult = await slackResponse.json();
              if (slackResult.ok) {
                slackSent = true;
                console.log(`Slack notification sent successfully (attempt ${attempt}) to channel ${slackChannel}`);
                break;
              }

              lastSlackError = slackResult.error || "unknown_error";
              // Non-retryable errors
              if (["channel_not_found", "not_in_channel", "invalid_auth", "account_inactive", "token_revoked"].includes(lastSlackError)) {
                console.error(`Slack non-retryable error: ${lastSlackError}`);
                break;
              }
              console.warn(`Slack attempt ${attempt}/${MAX_RETRIES} failed: ${lastSlackError}`);
            } catch (fetchErr) {
              lastSlackError = fetchErr.message || "fetch_error";
              console.warn(`Slack attempt ${attempt}/${MAX_RETRIES} fetch error: ${lastSlackError}`);
            }

            if (attempt < MAX_RETRIES) {
              const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
              await new Promise(r => setTimeout(r, delay));
            }
          }

          if (!slackSent) {
            // Non-retryable / config errors: mark stage as done with warning to avoid permanent "failed" state
            if (["channel_not_found", "not_in_channel", "invalid_auth", "account_inactive", "token_revoked"].includes(lastSlackError)) {
              console.warn(`[slack] Non-retryable error '${lastSlackError}' — marking stage as done with warning to unblock job`);
              await supabase.from("acceptance_effect_jobs")
                .update({ last_error: `Slack non-retryable: ${lastSlackError}` })
                .eq("id", jobId);
              slackSent = true;
            } else {
              throw new Error(`Slack API error after ${MAX_RETRIES} attempts: ${lastSlackError}`);
            }
          }
        }

        await supabase.from("acceptance_effect_jobs")
          .update({ slack_processed_at: new Date().toISOString() })
          .eq("id", jobId);
      } catch (slackError) {
        console.error("Slack stage failed:", slackError);
        await supabase.from("acceptance_effect_jobs")
          .update({ last_error: `Slack: ${slackError.message}` })
          .eq("id", jobId);
      }
    } else {
      console.log(`Slack already processed for job ${jobId}`);
      slackSent = true;
    }

    // ===== STAGE 3: INVENTORY PRE-RESERVATION (idempotent, non-blocking) =====
    let inventoryStatus: string = "skipped";
    let inventoryPreReservationId: string | null = null;
    let inventoryDetails: any = null;
    if (!job.inventory_processed_at) {
      try {
        const invResult = await generatePreReservationFromProposalServer(supabase, proposal_id);
        inventoryStatus = invResult.status;
        inventoryDetails = (invResult as any).details ?? null;
        if (invResult.status === "created" || invResult.status === "reused") {
          inventoryPreReservationId = (invResult as any).pre_reservation_id ?? null;
        }
        await supabase
          .from("acceptance_effect_jobs")
          .update({
            inventory_processed_at: new Date().toISOString(),
            inventory_status: invResult.status,
            inventory_pre_reservation_id: inventoryPreReservationId,
            inventory_error: invResult.status === "error" ? (invResult as any).error : null,
            inventory_details: inventoryDetails,
          })
          .eq("id", jobId);

        // Notify operations team when there is something actionable
        if (
          invResult.status === "created" ||
          invResult.status === "no_event_date" ||
          invResult.status === "no_inventory_items"
        ) {
          try {
            const { data: opsMembers } = await supabase
              .from("organization_members")
              .select("user_id, org_role")
              .eq("organization_id", proposal.organization_id)
              .eq("status", "active")
              .in("org_role", ["owner", "admin", "operations", "operacional"]);
            const titleByStatus: Record<string, string> = {
              created: "📦 Pré-reserva gerada — confirme no inventário",
              no_event_date: "⚠️ Proposta aceita sem data de evento",
              no_inventory_items: "⚠️ Proposta aceita sem itens com controle de estoque",
            };
            const messageByStatus: Record<string, string> = {
              created: `Pré-reserva criada para ${accountName} (proposta ${proposal.proposal_number || ""}). Aloque os itens e confirme a reserva no inventário.`,
              no_event_date: `Proposta aceita por ${accountName} sem data de evento. Informe a data para gerar a pré-reserva no inventário.`,
              no_inventory_items: `Proposta aceita por ${accountName} sem produtos vinculados a inventário. Configure o controle de estoque dos produtos para reservar capacidade.`,
            };
            const ops = (opsMembers || []).map((m) => ({
              user_id: m.user_id,
              organization_id: proposal.organization_id,
              type: "inventory_action_required",
              title: titleByStatus[invResult.status],
              message: messageByStatus[invResult.status],
              metadata: {
                proposal_id,
                opportunity_id: opportunity?.id || null,
                pre_reservation_id: inventoryPreReservationId,
                inventory_status: invResult.status,
                account_name: accountName,
              },
            }));
            if (ops.length > 0) {
              await supabase.from("notifications").insert(ops);
            }
          } catch (notifErr) {
            console.error("[inventory] failed to notify ops (non-fatal):", notifErr);
          }
        }
        console.log(`[inventory] proposal ${proposal_id} → status=${invResult.status}`);
      } catch (invErr: any) {
        console.error("[inventory] stage failed:", invErr);
        await supabase
          .from("acceptance_effect_jobs")
          .update({
            inventory_processed_at: new Date().toISOString(),
            inventory_status: "error",
            inventory_error: invErr?.message ?? String(invErr),
          })
          .eq("id", jobId);
        inventoryStatus = "error";
      }
    } else {
      inventoryStatus = job.inventory_status ?? "already_processed";
      inventoryPreReservationId = job.inventory_pre_reservation_id ?? null;
    }

    // ===== CHECK COMPLETION =====
    // Reload job to check current state
    const { data: updatedJob } = await supabase
      .from("acceptance_effect_jobs")
      .select("notifications_processed_at, slack_processed_at, inventory_processed_at")
      .eq("id", jobId)
      .single();

    const allDone =
      updatedJob?.notifications_processed_at &&
      updatedJob?.slack_processed_at &&
      updatedJob?.inventory_processed_at;

    await supabase.from("acceptance_effect_jobs")
      .update({
        status: allDone ? "completed" : "failed",
        last_error: allDone ? null : "Partial completion - some stages pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    console.log(`Job ${jobId} finished: ${allDone ? "completed" : "partial"}`);

    return {
      jobId,
      proposalId: proposal_id,
      notifications_created: notificationsCreated,
      slack_sent: slackSent,
      inventory_status: inventoryStatus,
      inventory_pre_reservation_id: inventoryPreReservationId,
      status: allDone ? "completed" : "partial",
    };
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    await supabase.from("acceptance_effect_jobs")
      .update({
        status: "failed",
        last_error: error.message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return { jobId, proposalId: proposal_id, error: error.message, status: "failed" };
  }
}
