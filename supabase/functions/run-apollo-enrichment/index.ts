// Apollo decision-maker enrichment for prospects (Sprint E.1 - Kairós)
// Triple-guard: quality_label='high_confidence' + priority_score>=180 + !decision_maker_found + max 1 call/prospect.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APOLLO_URL = "https://api.apollo.io/api/v1/mixed_people/search";
const RELEVANT_TITLES = [
  "ceo", "founder", "co-founder", "cofounder",
  "head", "director", "vp", "vice president",
  "marketing", "sales", "growth", "events", "manager",
  "diretor", "diretora", "presidente", "fundador", "fundadora",
];

interface Prospect {
  id: string;
  organization_id: string;
  website?: string | null;
  normalized_domain?: string | null;
  decision_maker_found?: boolean | null;
}

function pickDomain(p: Prospect): string | null {
  if (p.normalized_domain) return p.normalized_domain;
  if (!p.website) return null;
  try {
    const u = new URL(p.website.startsWith("http") ? p.website : `https://${p.website}`);
    return u.hostname.replace(/^www\./, "");
  } catch { return null; }
}

function isRelevantTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  return RELEVANT_TITLES.some((kw) => t.includes(kw));
}

function seniorityBonus(title: string | null | undefined): number {
  if (!title) return 0;
  const t = title.toLowerCase();
  if (/(ceo|founder|co-?founder|presidente|fundador)/i.test(t)) return 30;
  if (/(vp|vice president|head|director|diretor)/i.test(t)) return 20;
  if (/manager|gerente|coordenador/i.test(t)) return 10;
  return 0;
}

function computeContactScore(person: any): number {
  let s = 0;
  if (person.email) s += 30;
  if (person.email_status === "verified") s += 20;
  if (person.linkedin_url) s += 15;
  if (person.phone_numbers?.length || person.organization?.phone) s += 15;
  s += seniorityBonus(person.title);
  return Math.min(100, s);
}

