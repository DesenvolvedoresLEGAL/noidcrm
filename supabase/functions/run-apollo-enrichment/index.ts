// Apollo decision-maker enrichment for prospects (Sprint E.1 + E.1.1 controls/audit)
// Triple-guard + anti-spam 24h + rate-limit 20/min + skip_reason + response_summary + tracking events.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APOLLO_URL = "https://api.apollo.io/api/v1/mixed_people/search";
const ESTIMATED_CREDITS = 2;
const ANTI_SPAM_HOURS = 24;
const RATE_LIMIT_PER_MIN = 20;

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
  company_name?: string | null;
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

const SENIORITY_RANK: Record<string, number> = { c_level: 5, vp: 4, director: 3, manager: 2, ic: 1 };

async function trackEvent(sb: any, organization_id: string, event_type: string, payload: Record<string, unknown>) {
  try {
    await sb.from("system_events").insert({
      organization_id, event_type, payload, source: "apollo_enrichment",
    });
  } catch (e) {
    console.warn("trackEvent failed", event_type, e);
  }
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

    const body = await req.json().catch(() => ({}));
    const prospect_id: string | undefined = body.prospect_id;
    const trigger_source: string = body.trigger_source ?? "user";
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

    const skip = async (skip_reason: string, message?: string) => {
      await sb.from("enrichment_jobs").insert({
        workspace_id: prospect.organization_id,
        prospect_id, provider: "apollo", status: "skipped",
        skip_reason, error: message ?? skip_reason,
        trigger_source, estimated_credits: ESTIMATED_CREDITS, credits_used: 0,
        completed_at: new Date().toISOString(),
      });
      await sb.from("prospects").update({ enrichment_status: "skipped" }).eq("id", prospect_id);
      return new Response(JSON.stringify({ status: "skipped", reason: skip_reason }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    };

    // 2. Triple-guard
    const { data: lastRun } = await sb
      .from("enrichment_runs").select("quality_label")
      .eq("prospect_id", prospect_id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    const { data: score } = await sb
      .from("prospect_scores").select("priority_score")
      .eq("prospect_id", prospect_id).maybeSingle();

    const qLabel = (lastRun as any)?.quality_label ?? null;
    const pScore = Number((score as any)?.priority_score ?? 0);

    const ALLOWED_QUALITY = ["high_confidence", "usable"];
    if (!ALLOWED_QUALITY.includes(qLabel as string)) return await skip("low_quality", `quality_label=${qLabel}`);
    if (pScore < 180) return await skip("low_score", `priority_score=${pScore} < 180`);
    if (prospect.decision_maker_found) return await skip("dm_already_found", "decision_maker_found already true");
    if (qLabel === "usable" && trigger_source === "automation") {
      return await skip("review_required", "usable quality requires manual trigger");
    }
    const review_required = qLabel === "usable";

    // 3. Anti-spam 24h
    const cutoff = new Date(Date.now() - ANTI_SPAM_HOURS * 3600 * 1000).toISOString();
    const { data: recent } = await sb
      .from("enrichment_jobs")
      .select("id, status")
      .eq("prospect_id", prospect_id).eq("provider", "apollo")
      .gte("created_at", cutoff)
      .in("status", ["done", "running"]);
    if (recent && recent.length > 0) return await skip("already_enriched", `apollo job exists in last ${ANTI_SPAM_HOURS}h`);

    // 4. Rate-limit per workspace (20/min)
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount } = await sb
      .from("enrichment_jobs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", prospect.organization_id)
      .eq("provider", "apollo")
      .gte("created_at", oneMinAgo);
    if ((recentCount ?? 0) >= RATE_LIMIT_PER_MIN) {
      return await skip("rate_limited", `more than ${RATE_LIMIT_PER_MIN} apollo jobs/min for org`);
    }

    const domain = pickDomain(prospect as Prospect);
    if (!domain) return await skip("no_domain", "no domain available");

    // 5. Create running job
    const { data: jobRow } = await sb.from("enrichment_jobs").insert({
      workspace_id: prospect.organization_id,
      prospect_id, provider: "apollo", status: "running",
      trigger_source, estimated_credits: ESTIMATED_CREDITS,
      request: { domain, person_titles: RELEVANT_TITLES, review_required, quality_label: qLabel, trigger_source },
    }).select("id").single();

    await trackEvent(sb, prospect.organization_id, "apollo_enrichment_started", {
      prospect_id, job_id: jobRow?.id, domain, trigger_source, review_required, quality_label: qLabel,
    });

    // 6. Call Apollo
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
      credits_used = ESTIMATED_CREDITS;
      if (!r.ok) {
        await sb.from("enrichment_jobs").update({
          status: "failed",
          error: `Apollo HTTP ${r.status}: ${JSON.stringify(apolloResp).slice(0, 500)}`,
          response: apolloResp, credits_used,
          response_summary: { error: true, http_status: r.status },
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
        response_summary: { error: true, message: String(e) },
        completed_at: new Date().toISOString(),
      }).eq("id", jobRow!.id);
      await sb.from("prospects").update({ enrichment_status: "failed" }).eq("id", prospect_id);
      throw e;
    }

    const people: any[] = apolloResp?.people ?? [];
    const filtered = people.filter((p) => isRelevantTitle(p.title));

    let inserted = 0;
    let decisionMakers = 0;
    let emailsFound = 0;
    let phonesFound = 0;
    let maxScore = 0;
    let topProfileId: string | null = null;
    let topSeniorityRank = 0;
    let topSeniority: string | null = null;

    for (const person of filtered) {
      const cScore = computeContactScore(person);
      const seniority = detectSeniority(person.title);
      const isDM = seniority === "c_level" || seniority === "vp" || seniority === "director";
      if (isDM) decisionMakers += 1;
      if (person.email) emailsFound += 1;
      const phone = person.phone_numbers?.[0]?.sanitized_number ?? person.organization?.phone ?? null;
      if (phone) phonesFound += 1;

      const rank = SENIORITY_RANK[seniority ?? "ic"] ?? 0;
      if (rank > topSeniorityRank) { topSeniorityRank = rank; topSeniority = seniority; }

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
        phone,
        linkedin_url: person.linkedin_url ?? null,
        provider: "apollo",
        confidence_score: cScore,
        apollo_person_id: person.id ?? null,
        raw: person,
      };

      const { data: ins, error: insErr } = await sb
        .from("enriched_contact_profiles").insert(payload).select("id").maybeSingle();

      if (!insErr && ins) {
        inserted += 1;
        if (cScore > maxScore) { maxScore = cScore; topProfileId = ins.id; }
      } else if (insErr && (insErr as any).code === "23505") {
        // duplicate by unique index — count as known but don't fail
        console.log("contact already exists (unique conflict), skipping", payload.email);
      } else if (insErr) {
        console.warn("insert contact failed", insErr);
      }
    }

    // Dedupe + resolve primary atomically via RPCs
    const { data: dedupedCount } = await sb.rpc("dedupe_prospect_contacts", { p_prospect_id: prospect_id });
    await sb.rpc("resolve_primary_contact", { p_prospect_id: prospect_id });
    if ((dedupedCount as number | null) && (dedupedCount as number) > 0) {
      await trackEvent(sb, prospect.organization_id, "lead.deduped", {
        prospect_id, deduped_count: dedupedCount,
      });
    }

    const finalStatus = inserted === 0 ? "partial" : "done";
    await sb.from("prospects").update({
      enrichment_status: finalStatus,
      contact_score: maxScore || null,
      decision_maker_found: decisionMakers > 0,
      apollo_enriched_at: new Date().toISOString(),
    }).eq("id", prospect_id);

    const response_summary = {
      contacts_found: inserted,
      emails_found: emailsFound,
      phones_found: phonesFound,
      decision_makers_found: decisionMakers,
      top_seniority: topSeniority,
      max_contact_score: maxScore,
    };

    await sb.from("enrichment_jobs").update({
      status: "done",
      credits_used,
      contacts_found: inserted,
      decision_makers_found: decisionMakers,
      response: { total_returned: people.length, filtered: filtered.length, inserted },
      response_summary,
      completed_at: new Date().toISOString(),
    }).eq("id", jobRow!.id);

    await trackEvent(sb, prospect.organization_id, "apollo_enrichment_completed", {
      prospect_id, job_id: jobRow?.id, ...response_summary, credits_used,
    });
    if (decisionMakers > 0) {
      await trackEvent(sb, prospect.organization_id, "decision_maker_found", {
        prospect_id, job_id: jobRow?.id, count: decisionMakers, top_seniority: topSeniority,
      });
    }

    return new Response(JSON.stringify({
      status: finalStatus,
      contacts_found: inserted,
      decision_makers_found: decisionMakers,
      max_contact_score: maxScore,
      response_summary,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("run-apollo-enrichment error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
