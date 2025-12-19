import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessingResult {
  proposalId: string;
  opportunityTitle: string;
  acceptorName: string;
  contactCreated: boolean;
  contactId: string;
  decisionMakerEdgeCreated: boolean;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[backfill-decision-makers] Starting backfill process...");

    // Get all accepted proposals with acceptor_name
    const { data: proposals, error: proposalsError } = await supabase
      .from("proposals")
      .select(`
        id,
        acceptor_name,
        acceptor_position,
        accepted_at,
        organization_id,
        opportunity:opportunities!inner(
          id,
          title,
          account_id
        )
      `)
      .eq("status", "accepted")
      .not("acceptor_name", "is", null)
      .not("acceptor_name", "eq", "");

    if (proposalsError) {
      console.error("[backfill-decision-makers] Error fetching proposals:", proposalsError);
      throw proposalsError;
    }

    console.log(`[backfill-decision-makers] Found ${proposals?.length || 0} accepted proposals with acceptor data`);

    const results: ProcessingResult[] = [];

    for (const proposal of proposals || []) {
      const opportunity = proposal.opportunity as any;
      const result: ProcessingResult = {
        proposalId: proposal.id,
        opportunityTitle: opportunity?.title || "Unknown",
        acceptorName: proposal.acceptor_name,
        contactCreated: false,
        contactId: "",
        decisionMakerEdgeCreated: false,
      };

      try {
        if (!opportunity?.account_id) {
          result.error = "No account_id found for opportunity";
          results.push(result);
          continue;
        }

        const acceptorName = proposal.acceptor_name?.trim();
        const acceptorPosition = proposal.acceptor_position?.trim() || null;

        // Check if contact already exists for this account
        const { data: existingContacts, error: contactSearchError } = await supabase
          .from("contacts")
          .select("id, nome")
          .eq("account_id", opportunity.account_id)
          .eq("organization_id", proposal.organization_id);

        if (contactSearchError) {
          result.error = `Error searching contacts: ${contactSearchError.message}`;
          results.push(result);
          continue;
        }

        // Find contact with similar name (case insensitive)
        const normalizedAcceptorName = acceptorName.toLowerCase().trim();
        let contactId: string | null = null;

        const matchingContact = existingContacts?.find((c) => {
          const contactName = c.nome?.toLowerCase().trim() || "";
          return contactName === normalizedAcceptorName ||
            contactName.includes(normalizedAcceptorName) ||
            normalizedAcceptorName.includes(contactName);
        });

        if (matchingContact) {
          contactId = matchingContact.id;
          console.log(`[backfill-decision-makers] Found existing contact: ${matchingContact.nome} (${contactId})`);
        } else {
          // Create new contact
          const { data: newContact, error: createContactError } = await supabase
            .from("contacts")
            .insert({
              nome: acceptorName,
              cargo: acceptorPosition,
              account_id: opportunity.account_id,
              organization_id: proposal.organization_id,
            })
            .select("id")
            .single();

          if (createContactError) {
            result.error = `Error creating contact: ${createContactError.message}`;
            results.push(result);
            continue;
          }

          contactId = newContact.id;
          result.contactCreated = true;
          console.log(`[backfill-decision-makers] Created new contact: ${acceptorName} (${contactId})`);

          // Create audit log for contact creation
          await supabase.from("audit_log").insert({
            organization_id: proposal.organization_id,
            entity_type: "contact",
            entity_id: contactId,
            action: "auto_created_from_proposal_backfill",
            metadata: {
              proposal_id: proposal.id,
              opportunity_id: opportunity.id,
              acceptor_name: acceptorName,
              acceptor_position: acceptorPosition,
            },
          });
        }

        result.contactId = contactId!;

        // Ensure contact node exists in graph_nodes - use node_type column
        let contactNodeId: string;
        const { data: existingContactNode } = await supabase
          .from("graph_nodes")
          .select("id")
          .eq("node_type", "contact")
          .eq("entity_id", contactId)
          .eq("organization_id", proposal.organization_id)
          .maybeSingle();

        if (existingContactNode) {
          contactNodeId = existingContactNode.id;
        } else {
          const { data: newContactNode, error: nodeError } = await supabase
            .from("graph_nodes")
            .insert({
              organization_id: proposal.organization_id,
              node_type: "contact",
              entity_id: contactId,
              label: acceptorName,
              properties: {
                cargo: acceptorPosition,
                account_id: opportunity.account_id,
              },
            })
            .select("id")
            .single();

          if (nodeError) {
            result.error = `Error creating contact node: ${nodeError.message}`;
            results.push(result);
            continue;
          }
          contactNodeId = newContactNode.id;
          console.log(`[backfill-decision-makers] Created graph node for contact: ${acceptorName} (${contactNodeId})`);
        }

        // Ensure opportunity node exists in graph_nodes
        let oppNodeId: string;
        const { data: existingOppNode } = await supabase
          .from("graph_nodes")
          .select("id")
          .eq("node_type", "opportunity")
          .eq("entity_id", opportunity.id)
          .eq("organization_id", proposal.organization_id)
          .maybeSingle();

        if (existingOppNode) {
          oppNodeId = existingOppNode.id;
        } else {
          const { data: newOppNode, error: oppNodeError } = await supabase
            .from("graph_nodes")
            .insert({
              organization_id: proposal.organization_id,
              node_type: "opportunity",
              entity_id: opportunity.id,
              label: opportunity.title,
              properties: {
                account_id: opportunity.account_id,
              },
            })
            .select("id")
            .single();

          if (oppNodeError) {
            result.error = `Error creating opportunity node: ${oppNodeError.message}`;
            results.push(result);
            continue;
          }
          oppNodeId = newOppNode.id;
          console.log(`[backfill-decision-makers] Created graph node for opportunity: ${opportunity.title} (${oppNodeId})`);
        }

        // Check if decision_maker edge already exists
        const { data: existingEdge } = await supabase
          .from("graph_edges")
          .select("id")
          .eq("source_node_id", contactNodeId)
          .eq("target_node_id", oppNodeId)
          .eq("edge_type", "decision_maker")
          .maybeSingle();

        if (!existingEdge) {
          // Remove any existing decision_maker edges for this opportunity
          await supabase
            .from("graph_edges")
            .delete()
            .eq("target_node_id", oppNodeId)
            .eq("edge_type", "decision_maker");

          // Create decision_maker edge
          const { error: edgeError } = await supabase.from("graph_edges").insert({
            organization_id: proposal.organization_id,
            source_node_id: contactNodeId,
            target_node_id: oppNodeId,
            edge_type: "decision_maker" as any,
            properties: {
              proposal_id: proposal.id,
              accepted_at: proposal.accepted_at,
              created_by: "backfill",
            },
          });

          if (edgeError) {
            result.error = `Error creating edge: ${edgeError.message}`;
            results.push(result);
            continue;
          }

          result.decisionMakerEdgeCreated = true;
          console.log(`[backfill-decision-makers] Created decision_maker edge for: ${acceptorName} -> ${opportunity.title}`);
        } else {
          console.log(`[backfill-decision-makers] Decision maker edge already exists for: ${acceptorName} -> ${opportunity.title}`);
        }

        results.push(result);
      } catch (err) {
        result.error = `Unexpected error: ${(err as Error).message}`;
        results.push(result);
      }
    }

    // Calculate summary
    const summary = {
      totalProposals: results.length,
      contactsCreated: results.filter((r) => r.contactCreated).length,
      decisionMakerEdgesCreated: results.filter((r) => r.decisionMakerEdgeCreated).length,
      errors: results.filter((r) => r.error).length,
    };

    console.log("[backfill-decision-makers] Backfill completed:", summary);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        details: results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[backfill-decision-makers] Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
