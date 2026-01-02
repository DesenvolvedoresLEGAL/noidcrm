import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduleDemoRequest {
  participantName: string;
  participantEmail: string;
  participantWhatsapp?: string;
  participantCompany?: string;
  scheduledDatetime: string;
  durationMinutes?: number;
  demoType?: string;
  source?: string;
  diagnosticScore?: number;
  diagnosticClassification?: string;
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

    const body: ScheduleDemoRequest = await req.json();
    const {
      participantName,
      participantEmail,
      participantWhatsapp,
      participantCompany,
      scheduledDatetime,
      durationMinutes = 30,
      demoType = "general",
      source = "landing",
      diagnosticScore,
      diagnosticClassification,
    } = body;

    console.log("Scheduling demo for:", participantEmail);

    // Find the humanoid organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", "humanoid")
      .single();

    if (orgError || !org) {
      throw new Error("Organization humanoid not found");
    }

    // Find existing opportunity by email
    let opportunityId: string | null = null;
    let diagnosticResultId: string | null = null;

    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", org.id)
      .contains("emails", [participantEmail])
      .single();

    if (contact) {
      const { data: opp } = await supabase
        .from("opportunities")
        .select("id")
        .eq("contact_id", contact.id)
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      opportunityId = opp?.id || null;

      // Find diagnostic result if exists
      if (opportunityId) {
        const { data: diagnostic } = await supabase
          .from("diagnostic_results")
          .select("id")
          .eq("opportunity_id", opportunityId)
          .limit(1)
          .single();

        diagnosticResultId = diagnostic?.id || null;
      }
    }

    // Create scheduled demo
    const { data: demo, error: insertError } = await supabase
      .from("scheduled_demos")
      .insert({
        organization_id: org.id,
        opportunity_id: opportunityId,
        participant_name: participantName,
        participant_email: participantEmail,
        participant_whatsapp: participantWhatsapp,
        participant_company: participantCompany,
        scheduled_datetime: scheduledDatetime,
        duration_minutes: durationMinutes,
        demo_type: demoType,
        source: source,
        diagnostic_result_id: diagnosticResultId,
        status: "scheduled",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error scheduling demo:", insertError);
      throw insertError;
    }

    console.log("Demo scheduled:", demo.id);

    return new Response(
      JSON.stringify({
        success: true,
        demoId: demo.id,
        scheduledDatetime,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Error in schedule-demo:", error);
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
