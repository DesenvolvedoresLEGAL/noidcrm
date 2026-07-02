// KAI.19 — Company Intelligence Engine
// Computes deterministic company score (0-100) + grade, with optional AI
// hypotheses/signals/strategy. Never invents facts.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { callAI } from "../_shared/ai-client.ts";

const PROMPT_VERSION = "company_intelligence.v1.0";

type Grade = "A+" | "A" | "B" | "C" | "D" | "F";

function toGrade(score: number): Grade {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

async function computeAiInsights(payload: Record<string, unknown>) {
  try {
    const { content } = await callAI({
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      feature: "company_intelligence",
      messages: [
        {
          role: "system",
          content:
            "Você é o Company Intelligence Engine do NOID. Gere apenas hipóteses, sinais e recomendações a partir das evidências fornecidas. Nunca invente fatos. Se faltar informação, marque como missing. Retorne apenas JSON válido no schema pedido.",
        },
        {
          role: "user",
          content: `Contexto (JSON):\n${JSON.stringify(payload).slice(0, 12000)}\n\nRetorne JSON no schema:\n{\n  \"buying_signals\":[{\"signal\":\"\",\"type\":\"event_participation|growth|tech_need|operational_risk|relationship|hiring|expansion|unknown\",\"confidence\":0,\"evidence\":\"\"}],\n  \"risk_signals\":[{\"risk\":\"\",\"severity\":\"low|medium|high\",\"evidence\":\"\"}],\n  \"opportunity_hypotheses\":[{\"hypothesis\":\"\",\"commercial_angle\":\"\",\"confidence\":0}],\n  \"recommended_strategy\":\"\",\n  \"next_best_action\":\"reveal_phone|find_decision_maker|generate_brief|send_to_sdr|monitor|discard|human_review\",\n  \"missing_fields\":[]\n}`,
        },
      ],
    });
    return JSON.parse(content);
  } catch (err) {
    console.error("[company-intelligence] AI insights failed", err);
    return {
      buying_signals: [],
      risk_signals: [],
      opportunity_hypotheses: [],
      recommended_strategy: "",
      next_best_action: "monitor",
      missing_fields: [],
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { prospect_id, force_recompute = false } = await req.json();
    if (!prospect_id) {
      return new Response(JSON.stringify({ error: "prospect_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Existing snapshot?
    if (!force_recompute) {
      const { data: existing } = await supabase
        .from("kairos_company_intelligence")
        .select("*")
        .eq("prospect_id", prospect_id)
        .maybeSingle();
      if (existing && Date.now() - new Date(existing.updated_at).getTime() < 6 * 3600 * 1000) {
        return new Response(JSON.stringify({ success: true, cached: true, ...existing }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Load prospect
    const { data: prospect, error: prospectErr } = await supabase
      .from("prospects")
      .select("*")
      .eq("id", prospect_id)
      .maybeSingle();
    if (prospectErr || !prospect) {
      return new Response(JSON.stringify({ error: "prospect not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organization_id = prospect.organization_id;
    const domain = prospect.domain ?? null;
    const company_name = prospect.company_name ?? prospect.name ?? "Unknown";

    // Parallel context
    const [coverageRes, enrichRes, queueRes, apolloRes] = await Promise.all([
      supabase
        .from("kairos_coverage_analysis")
        .select("*")
        .eq("prospect_id", prospect_id)
        .maybeSingle(),
      supabase
        .from("enriched_company_profiles")
        .select("*")
        .eq("prospect_id", prospect_id)
        .maybeSingle(),
      supabase
        .from("kairos_qualified_queue")
        .select("*")
        .eq("prospect_id", prospect_id)
        .maybeSingle(),
      supabase
        .from("enriched_contact_profiles")
        .select("id, phone_confidence, phone_match_quality, is_primary")
        .eq("prospect_id", prospect_id),
    ]);

    const coverage = coverageRes.data as any;
    const enrich = enrichRes.data as any;
    const queue = queueRes.data as any;
    const contacts = (apolloRes.data ?? []) as any[];

    // Deterministic sub-scores
    const relationshipMap: Record<string, number> = {
      customer: 10,
      opportunity_existing: 8,
      account_existing: 6,
      new_prospect: 3,
    };
    const coverage_score = clamp(((coverage?.coverage_score ?? 0) / 100) * 10, 0, 10);
    const relationship_score = clamp(
      relationshipMap[(queue?.relationship_status ?? prospect.relationship_status ?? "") as string] ?? 3,
      0,
      10,
    );

    // ICP fit — trust queue.icp_match + score bucket
    let fit_score = 8;
    if (queue?.icp_match) fit_score = 16;
    if ((queue?.score ?? 0) >= 80) fit_score = 20;
    else if ((queue?.score ?? 0) >= 60) fit_score = Math.max(fit_score, 14);

    // Market/segment (10) — from industry/segment presence
    const market_score = enrich?.industry ? 8 : enrich?.market_type ? 6 : 3;

    // Size (10)
    const sizeHint = (enrich?.company_size_estimate || enrich?.company_size || "").toString().toLowerCase();
    let size_score = 3;
    if (/(enterprise|grande|1000|500)/.test(sizeHint)) size_score = 10;
    else if (/(mid|média|medio|100|250)/.test(sizeHint)) size_score = 7;
    else if (/(small|pequen|10|50)/.test(sizeHint)) size_score = 4;

    // Digital presence (10)
    let digital_presence_score = 0;
    if (domain) digital_presence_score += 4;
    if (enrich?.linkedin_url) digital_presence_score += 3;
    if (enrich?.website_url || enrich?.company_summary) digital_presence_score += 3;
    digital_presence_score = clamp(digital_presence_score, 0, 10);

    // Event relevance (10)
    let event_relevance_score = 0;
    if (prospect.event_id || queue?.event_id) event_relevance_score = 7;
    if (prospect.source_type === "event") event_relevance_score = Math.max(event_relevance_score, 8);

    // Buying signals (15) — heuristic on enrichment json arrays
    const growth = Array.isArray(enrich?.growth_signals) ? enrich.growth_signals.length : 0;
    const pains = Array.isArray(enrich?.commercial_pains) ? enrich.commercial_pains.length : 0;
    const buying_signal_score = clamp(growth * 3 + pains * 2, 0, 15);

    // Urgency (part of buying signals bucket, kept separate for UI)
    const urgency_score = clamp(pains * 2, 0, 10);

    // Revenue potential (5)
    let revenue_potential_score = 2;
    if (size_score >= 7) revenue_potential_score = 5;
    else if (size_score >= 4) revenue_potential_score = 3;

    const totalScore = clamp(
      fit_score +
        market_score +
        size_score +
        digital_presence_score +
        event_relevance_score +
        relationship_score +
        coverage_score +
        buying_signal_score +
        revenue_potential_score,
      0,
      100,
    );
    const grade = toGrade(totalScore);

    // Confidence — how much evidence we had
    const evidencePresence = [
      !!enrich,
      !!coverage,
      !!domain,
      !!queue?.icp_match,
      contacts.length > 0,
    ].filter(Boolean).length;
    const confidence_score = clamp((evidencePresence / 5) * 100, 20, 100);

    // AI insights (non-scoring)
    const ai = await computeAiInsights({
      company_name,
      domain,
      relationship_status: queue?.relationship_status ?? prospect.relationship_status,
      coverage: coverage
        ? {
            score: coverage.coverage_score,
            class: coverage.coverage_class,
            missing: coverage.missing_items,
          }
        : null,
      enrichment: enrich
        ? {
            industry: enrich.industry,
            summary: enrich.company_summary,
            growth_signals: enrich.growth_signals,
            commercial_pains: enrich.commercial_pains,
            tech_signals: enrich.tech_signals,
            business_model: enrich.business_model,
            company_size: enrich.company_size_estimate,
          }
        : null,
      event: prospect.event_id ? { id: prospect.event_id, name: prospect.event_name } : null,
      contacts_count: contacts.length,
      has_actionable_phone: contacts.some(
        (c) => (c.phone_confidence ?? 0) >= 80 && ["person_mobile", "person_whatsapp", "person_direct"].includes(c.phone_match_quality),
      ),
    });

    // Recommendations
    const apollo_recommended =
      ["A+", "A", "B"].includes(grade) &&
      (queue?.relationship_status ?? "") !== "customer" &&
      (coverage?.coverage_score ?? 0) < 90;
    const sdr_recommended =
      ["A+", "A", "B"].includes(grade) &&
      (contacts.length > 0 || (coverage?.coverage_score ?? 0) >= 60);
    const human_review_required = confidence_score < 40 && ["A+", "A"].includes(grade);

    // Ensure next_best_action fallback aligned with rules
    let next_best_action = ai.next_best_action || "monitor";
    if (grade === "F" || grade === "D") next_best_action = "monitor";
    else if (!contacts.length && apollo_recommended) next_best_action = "find_decision_maker";
    else if (sdr_recommended) next_best_action = next_best_action === "monitor" ? "send_to_sdr" : next_best_action;

    const snapshot = {
      organization_id,
      prospect_id,
      account_id: (queue?.imported_account_id as string) ?? null,
      company_name,
      domain,
      cnpj: (prospect as any).cnpj ?? null,
      source_type: prospect.source_type ?? null,
      source_name: prospect.source_name ?? null,
      event_id: prospect.event_id ?? null,
      event_name: (prospect as any).event_name ?? null,

      company_intelligence_score: totalScore,
      company_grade: grade,

      fit_score,
      market_score,
      size_score,
      digital_presence_score,
      event_relevance_score,
      relationship_score,
      coverage_score,
      buying_signal_score,
      urgency_score,
      revenue_potential_score,

      company_size: enrich?.company_size_estimate ?? null,
      company_segment: enrich?.market_type ?? null,
      company_industry: enrich?.industry ?? null,
      company_region: Array.isArray(enrich?.geographic_presence) ? (enrich.geographic_presence as any[])[0] ?? null : null,
      business_model: enrich?.business_model ?? null,
      digital_maturity: enrich?.digital_maturity ?? null,
      event_participation_level: prospect.event_id ? "confirmed" : null,
      relationship_status: queue?.relationship_status ?? prospect.relationship_status ?? null,
      coverage_class: coverage?.coverage_class ?? null,

      buying_signals: ai.buying_signals ?? [],
      risk_signals: ai.risk_signals ?? [],
      opportunity_hypotheses: ai.opportunity_hypotheses ?? [],

      recommended_strategy: ai.recommended_strategy ?? null,
      next_best_action,
      apollo_recommended,
      sdr_recommended,
      human_review_required,

      confidence_score,
      missing_fields: ai.missing_fields ?? [],
      evidence: {
        has_enrichment: !!enrich,
        has_coverage: !!coverage,
        has_contacts: contacts.length > 0,
        queue_score: queue?.score ?? null,
        coverage_score: coverage?.coverage_score ?? null,
      },
      prompt_version: PROMPT_VERSION,
    };

    const { data: upserted, error: upsertErr } = await supabase
      .from("kairos_company_intelligence")
      .upsert(snapshot, { onConflict: "prospect_id" })
      .select("*")
      .single();
    if (upsertErr) throw upsertErr;

    // Sync queue
    await supabase
      .from("kairos_qualified_queue")
      .update({
        company_intelligence_score: totalScore,
        company_grade: grade,
        company_next_best_action: next_best_action,
        company_recommended_strategy: snapshot.recommended_strategy,
        apollo_recommended,
        sdr_recommended,
        company_human_review_required: human_review_required,
      })
      .eq("prospect_id", prospect_id);

    // Event
    await supabase.from("revenue_events").insert({
      organization_id,
      event_type: "company_intelligence_computed",
      entity_type: "prospect",
      entity_id: prospect_id,
      metadata: { score: totalScore, grade, apollo_recommended, sdr_recommended },
    });

    return new Response(
      JSON.stringify({
        success: true,
        prospect_id,
        company_intelligence_score: totalScore,
        company_grade: grade,
        recommended_strategy: snapshot.recommended_strategy,
        next_best_action,
        apollo_recommended,
        sdr_recommended,
        confidence_score,
        buying_signals: snapshot.buying_signals,
        risk_signals: snapshot.risk_signals,
        evidence: snapshot.evidence,
        snapshot: upserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[kairos-compute-company-intelligence] error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