function detectSeniority(title: string | null | undefined): string | null {
  if (!title) return null;
  const t = title.toLowerCase();
  if (/(ceo|founder|presidente)/.test(t)) return "c_level";
  if (/(vp|vice president)/.test(t)) return "vp";
  if (/(head|director|diretor)/.test(t)) return "director";
  if (/(manager|gerente|coordenador)/.test(t)) return "manager";
  return "ic";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!APOLLO_API_KEY) {
      return new Response(JSON.stringify({ error: "APOLLO_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prospect_id } = await req.json().catch(() => ({}));
    if (!prospect_id) {
      return new Response(JSON.stringify({ error: "prospect_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // 1. Load prospect
    const { data: prospect, error: pErr } = await sb
      .from("prospects")
      .select("id, organization_id, website, normalized_domain, decision_maker_found, company_name")
      .eq("id", prospect_id)
      .maybeSingle();
    if (pErr || !prospect) {
      return new Response(JSON.stringify({ error: "prospect not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Triple-guard
    const { data: lastRun } = await sb
      .from("enrichment_runs")
      .select("quality_label")
      .eq("prospect_id", prospect_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: score } = await sb
      .from("prospect_scores")
      .select("priority_score")
      .eq("prospect_id", prospect_id)
      .maybeSingle();

    const qLabel = (lastRun as any)?.quality_label ?? null;
    const pScore = Number((score as any)?.priority_score ?? 0);

    const skip = (reason: string) => {
      sb.from("enrichment_jobs").insert({
        workspace_id: prospect.organization_id,
        prospect_id, provider: "apollo", status: "skipped", error: reason,
        completed_at: new Date().toISOString(),
      }).then(() => {});
      sb.from("prospects").update({ enrichment_status: "skipped" }).eq("id", prospect_id).then(() => {});
      return new Response(JSON.stringify({ status: "skipped", reason }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    };

    if (qLabel !== "high_confidence") return skip(`quality_label=${qLabel}, requires high_confidence`);
    if (pScore < 180) return skip(`priority_score=${pScore} < 180`);
    if (prospect.decision_maker_found) return skip("decision_maker_found already true");

    // dedupe: max 1 done/running call
    const { data: existing } = await sb
      .from("enrichment_jobs")
      .select("id, status")
      .eq("prospect_id", prospect_id)
      .eq("provider", "apollo")
      .in("status", ["done", "running"]);
    if (existing && existing.length > 0) return skip("apollo job already exists");

    const domain = pickDomain(prospect as Prospect);
    if (!domain) return skip("no domain available");

    // 3. Create running job
    const { data: jobRow } = await sb.from("enrichment_jobs").insert({
      workspace_id: prospect.organization_id,
      prospect_id, provider: "apollo", status: "running",
      request: { domain, person_titles: RELEVANT_TITLES },
    }).select("id").single();

    // 4. Call Apollo
    let apolloResp: any = null;
    let credits_used = 0;
    try {
      const r = await fetch(APOLLO_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "x-api-key": APOLLO_API_KEY,
        },
        body: JSON.stringify({
          q_organization_domains: domain,
          person_titles: ["CEO", "Founder", "Co-Founder", "Head", "Director", "VP", "Manager", "Marketing", "Sales", "Growth"],
          page: 1,
          per_page: 10,
        }),
      });
      apolloResp = await r.json();
      credits_used = 1;
      if (!r.ok) {
        await sb.from("enrichment_jobs").update({
          status: "failed",
          error: `Apollo HTTP ${r.status}: ${JSON.stringify(apolloResp).slice(0, 500)}`,
          response: apolloResp, credits_used,
          completed_at: new Date().toISOString(),
        }).eq("id", jobRow!.id);
        await sb.from("prospects").update({ enrichment_status: "failed" }).eq("id", prospect_id);
        return new Response(JSON.stringify({ error: "apollo failed", details: apolloResp }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (e) {
      await sb.from("enrichment_jobs").update({
        status: "failed", error: String(e), credits_used,
        completed_at: new Date().toISOString(),
      }).eq("id", jobRow!.id);
      await sb.from("prospects").update({ enrichment_status: "failed" }).eq("id", prospect_id);
      throw e;
    }

    const people: any[] = apolloResp?.people ?? [];
    const filtered = people.filter((p) => isRelevantTitle(p.title));

    let inserted = 0;
    let decisionMakers = 0;
    let maxScore = 0;
    let topProfileId: string | null = null;

    for (const person of filtered) {
      const cScore = computeContactScore(person);
      const seniority = detectSeniority(person.title);
      const isDM = seniority === "c_level" || seniority === "vp" || seniority === "director";
      if (isDM) decisionMakers += 1;

      const payload = {
        workspace_id: prospect.organization_id,
        prospect_id,
        full_name: person.name ?? [person.first_name, person.last_name].filter(Boolean).join(" "),
        first_name: person.first_name ?? null,
        last_name: person.last_name ?? null,
        role_title: person.title ?? null,
        seniority,
        department: person.departments?.[0] ?? null,
        email: person.email ?? null,
        email_status: person.email_status ?? null,
        phone: person.phone_numbers?.[0]?.sanitized_number ?? person.organization?.phone ?? null,
        linkedin_url: person.linkedin_url ?? null,
        provider: "apollo",
        confidence_score: cScore,
        apollo_person_id: person.id ?? null,
        raw: person,
      };

      // Anti-duplication via unique idx (prospect_id, lower(email))
      const { data: ins, error: insErr } = await sb
        .from("enriched_contact_profiles")
        .insert(payload)
        .select("id")
        .maybeSingle();

      if (!insErr && ins) {
        inserted += 1;
        if (cScore > maxScore) {
          maxScore = cScore;
          topProfileId = ins.id;
        }
      }
    }

    // Mark top as primary
    if (topProfileId) {
      await sb.from("enriched_contact_profiles")
        .update({ is_primary: false })
        .eq("prospect_id", prospect_id)
        .neq("id", topProfileId);
      await sb.from("enriched_contact_profiles")
        .update({ is_primary: true })
        .eq("id", topProfileId);
    }

    // Update prospect
    const finalStatus = inserted === 0 ? "partial" : "done";
    await sb.from("prospects").update({
      enrichment_status: finalStatus,
      contact_score: maxScore || null,
      decision_maker_found: decisionMakers > 0,
      apollo_enriched_at: new Date().toISOString(),
    }).eq("id", prospect_id);

    // Close job
    await sb.from("enrichment_jobs").update({
      status: finalStatus === "done" ? "done" : "done",
      credits_used,
      contacts_found: inserted,
      decision_makers_found: decisionMakers,
      response: { total_returned: people.length, filtered: filtered.length, inserted },
      completed_at: new Date().toISOString(),
    }).eq("id", jobRow!.id);

    return new Response(JSON.stringify({
      status: finalStatus,
      contacts_found: inserted,
      decision_makers_found: decisionMakers,
      max_contact_score: maxScore,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("run-apollo-enrichment error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
