// Edge Function: search-email-knowledge
// RAG Fase 2: gera embedding da query e busca e-mails semanticamente similares.
// Body: { query: string, organization_id: uuid, match_count?: int, match_threshold?: float,
//         pipeline_stage?: string, outcome?: 'won'|'lost', min_quality?: float }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

async function generateEmbedding(text: string): Promise<number[]> {
  const truncated = text.slice(0, 8000);
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: truncated,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI Embedding API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.data[0].embedding as number[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const query = (body.query as string)?.trim();
    const organizationId = body.organization_id as string | undefined;
    const matchCount = Math.min(Math.max(Number(body.match_count) || 5, 1), 20);
    const matchThreshold = Math.min(
      Math.max(Number(body.match_threshold) || 0.7, 0),
      1,
    );
    const pipelineStage = (body.pipeline_stage as string | undefined) || null;
    const outcome = (body.outcome as string | undefined) || null;
    const minQuality = Math.min(Math.max(Number(body.min_quality) || 0, 0), 1);

    if (!query || query.length < 5) {
      return new Response(
        JSON.stringify({ error: "query must be at least 5 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "organization_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Use service-role client but pass user JWT so SECURITY DEFINER auth.uid() works
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // 1) Generate embedding for the query
    const embedding = await generateEmbedding(query);

    // 2) Call SQL function for similarity search
    const { data: matches, error } = await supabase.rpc(
      "match_email_knowledge",
      {
        query_embedding: embedding as unknown as string,
        p_organization_id: organizationId,
        match_threshold: matchThreshold,
        match_count: matchCount,
        filter_pipeline_stage: pipelineStage,
        filter_outcome: outcome,
        min_quality: minQuality,
      },
    );

    if (error) {
      console.error("[search-email-knowledge] rpc error", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3) Increment usage counter (fire-and-forget)
    const ids = (matches || []).map((m: any) => m.id);
    if (ids.length > 0) {
      supabase
        .rpc("increment_email_knowledge_usage", { knowledge_ids: ids })
        .then(({ error: e }) => {
          if (e) console.warn("[search-email-knowledge] usage increment failed", e);
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        query,
        count: matches?.length || 0,
        matches: matches || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[search-email-knowledge] error", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
