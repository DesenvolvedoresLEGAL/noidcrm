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
    const { leadData, answers, areaScores, totalScore, classification } = body;

    console.log("Saving diagnostic for:", leadData.email);

    // Find the humanoid organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", "humanoid")
      .single();

    if (orgError || !org) {
      console.error("Organization not found:", orgError);
      throw new Error("Organization humanoid not found");
    }

    // Find the opportunity by contact email
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", org.id)
      .contains("emails", [leadData.email])
      .single();

    let opportunityId: string | null = null;
    let contactId: string | null = contact?.id || null;

    if (contact) {
      // Find opportunity linked to this contact
      const { data: opp } = await supabase
        .from("opportunities")
        .select("id")
        .eq("contact_id", contact.id)
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      opportunityId = opp?.id || null;
    }

    // Save diagnostic result
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
      console.error("Error inserting diagnostic:", insertError);
      throw insertError;
    }

    console.log("Diagnostic saved:", diagnosticResult.id);

    // Update opportunity with diagnostic score if found
    if (opportunityId) {
      const { error: updateError } = await supabase
        .from("opportunities")
        .update({
          diagnostic_score: totalScore,
          diagnostic_classification: classification,
        })
        .eq("id", opportunityId);

      if (updateError) {
        console.error("Error updating opportunity:", updateError);
      } else {
        console.log("Opportunity updated with diagnostic score");
      }
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
    console.error("Error in save-diagnostic:", error);
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
