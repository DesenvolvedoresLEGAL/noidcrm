import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { organization_id, search_type, icp_id, config } = await req.json();
    if (!organization_id || !search_type) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user } } = await anonClient.auth.getUser(token);
      userId = user?.id || null;
    }

    // Get ICP details if provided
    let icpContext = "";
    if (icp_id) {
      const { data: icp } = await supabase
        .from("icp_profiles")
        .select("*")
        .eq("id", icp_id)
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
- Success Criteria: ${(icp.success_criteria || []).join(", ")}
- Competing Alternatives: ${(icp.competing_alternatives || []).join(", ")}`;
      }
    }

    // Build search context
    let searchContext = "";
    switch (search_type) {
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
        searchContext = `Analyze and score these companies: ${config.import_list || ""}`;
        break;
    }

    // Create the search record
    const { data: search, error: searchError } = await supabase
      .from("lead_searches")
      .insert({
        organization_id,
        user_id: userId || "00000000-0000-0000-0000-000000000000",
        search_type,
        icp_id: icp_id || null,
        config,
        status: "running",
      })
      .select()
      .single();

    if (searchError) throw searchError;

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
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a B2B lead generation expert for the Brazilian market. Generate realistic and relevant company leads based on the search criteria and ICP profile provided. 

For each lead, provide:
- company_name: a realistic Brazilian company name
- origin: where this lead was sourced from
- city: city in Brazil
- state: state abbreviation (SP, RJ, MG, etc.)
- score: 0-100 based on ICP fit
- signals: object with key signals (e.g. {"segment_match": true, "size_fit": true, "growth_signal": "Series B"})
- reason: a compelling 1-2 sentence explanation in Portuguese of WHY this is a good lead for the seller

Return ONLY a JSON array of 8-15 leads. Only return leads with score >= ${config.min_score || 50}.`,
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
              description: "Generate a list of B2B leads",
              parameters: {
                type: "object",
                properties: {
                  leads: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        company_name: { type: "string" },
                        origin: { type: "string" },
                        city: { type: "string" },
                        state: { type: "string" },
                        score: { type: "number" },
                        signals: { type: "object" },
                        reason: { type: "string" },
                      },
                      required: ["company_name", "score", "reason"],
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

      // Update search status to failed
      await supabase.from("lead_searches").update({ status: "failed" }).eq("id", search.id);

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

    // Extract from tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      leads = parsed.leads || [];
    }

    // Insert results
    if (leads.length > 0) {
      const results = leads.map((lead: any) => ({
        search_id: search.id,
        organization_id,
        company_name: lead.company_name,
        origin: lead.origin || search_type,
        city: lead.city || null,
        state: lead.state || null,
        score: Math.min(100, Math.max(0, lead.score || 0)),
        signals: lead.signals || {},
        reason: lead.reason || null,
        status: "pending",
      }));

      const { error: insertError } = await supabase
        .from("lead_search_results")
        .insert(results);

      if (insertError) {
        console.error("Insert results error:", insertError);
      }
    }

    // Update search record
    await supabase
      .from("lead_searches")
      .update({
        status: "completed",
        results_count: leads.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", search.id);

    return new Response(
      JSON.stringify({ search_id: search.id, results_count: leads.length }),
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
