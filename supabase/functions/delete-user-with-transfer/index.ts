import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate caller
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { user_id_to_delete, transfer_to_user_id, organization_id } = body;

    if (!user_id_to_delete || !transfer_to_user_id || !organization_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user_id_to_delete === transfer_to_user_id) {
      return new Response(JSON.stringify({ error: "Cannot transfer to the same user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin of the organization
    const { data: callerMember } = await supabaseAdmin
      .from("organization_members")
      .select("org_role")
      .eq("user_id", caller.id)
      .eq("organization_id", organization_id)
      .eq("status", "active")
      .single();

    if (!callerMember || !["owner", "admin"].includes(callerMember.org_role)) {
      return new Response(JSON.stringify({ error: "Only admins can delete users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify both users belong to the organization
    const { data: targetMember } = await supabaseAdmin
      .from("organization_members")
      .select("id, org_role, status")
      .eq("user_id", user_id_to_delete)
      .eq("organization_id", organization_id)
      .single();

    if (!targetMember) {
      return new Response(JSON.stringify({ error: "User to delete not found in organization" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (targetMember.org_role === "owner") {
      return new Response(JSON.stringify({ error: "Cannot delete the organization owner" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: recipientMember } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("user_id", transfer_to_user_id)
      .eq("organization_id", organization_id)
      .eq("status", "active")
      .single();

    if (!recipientMember) {
      return new Response(JSON.stringify({ error: "Transfer recipient not found or inactive" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transfer all records
    const transferResults: Record<string, number> = {};
    const historicalProtection: Record<string, number> = {};

    // --- HISTORICAL ATTRIBUTION GUARD ---
    // Closed (won/lost) opportunities keep their original owner_user_id so that:
    //  - opportunity_owner_history at closed_at still resolves to the original seller
    //  - commercial_won_revenue_historical_view and OTE results stay immutable
    // We only transfer OPEN (operational) records. created_by is NEVER transferred —
    // it represents who originally created the record, an immutable historical fact.
    const { count: closedOppsPreserved } = await supabaseAdmin
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", user_id_to_delete)
      .eq("organization_id", organization_id)
      .in("status", ["won", "lost"]);
    historicalProtection.opportunities_closed_preserved = closedOppsPreserved || 0;

    // Opportunities - owner_user_id (OPEN only)
    const { count: oppOwner } = await supabaseAdmin
      .from("opportunities")
      .update({ owner_user_id: transfer_to_user_id })
      .eq("owner_user_id", user_id_to_delete)
      .eq("organization_id", organization_id)
      .not("status", "in", "(won,lost)")
      .select("*", { count: "exact", head: true });
    transferResults.opportunities_owner_open = oppOwner || 0;

    // created_by is immutable historical attribution — DO NOT transfer.
    const { count: oppCreatedPreserved } = await supabaseAdmin
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("created_by", user_id_to_delete)
      .eq("organization_id", organization_id);
    historicalProtection.opportunities_created_by_preserved = oppCreatedPreserved || 0;

    // Accounts - owner_user_id (operational, safe to transfer)
    const { count: accOwner } = await supabaseAdmin
      .from("accounts")
      .update({ owner_user_id: transfer_to_user_id })
      .eq("owner_user_id", user_id_to_delete)
      .eq("organization_id", organization_id)
      .select("*", { count: "exact", head: true });
    transferResults.accounts_owner = accOwner || 0;

    // Accounts - created_by is immutable historical attribution — DO NOT transfer.
    const { count: accCreatedPreserved } = await supabaseAdmin
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("created_by", user_id_to_delete)
      .eq("organization_id", organization_id);
    historicalProtection.accounts_created_by_preserved = accCreatedPreserved || 0;

    // Accounts - cs_user_id
    const { count: accCs } = await supabaseAdmin
      .from("accounts")
      .update({ cs_user_id: transfer_to_user_id })
      .eq("cs_user_id", user_id_to_delete)
      .eq("organization_id", organization_id)
      .select("*", { count: "exact", head: true });
    transferResults.accounts_cs = accCs || 0;

    // Activities - owner_user_id
    const { count: actOwner } = await supabaseAdmin
      .from("activities")
      .update({ owner_user_id: transfer_to_user_id })
      .eq("owner_user_id", user_id_to_delete)
      .eq("organization_id", organization_id)
      .select("*", { count: "exact", head: true });
    transferResults.activities = actOwner || 0;

    // Contracts - owner_user_id
    const { count: contOwner } = await supabaseAdmin
      .from("contracts")
      .update({ owner_user_id: transfer_to_user_id })
      .eq("owner_user_id", user_id_to_delete)
      .eq("organization_id", organization_id)
      .select("*", { count: "exact", head: true });
    transferResults.contracts = contOwner || 0;

    // Deal participants
    const { count: dealPart } = await supabaseAdmin
      .from("deal_participants")
      .update({ user_id: transfer_to_user_id })
      .eq("user_id", user_id_to_delete)
      .eq("organization_id", organization_id)
      .select("*", { count: "exact", head: true });
    transferResults.deal_participants = dealPart || 0;

    // Activity participants
    const { count: actPart } = await supabaseAdmin
      .from("activity_participants")
      .update({ user_id: transfer_to_user_id })
      .eq("user_id", user_id_to_delete)
      .eq("organization_id", organization_id)
      .select("*", { count: "exact", head: true });
    transferResults.activity_participants = actPart || 0;

    // Team members - remove from teams
    const { count: teamMem } = await supabaseAdmin
      .from("team_members")
      .delete()
      .eq("user_id", user_id_to_delete)
      .eq("organization_id", organization_id)
      .select("*", { count: "exact", head: true });
    transferResults.team_members_removed = teamMem || 0;

    // Sellers - deactivate
    const { count: sellerCount } = await supabaseAdmin
      .from("sellers")
      .update({ active: false })
      .eq("user_id", user_id_to_delete)
      .eq("organization_id", organization_id)
      .select("*", { count: "exact", head: true });
    transferResults.sellers_deactivated = sellerCount || 0;

    // Mark member as deleted
    const deletedAtIso = new Date().toISOString();
    const deletedDate = deletedAtIso.split("T")[0];
    const { error: updateError } = await supabaseAdmin
      .from("organization_members")
      .update({
        status: "deleted",
        deleted_at: deletedAtIso,
        deleted_by: caller.id,
        transferred_to: transfer_to_user_id,
      })
      .eq("user_id", user_id_to_delete)
      .eq("organization_id", organization_id);

    if (updateError) {
      console.error("Error marking member as deleted:", updateError);
      return new Response(JSON.stringify({ error: "Failed to delete user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PATCH OTE 1.7.6 — Encerrar ote_seller_config no dia do desligamento.
    // Sem isso, calculate-ote continua tratando o vendedor como vigente em
    // períodos posteriores ao desligamento e gera linhas vazias no ranking.
    try {
      const { data: openConfigs } = await supabaseAdmin
        .from("ote_seller_config")
        .select("id, end_date")
        .eq("organization_id", organization_id)
        .eq("user_id", user_id_to_delete);
      const toClose = (openConfigs || []).filter(
        (c: any) => !c.end_date || c.end_date > deletedDate,
      );
      if (toClose.length > 0) {
        const { error: closeErr } = await supabaseAdmin
          .from("ote_seller_config")
          .update({ end_date: deletedDate, updated_at: deletedAtIso })
          .in(
            "id",
            toClose.map((c: any) => c.id),
          );
        if (closeErr) {
          console.error("[OTE 1.7.6] Failed to close ote_seller_config:", closeErr);
        } else {
          (transferResults as any).ote_seller_configs_closed = toClose.length;
          await supabaseAdmin.from("system_events").insert({
            organization_id,
            event_type: "ote_seller_config_closed_on_member_delete",
            entity_type: "user",
            entity_id: user_id_to_delete,
            actor_user_id: caller.id,
            metadata: {
              closed_count: toClose.length,
              end_date: deletedDate,
              config_ids: toClose.map((c: any) => c.id),
            },
          });
        }
      }
    } catch (e) {
      console.error("[OTE 1.7.6] ote_seller_config closure failed:", e);
    }

    // Audit log — includes both what moved AND what was preserved for historical integrity
    await supabaseAdmin.from("audit_log").insert({
      action: "user_deleted_with_transfer",
      actor_user_id: caller.id,
      entity_type: "organization_member",
      entity_id: user_id_to_delete,
      organization_id,
      metadata: {
        transferred_to: transfer_to_user_id,
        transfer_results: transferResults,
        historical_protection: historicalProtection,
        rules: {
          opportunities_owner_user_id: "transferred only when status NOT IN (won, lost)",
          opportunities_created_by: "preserved (immutable historical attribution)",
          accounts_created_by: "preserved (immutable historical attribution)",
          historical_results_source: "opportunity_owner_history + commercial_won_revenue_historical_view",
        },
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        transfer_results: transferResults,
        historical_protection: historicalProtection,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in delete-user-with-transfer:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
