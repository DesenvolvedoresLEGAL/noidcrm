// Edge Function: index-email-knowledge
// Indexa emails históricos (manual/agent) gerando embeddings via Lovable AI Gateway
// Modes: backfill (todos), incremental (últimas 24h), single (um email específico)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

interface EmailRow {
  id: string;
  organization_id: string;
  opportunity_id: string | null;
  subject: string | null;
  body: string;
  sent_at: string;
  source_table: "opportunity_emails" | "ai_email_messages";
  pipeline_stage?: string | null;
  opportunity_status?: string | null;
  segmento?: string | null;
}

function stripHtml(html: string): string {
  return (html || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function generateEmbedding(text: string): Promise<number[]> {
  const truncated = text.slice(0, 8000);
  const res = await fetch(
    "https://ai.gateway.lovable.dev/v1/embeddings",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: truncated,
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Embedding API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.data[0].embedding as number[];
}

function calcInitialQuality(opportunityStatus: string | null | undefined): number {
  if (opportunityStatus === "won") return 0.85;
  if (opportunityStatus === "lost") return 0.25;
  return 0.5;
}

async function indexEmail(
  supabase: ReturnType<typeof createClient>,
  email: EmailRow,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const cleanBody = stripHtml(email.body || "");
  if (!cleanBody || cleanBody.length < 30) {
    return { ok: true, skipped: true };
  }

  // Dedup check
  const { data: existing } = await supabase
    .from("ai_email_knowledge_base")
    .select("id")
    .eq("organization_id", email.organization_id)
    .eq("source_table", email.source_table)
    .eq("source_id", email.id)
    .maybeSingle();

  if (existing) return { ok: true, skipped: true };

  const inputText = `${email.subject || ""}\n\n${cleanBody}`;

  let embedding: number[];
  try {
    embedding = await generateEmbedding(inputText);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const sourceType =
    email.source_table === "ai_email_messages" ? "agent_email" : "manual_email";

  const metadata: Record<string, unknown> = {
    pipeline_stage: email.pipeline_stage || null,
    opportunity_outcome: email.opportunity_status || null,
    segmento: email.segmento || null,
    sent_at: email.sent_at,
  };

  const quality = calcInitialQuality(email.opportunity_status);

  const { error: insertError } = await supabase
    .from("ai_email_knowledge_base")
    .insert({
      organization_id: email.organization_id,
      source_type: sourceType,
      source_id: email.id,
      source_table: email.source_table,
      opportunity_id: email.opportunity_id,
      subject: email.subject,
      body_text: cleanBody.slice(0, 12000),
      embedding: embedding as unknown as string, // pgvector accepts JSON array
      metadata,
      quality_score: quality,
    });

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const mode = (body.mode as string) || "incremental";
    const organizationId = body.organization_id as string | undefined;
    const sinceHours = (body.since_hours as number) || 24;
    const limit = (body.limit as number) || 200;

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "organization_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const sinceIso = new Date(
      Date.now() - sinceHours * 60 * 60 * 1000,
    ).toISOString();

    // Fetch manual emails (opportunity_emails outbound)
    let manualQuery = supabase
      .from("opportunity_emails")
      .select("id, organization_id, opportunity_id, subject, body, sent_at")
      .eq("organization_id", organizationId)
      .eq("direction", "outbound")
      .order("sent_at", { ascending: false })
      .limit(limit);

    if (mode === "incremental") {
      manualQuery = manualQuery.gte("sent_at", sinceIso);
    }

    const { data: manualEmails, error: manualErr } = await manualQuery;
    if (manualErr) throw manualErr;

    // Fetch agent emails (ai_email_messages sent)
    let agentQuery = supabase
      .from("ai_email_messages")
      .select("id, organization_id, opportunity_id, subject, body_html, body_text, sent_at")
      .eq("organization_id", organizationId)
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(limit);

    if (mode === "incremental") {
      agentQuery = agentQuery.gte("sent_at", sinceIso);
    }

    const { data: agentEmails, error: agentErr } = await agentQuery;
    if (agentErr) throw agentErr;

    // Collect opportunity_ids to fetch context in one shot
    const oppIds = Array.from(
      new Set(
        [
          ...(manualEmails || []).map((e: any) => e.opportunity_id),
          ...(agentEmails || []).map((e: any) => e.opportunity_id),
        ].filter(Boolean),
      ),
    );

    let oppContext: Record<string, { status: string | null; stage: string | null; segmento: string | null }> = {};
    if (oppIds.length > 0) {
      const { data: opps } = await supabase
        .from("opportunities")
        .select("id, status, stage_id, account_id")
        .in("id", oppIds);

      const stageIds = Array.from(new Set((opps || []).map((o: any) => o.stage_id).filter(Boolean)));
      const accountIds = Array.from(new Set((opps || []).map((o: any) => o.account_id).filter(Boolean)));

      const [{ data: stages }, { data: accounts }] = await Promise.all([
        stageIds.length
          ? supabase.from("pipeline_stages").select("id, name").in("id", stageIds)
          : Promise.resolve({ data: [] as any[] }),
        accountIds.length
          ? supabase.from("accounts").select("id, segmento").in("id", accountIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const stageMap = new Map((stages || []).map((s: any) => [s.id, s.name]));
      const accountMap = new Map((accounts || []).map((a: any) => [a.id, a.segmento]));

      for (const o of opps || []) {
        oppContext[o.id] = {
          status: o.status || null,
          stage: o.stage_id ? stageMap.get(o.stage_id) || null : null,
          segmento: o.account_id ? accountMap.get(o.account_id) || null : null,
        };
      }
    }

    // Normalize
    const allEmails: EmailRow[] = [
      ...(manualEmails || []).map((e: any) => {
        const ctx = e.opportunity_id ? oppContext[e.opportunity_id] : null;
        return {
          id: e.id,
          organization_id: e.organization_id,
          opportunity_id: e.opportunity_id,
          subject: e.subject,
          body: e.body,
          sent_at: e.sent_at,
          source_table: "opportunity_emails" as const,
          pipeline_stage: ctx?.stage || null,
          opportunity_status: ctx?.status || null,
          segmento: ctx?.segmento || null,
        };
      }),
      ...(agentEmails || []).map((e: any) => {
        const ctx = e.opportunity_id ? oppContext[e.opportunity_id] : null;
        return {
          id: e.id,
          organization_id: e.organization_id,
          opportunity_id: e.opportunity_id,
          subject: e.subject,
          body: e.body_html || e.body_text || "",
          sent_at: e.sent_at,
          source_table: "ai_email_messages" as const,
          pipeline_stage: ctx?.stage || null,
          opportunity_status: ctx?.status || null,
          segmento: ctx?.segmento || null,
        };
      }),
    ];

    let indexed = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process sequentially with small delay to respect rate limits
    for (const email of allEmails) {
      const result = await indexEmail(supabase, email);
      if (result.skipped) skipped++;
      else if (result.ok) indexed++;
      else {
        failed++;
        if (errors.length < 5) errors.push(result.error || "unknown");
      }
      // small delay to avoid burst
      await new Promise((r) => setTimeout(r, 50));
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        total_candidates: allEmails.length,
        indexed,
        skipped,
        failed,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[index-email-knowledge] error", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
