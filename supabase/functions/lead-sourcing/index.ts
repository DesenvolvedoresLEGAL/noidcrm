import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { organization_id, playbook_type, icp_profile_id, input_payload, import_rules } = body;

    // Backward compat: support old format
    const searchType = playbook_type || body.search_type;
    const config = input_payload || body.config || {};
    const icpId = icp_profile_id || body.icp_id || null;
    const scoreThreshold = import_rules?.scoreThreshold ?? config.min_score ?? 50;

    if (!organization_id || !searchType) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user } } = await anonClient.auth.getUser(token);
      userId = user?.id || null;
    }

    // Get ICP details
    let icpContext = "";
    if (icpId) {
      const { data: icp } = await supabase
        .from("icp_profiles")
        .select("*")
        .eq("id", icpId)
        .single();
      if (icp) {
        icpContext = `
ICP Profile:
- Name: ${icp.name}
- Segment: ${icp.segment}
- Company Size: ${icp.company_size || "any"}
- Revenue Band: ${icp.revenue_band || "any"}
- Pain Points: ${(icp.pain_points || []).join(", ")}
- Buying Triggers: ${(icp.buying_triggers || []).join(", ")}
- Industries: ${JSON.stringify(icp.industries || [])}
- Geo Targets: ${JSON.stringify(icp.geo_targets || [])}`;
      }
    }

    // Build search context
    let searchContext = "";
    switch (searchType) {
      case "event":
        searchContext = `Search for companies that would be exhibitors or attendees at: ${config.event_name || "unknown event"} (${config.event_url || ""})`;
        break;
      case "directory":
        searchContext = `Search for companies from directory: ${config.directory_source || "general"}`;
        break;
      case "geo":
        searchContext = `Search for companies in: ${config.segment || "any"} segment, located in ${config.city || "any city"}, ${config.state || "any state"}, Brazil`;
        break;
      case "seed":
        searchContext = `Find companies similar to: ${config.seed_company || "unknown"}`;
        break;
      case "import":
      case "manual_import":
        searchContext = `Analyze and score these companies: ${config.import_list || ""}`;
        break;
    }

    // Create playbook_run
    const { data: run, error: runError } = await supabase
      .from("playbook_runs")
      .insert({
        organization_id,
        triggered_by: userId,
        icp_profile_id: icpId,
        status: "running",
        input_payload: { playbookType: searchType, ...config, importRules: import_rules },
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError) throw runError;

    // Also create a lead_source record
    const { data: source } = await supabase
      .from("lead_sources")
      .insert({
        organization_id,
        playbook_run_id: run.id,
        source_type: searchType,
        source_label: config.event_name || config.directory_source || config.seed_company || searchType,
        source_url: config.event_url || null,
        source_metadata: config,
      })
      .select()
      .single();

    // Call AI to generate leads
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a B2B lead generation expert for the Brazilian market. Generate realistic and relevant company leads based on the search criteria and ICP profile provided.

For each lead, provide:
- company_name: a realistic Brazilian company name
- website: company website (if plausible)
- industry: industry/segment
- city: city in Brazil
- state: state abbreviation (SP, RJ, MG, etc.)
- summary: a compelling 1-2 sentence explanation in Portuguese of WHY this is a good lead
- icp_fit_score: 0-100 how well it matches the ICP
- signal_score: 0-100 based on buying signals
- data_quality_score: 0-100 based on data completeness
- source_trust_score: 0-100 based on source reliability
- grade: A, B, C, or D overall grade
- reasoning_summary: 1-2 sentences in Portuguese explaining the score

Return ONLY leads with combined score >= ${scoreThreshold}. Generate 8-15 leads.`,
          },
          {
            role: "user",
            content: `${searchContext}\n\n${icpContext}\n\nGenerate relevant B2B leads for this search.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_leads",
              description: "Generate a list of scored B2B leads",
              parameters: {
                type: "object",
                properties: {
                  leads: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        company_name: { type: "string" },
                        website: { type: "string" },
                        industry: { type: "string" },
                        city: { type: "string" },
                        state: { type: "string" },
                        summary: { type: "string" },
                        icp_fit_score: { type: "number" },
                        signal_score: { type: "number" },
                        data_quality_score: { type: "number" },
                        source_trust_score: { type: "number" },
                        grade: { type: "string" },
                        reasoning_summary: { type: "string" },
                      },
                      required: ["company_name", "icp_fit_score", "summary", "grade"],
                    },
                  },
                },
                required: ["leads"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_leads" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      await supabase.from("playbook_runs").update({
        status: "failed",
        finished_at: new Date().toISOString(),
        execution_log: [{ step: "ai_call", error: errText, at: new Date().toISOString() }],
      }).eq("id", run.id);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let leads: any[] = [];

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      leads = parsed.leads || [];
    }

    // Insert prospects + scores
    let prospectsInserted = 0;
    for (const lead of leads) {
      const normalizedName = (lead.company_name || "").toLowerCase().trim().replace(/\s+/g, " ");
      const normalizedDomain = (lead.website || "").replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();

      const { data: prospect, error: prospectError } = await supabase
        .from("prospects")
        .insert({
          organization_id,
          playbook_run_id: run.id,
          icp_profile_id: icpId,
          source_id: source?.id || null,
          company_name: lead.company_name,
          normalized_company_name: normalizedName,
          website: lead.website || null,
          normalized_domain: normalizedDomain || null,
          industry: lead.industry || null,
          city: lead.city || null,
          state: lead.state || null,
          summary: lead.summary || null,
          status: "review_pending",
          confidence: lead.icp_fit_score || null,
          raw_data: lead,
        })
        .select()
        .single();

      if (prospectError) {
        console.error("Insert prospect error:", prospectError);
        continue;
      }

      prospectsInserted++;

      // Insert score
      const icpFit = Math.min(100, Math.max(0, lead.icp_fit_score || 0));
      const signalScore = Math.min(100, Math.max(0, lead.signal_score || 0));
      const dataQuality = Math.min(100, Math.max(0, lead.data_quality_score || 50));
      const sourceTrust = Math.min(100, Math.max(0, lead.source_trust_score || 50));

      await supabase.from("prospect_scores").insert({
        organization_id,
        prospect_id: prospect.id,
        icp_fit_score: icpFit,
        signal_score: signalScore,
        data_quality_score: dataQuality,
        source_trust_score: sourceTrust,
        penalty_score: 0,
        reasoning: {
          summary: lead.reasoning_summary || lead.summary || "",
          reason: lead.summary || "",
        },
        grade: lead.grade || "C",
      });
    }

    // Update run stats
    await supabase.from("playbook_runs").update({
      status: "completed",
      finished_at: new Date().toISOString(),
      stats: { prospects_count: prospectsInserted, approved_count: 0 },
      execution_log: [
        { step: "ai_call", leads_generated: leads.length, at: new Date().toISOString() },
        { step: "prospects_saved", count: prospectsInserted, at: new Date().toISOString() },
      ],
    }).eq("id", run.id);

    return new Response(
      JSON.stringify({ run_id: run.id, prospects_count: prospectsInserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("lead-sourcing error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
