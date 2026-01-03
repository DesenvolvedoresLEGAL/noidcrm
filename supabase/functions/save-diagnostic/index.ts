import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DiagnosticAnswer {
  questionId: number;
  areaKey: string;
  selectedOption: number;
  points: number;
}

interface DiagnosticRequest {
  leadData: {
    nome: string;
    empresa: string;
    whatsapp: string;
    email: string;
  };
  opportunityId?: string | null;
  answers: DiagnosticAnswer[];
  areaScores: Record<string, number>;
  totalScore: number;
  classification: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: DiagnosticRequest = await req.json();
    const { leadData, opportunityId: providedOpportunityId, answers, areaScores, totalScore, classification } = body;

    console.log("[save-diagnostic] Received request:", {
      leadEmail: leadData?.email,
      leadName: leadData?.nome,
      leadCompany: leadData?.empresa,
      providedOpportunityId,
      totalScore,
      classification,
      answersCount: answers?.length,
    });

    // Validate required data
    if (!leadData?.email || !leadData?.nome) {
      console.error("[save-diagnostic] Missing required lead data");
      return new Response(
        JSON.stringify({ error: "Missing required lead data (email or nome)" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Find the humanoid organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", "humanoid")
      .single();

    if (orgError || !org) {
      console.error("[save-diagnostic] Organization not found:", orgError);
      throw new Error("Organization humanoid not found");
    }

    console.log("[save-diagnostic] Found organization:", org.id);

    let opportunityId: string | null = providedOpportunityId || null;
    let contactId: string | null = null;

    // If opportunityId was not provided, try to find it by email
    if (!opportunityId) {
      console.log("[save-diagnostic] No opportunityId provided, searching by email...");
      
      // Find contact by email
      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .select("id")
        .eq("organization_id", org.id)
        .contains("emails", [leadData.email])
        .single();

      if (contactError) {
        console.log("[save-diagnostic] Contact search error:", contactError.message);
      }

      if (contact) {
        contactId = contact.id;
        console.log("[save-diagnostic] Found contact:", contactId);
        
        // Find opportunity linked to this contact
        const { data: opp, error: oppError } = await supabase
          .from("opportunities")
          .select("id")
          .eq("contact_id", contact.id)
          .eq("organization_id", org.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (oppError) {
          console.log("[save-diagnostic] Opportunity search error:", oppError.message);
        }

        opportunityId = opp?.id || null;
        console.log("[save-diagnostic] Found opportunity:", opportunityId);
      } else {
        console.log("[save-diagnostic] No contact found for email:", leadData.email);
      }
    } else {
      console.log("[save-diagnostic] Using provided opportunityId:", opportunityId);
      
      // Get contact_id from opportunity
      const { data: opp } = await supabase
        .from("opportunities")
        .select("contact_id")
        .eq("id", opportunityId)
        .single();
      
      contactId = opp?.contact_id || null;
    }

    // Save diagnostic result
    console.log("[save-diagnostic] Inserting diagnostic result...");
    const { data: diagnosticResult, error: insertError } = await supabase
      .from("diagnostic_results")
      .insert({
        opportunity_id: opportunityId,
        contact_id: contactId,
        organization_id: org.id,
        lead_name: leadData.nome,
        lead_email: leadData.email,
        lead_whatsapp: leadData.whatsapp,
        lead_company: leadData.empresa,
        answers: answers,
        area_scores: areaScores,
        total_score: totalScore,
        classification: classification,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[save-diagnostic] Error inserting diagnostic:", insertError);
      throw insertError;
    }

    console.log("[save-diagnostic] Diagnostic saved:", diagnosticResult.id);

    // Update opportunity with diagnostic score if found
    if (opportunityId) {
      console.log("[save-diagnostic] Updating opportunity with diagnostic score...");
      const { error: updateError } = await supabase
        .from("opportunities")
        .update({
          diagnostic_score: totalScore,
          diagnostic_classification: classification,
        })
        .eq("id", opportunityId);

      if (updateError) {
        console.error("[save-diagnostic] Error updating opportunity:", updateError);
      } else {
        console.log("[save-diagnostic] Opportunity updated with diagnostic score");
      }
    } else {
      console.log("[save-diagnostic] No opportunity to update");
    }

    return new Response(
      JSON.stringify({
        success: true,
        diagnosticId: diagnosticResult.id,
        opportunityId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("[save-diagnostic] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
