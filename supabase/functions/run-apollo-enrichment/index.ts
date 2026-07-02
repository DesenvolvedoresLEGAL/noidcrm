// Apollo decision-maker enrichment for prospects (Sprint E.1 + E.1.1 controls/audit)
// Resilient endpoint strategy: try multiple Apollo endpoints, gracefully fall back when
// the API key does not have access to a given endpoint (403 API_INACCESSIBLE).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { isBlockedDomain, normalizeHostname } from "../_shared/domain-blocklist.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APOLLO_PEOPLE_URL = "https://api.apollo.io/api/v1/mixed_people/api_search";
const APOLLO_CONTACTS_URL = "https://api.apollo.io/api/v1/contacts/search";
const APOLLO_ORG_ENRICH_URL = "https://api.apollo.io/api/v1/organizations/enrich";
const ESTIMATED_CREDITS = 2;
const ANTI_SPAM_HOURS = 24;
const RATE_LIMIT_PER_MIN = 20;
const APOLLO_TIMEOUT_MS = 12_000;

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

function isRelevantTitle(title: string | null | undefined, titles: string[] = RELEVANT_TITLES): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  return titles.some((kw) => t.includes(kw.toLowerCase()));
}

function sanitizeCustomTitles(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const v of input) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (!t) continue;
    if (t.length > 80) continue;
    out.push(t);
    if (out.length >= 25) break;
  }
  return out;
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
  if (person.phone_numbers?.length || person.sanitized_phone || person.organization?.phone || person.account?.phone) s += 15;
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

interface ApolloCallResult {
  ok: boolean;
  status: number;
  json: any;
  inaccessible: boolean;
  errorMessage?: string;
  latency_ms: number;
  apollo_request_id: string | null;
}

async function callApollo(
  url: string,
  payload: Record<string, unknown>,
  apiKey: string,
  method: "GET" | "POST" = "POST",
): Promise<ApolloCallResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), APOLLO_TIMEOUT_MS);
  const started = Date.now();
  try {
    const init: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "x-api-key": apiKey,
      },
      signal: ctrl.signal,
    };
    let finalUrl = url;
    if (method === "POST") {
      init.body = JSON.stringify(payload);
    } else {
      const qs = new URLSearchParams(
        Object.entries(payload).reduce<Record<string, string>>((acc, [k, v]) => {
          if (v != null) acc[k] = String(v);
          return acc;
        }, {}),
      );
      finalUrl = `${url}?${qs.toString()}`;
    }
    const r = await fetch(finalUrl, init);
    const json = await r.json().catch(() => ({}));
    const inaccessible =
      r.status === 403 ||
      r.status === 401 ||
      json?.error_code === "API_INACCESSIBLE";
    return {
      ok: r.ok,
      status: r.status,
      json,
      inaccessible,
      errorMessage: !r.ok ? (json?.error || json?.message || `HTTP ${r.status}`) : undefined,
      latency_ms: Date.now() - started,
      apollo_request_id: r.headers.get("x-request-id") ?? r.headers.get("x-apollo-request-id") ?? null,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      json: { error: String(e) },
      inaccessible: false,
      errorMessage: String(e),
      latency_ms: Date.now() - started,
      apollo_request_id: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

// KAI.18.6 — Apollo Wiretap: compressão base64+gzip para RAW acima de 200KB
async function maybeCompressRaw(raw: unknown): Promise<{ full: unknown | null; compressed: string | null; size: number; wasCompressed: boolean }> {
  const serialized = JSON.stringify(raw ?? null);
  const size = new TextEncoder().encode(serialized).length;
  if (size <= 200 * 1024) {
    return { full: raw ?? null, compressed: null, size, wasCompressed: false };
  }
  try {
    const stream = new Blob([serialized]).stream().pipeThrough(new CompressionStream("gzip"));
    const buf = new Uint8Array(await new Response(stream).arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return { full: null, compressed: btoa(bin), size, wasCompressed: true };
  } catch (e) {
    console.warn("[wiretap] compression failed", e);
    return { full: null, compressed: null, size, wasCompressed: false };
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
    const customTitles = sanitizeCustomTitles(body.custom_titles);
    const titlesToUse = customTitles.length > 0 ? customTitles : RELEVANT_TITLES;
    // KAI.18.5 — modo Apollo Raw / Replay / Smart.
    // raw: sem filtros de cargo/domínio, sempre bypass cache, retorna tudo.
    // replay: mesmo payload de um log anterior, bypass cache.
    // smart (default): mantém pipeline, mas marca contatos escondidos em vez de descartar.
    const mode: "smart" | "raw" | "replay" = (["raw", "replay", "smart"] as const).includes(body.mode)
      ? body.mode
      : "smart";
    const bypassCache: boolean = mode !== "smart" || !!body.bypass_cache;
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
    // Modo teste Kairós: filtros de qualidade/score só aplicam em automação.
    // Disparo manual (trigger_source !== "automation") está liberado para qualquer qualidade.
    if (trigger_source === "automation") {
      if (!ALLOWED_QUALITY.includes(qLabel as string)) return await skip("low_quality", `quality_label=${qLabel}`);
      if (pScore < 180) return await skip("low_score", `priority_score=${pScore} < 180`);
      if (prospect.decision_maker_found) {
        return await skip("dm_already_found", "decision_maker_found already true (automation only)");
      }
      if (qLabel === "usable") {
        return await skip("review_required", "usable quality requires manual trigger");
      }
    }
    const review_required = qLabel !== "high_confidence";

    // 3. Anti-spam 24h — KAI.18.5: bypass em modo raw/replay (usuário pediu explicitamente)
    if (mode === "smart" && !bypassCache) {
      const cutoff = new Date(Date.now() - ANTI_SPAM_HOURS * 3600 * 1000).toISOString();
      const { data: recent } = await sb
        .from("enrichment_jobs")
        .select("id, status, contacts_found")
        .eq("prospect_id", prospect_id).eq("provider", "apollo")
        .gte("created_at", cutoff)
        .or("status.eq.running,and(status.eq.done,contacts_found.gt.0)");
      if (recent && recent.length > 0) return await skip("already_enriched", `apollo successful/running job exists in last ${ANTI_SPAM_HOURS}h`);
    }

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
    if (isBlockedDomain(domain)) {
      return await skip(
        "blocked_domain",
        `domain ${domain} is an aggregator/social/directory and must not be used for Apollo enrichment. Set the real company domain first.`,
      );
    }

    // 5. Create running job
    const { data: jobRow } = await sb.from("enrichment_jobs").insert({
      workspace_id: prospect.organization_id,
      prospect_id, provider: "apollo", status: "running",
      trigger_source, estimated_credits: ESTIMATED_CREDITS,
      request: { domain, person_titles: titlesToUse, custom_titles_used: customTitles.length > 0, review_required, quality_label: qLabel, trigger_source },
    }).select("id").single();

    await trackEvent(sb, prospect.organization_id, "apollo_enrichment_started", {
      prospect_id, job_id: jobRow?.id, domain, trigger_source, review_required, quality_label: qLabel,
    });

    // 6. Try Apollo endpoints in order. Each endpoint can be:
    //    - accessible & has results -> use it
    //    - accessible & empty -> try next
    //    - inaccessible (403/API_INACCESSIBLE) -> log and try next, do NOT abort
    // KAI.18.6 Wiretap: cada tentativa carrega latência e RAW completo.
    const attempts: Array<{
      endpoint: string;
      status: number;
      ok: boolean;
      inaccessible: boolean;
      count: number;
      latency_ms: number;
      apollo_request_id: string | null;
      raw?: unknown;
      error?: string;
    }> = [];
    const titlesKeyword = customTitles.length > 0 ? customTitles.slice(0, 3).join(" OR ") : "";
    const searchKeywords = [prospect.company_name, domain, titlesKeyword].filter(Boolean).join(" ") || domain;

    let people: any[] = [];
    let endpointUsed: string | null = null;
    let credits_used = 0;
    let firstApolloRequestId: string | null = null;
    let totalLatency = 0;

    const pushAttempt = (endpoint: string, r: ApolloCallResult, count: number) => {
      attempts.push({
        endpoint,
        status: r.status,
        ok: r.ok,
        inaccessible: r.inaccessible,
        count,
        latency_ms: r.latency_ms,
        apollo_request_id: r.apollo_request_id,
        raw: r.json,
        error: r.errorMessage,
      });
      if (!firstApolloRequestId) firstApolloRequestId = r.apollo_request_id;
      totalLatency += r.latency_ms;
    };

    // Attempt 1: mixed_people/api_search by domain + decision-maker titles
    {
      const r = await callApollo(APOLLO_PEOPLE_URL, {
        q_organization_domains: domain,
        person_titles: titlesToUse,
        page: 1,
        per_page: 10,
      }, APOLLO_API_KEY);
      const list: any[] = r.json?.people ?? r.json?.contacts ?? [];
      pushAttempt("mixed_people/api_search", r, list.length);
      if (r.ok && list.length > 0) {
        people = list; endpointUsed = "mixed_people/api_search"; credits_used += ESTIMATED_CREDITS;
      } else if (r.ok) {
        credits_used += ESTIMATED_CREDITS;
      }
    }

    // Attempt 2: contacts/search by keywords
    if (!endpointUsed) {
      const r = await callApollo(APOLLO_CONTACTS_URL, {
        q_keywords: searchKeywords,
        page: 1,
        per_page: 25,
      }, APOLLO_API_KEY);
      const list: any[] = r.json?.contacts ?? r.json?.people ?? [];
      pushAttempt("contacts/search", r, list.length);
      if (r.ok && list.length > 0) {
        people = list; endpointUsed = "contacts/search"; credits_used += ESTIMATED_CREDITS;
      } else if (r.ok) {
        credits_used += ESTIMATED_CREDITS;
      }
    }

    // Attempt 3: contacts/search by domain only
    if (!endpointUsed) {
      const r = await callApollo(APOLLO_CONTACTS_URL, {
        q_keywords: domain,
        page: 1,
        per_page: 25,
      }, APOLLO_API_KEY);
      const list: any[] = r.json?.contacts ?? r.json?.people ?? [];
      pushAttempt("contacts/search:domain", r, list.length);
      if (r.ok && list.length > 0) {
        people = list; endpointUsed = "contacts/search:domain"; credits_used += ESTIMATED_CREDITS;
      } else if (r.ok) {
        credits_used += ESTIMATED_CREDITS;
      }
    }

    // Attempt 4: organizations/enrich
    let orgEnrichment: any = null;
    {
      const r = await callApollo(APOLLO_ORG_ENRICH_URL, { domain }, APOLLO_API_KEY, "GET");
      pushAttempt("organizations/enrich", r, r.json?.organization ? 1 : 0);
      if (r.ok && r.json?.organization) {
        orgEnrichment = r.json.organization;
      }
    }


    const allAttemptsFailed = attempts.every((a) => !a.ok);
    const allInaccessible = attempts.every((a) => a.inaccessible);

    // If absolutely nothing worked, mark failed and return 200 with details
    // (we no longer return 502 — that masked the real issue in the UI)
    if (allAttemptsFailed && people.length === 0) {
      const errMsg = allInaccessible
        ? `Sua chave Apollo não tem acesso a nenhum endpoint testado: ${attempts.map(a => a.endpoint).join(", ")}. Habilite People/Contacts Search no plano da Apollo.`
        : `Falha ao consultar Apollo. Tentativas: ${attempts.map(a => `${a.endpoint}=${a.status}`).join(", ")}`;
      await sb.from("enrichment_jobs").update({
        status: "failed",
        error: errMsg,
        response: { attempts },
        credits_used,
        response_summary: { error: true, attempts, all_inaccessible: allInaccessible },
        completed_at: new Date().toISOString(),
      }).eq("id", jobRow!.id);
      await sb.from("prospects").update({ enrichment_status: "failed" }).eq("id", prospect_id);
      return new Response(JSON.stringify({
        status: "failed",
        reason: errMsg,
        attempts,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 7. KAI.18.5 — NUNCA descartar contatos silenciosamente.
    // Cada pessoa recebe hidden_reasons[] indicando por que o Kairós NÃO recomenda.
    // Em modo `raw`, os motivos são anotados mas o UI mostra tudo por padrão.
    const prospectDomain = normalizeHostname(domain) ?? domain;
    let domainMismatchCount = 0;
    let titleMismatchCount = 0;
    let companyPhoneOnlyCount = 0;

    let decisionMakers = 0;
    let emailsFound = 0;
    let phonesFound = 0;
    let maxScore = 0;
    let topSeniority: string | null = null;
    let topSeniorityRank = 0;

    const rows = people.map((person) => {
      const reasons: string[] = [];

      // domain mismatch
      const orgDomain =
        normalizeHostname(person?.organization?.primary_domain) ??
        normalizeHostname(person?.organization?.website_url) ??
        normalizeHostname(person?.organization?.domain) ??
        normalizeHostname(person?.account?.primary_domain) ??
        normalizeHostname(person?.account?.website_url) ??
        null;
      const domainOk =
        !orgDomain ||
        orgDomain === prospectDomain ||
        orgDomain.endsWith(`.${prospectDomain}`) ||
        prospectDomain.endsWith(`.${orgDomain}`);
      if (!domainOk) {
        reasons.push("domain_mismatch");
        domainMismatchCount += 1;
      }

      // title relevance (only in smart mode is a rec, always logged)
      const titleOk = isRelevantTitle(person.title, titlesToUse) || !!person.email || !!person.linkedin_url;
      if (!titleOk) {
        reasons.push("role_mismatch");
        titleMismatchCount += 1;
      }

      // company-only phone signal
      const personPhone = person.phone_numbers?.[0]?.sanitized_number ?? person.sanitized_phone ?? null;
      const hasCompanyPhone = !!(person?.organization?.phone || person?.account?.phone);
      if (!personPhone && hasCompanyPhone) {
        reasons.push("company_phone_only");
        companyPhoneOnlyCount += 1;
      }

      const isHidden = reasons.length > 0;

      const cScore = computeContactScore(person);
      const seniority = detectSeniority(person.title);
      const isDM = seniority === "c_level" || seniority === "vp" || seniority === "director";
      if (!isHidden && isDM) decisionMakers += 1;
      if (!isHidden && person.email) emailsFound += 1;
      if (!isHidden && personPhone) phonesFound += 1;
      const rank = SENIORITY_RANK[seniority ?? "ic"] ?? 0;
      if (!isHidden && rank > topSeniorityRank) { topSeniorityRank = rank; topSeniority = seniority; }
      if (!isHidden && cScore > maxScore) maxScore = cScore;

      return {
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
        phone: personPhone,
        linkedin_url: person.linkedin_url ?? null,
        provider: "apollo",
        confidence_score: cScore,
        apollo_person_id: person.person_id ?? person.id ?? null,
        is_hidden_recommendation: isHidden,
        hidden_reasons: reasons,
        requested_titles: titlesToUse,
        raw: person,
      };
    });

    if (domainMismatchCount > 0) {
      attempts.push({
        endpoint: "domain_mismatch_flag",
        status: 200, ok: true, inaccessible: false,
        count: domainMismatchCount,
        error: `Flagged ${domainMismatchCount} contact(s) whose Apollo org domain != ${prospectDomain} (não descartado)`,
      });
    }
    if (titleMismatchCount > 0) {
      attempts.push({
        endpoint: "role_mismatch_flag",
        status: 200, ok: true, inaccessible: false,
        count: titleMismatchCount,
        error: `Flagged ${titleMismatchCount} contact(s) with role outside requested titles (não descartado)`,
      });
    }
    if (companyPhoneOnlyCount > 0) {
      attempts.push({
        endpoint: "company_phone_only_flag",
        status: 200, ok: true, inaccessible: false,
        count: companyPhoneOnlyCount,
        error: `Flagged ${companyPhoneOnlyCount} contact(s) with company phone only (não descartado)`,
      });
    }

    let inserted = 0;
    if (rows.length > 0) {
      // Batch insert. ignoreDuplicates so unique conflicts don't blow up.
      const { data: insData, error: insErr } = await sb
        .from("enriched_contact_profiles")
        .upsert(rows, { onConflict: "prospect_id,email_normalized", ignoreDuplicates: true })
        .select("id");
      if (insErr) {
        // Fallback: insert one by one to salvage what we can
        console.warn("batch upsert failed, falling back per-row", insErr);
        for (const row of rows) {
          const { error: e2 } = await sb.from("enriched_contact_profiles").insert(row);
          if (!e2) inserted += 1;
          else if ((e2 as any).code !== "23505") console.warn("row insert failed", e2);
        }
      } else {
        inserted = insData?.length ?? 0;
      }
    }

    // Dedupe + resolve primary atomically via RPCs
    try {
      const { data: dedupedCount } = await sb.rpc("dedupe_prospect_contacts", { p_prospect_id: prospect_id });
      await sb.rpc("resolve_primary_contact", { p_prospect_id: prospect_id });
      if ((dedupedCount as number | null) && (dedupedCount as number) > 0) {
        await trackEvent(sb, prospect.organization_id, "lead.deduped", {
          prospect_id, deduped_count: dedupedCount,
        });
      }
    } catch (e) {
      console.warn("dedupe/resolve_primary failed", e);
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
      endpoint_used: endpointUsed,
      attempts,
      org_enrichment_found: !!orgEnrichment,
    };

    const recommendedCount = rows.filter((r) => !r.is_hidden_recommendation).length;
    const hiddenCount = rows.length - recommendedCount;

    await sb.from("enrichment_jobs").update({
      status: "done",
      credits_used,
      contacts_found: inserted,
      decision_makers_found: decisionMakers,
      response: { total_returned: people.length, recommended: recommendedCount, hidden: hiddenCount, inserted, endpoint_used: endpointUsed, attempts, organization: orgEnrichment },
      response_summary,
      completed_at: new Date().toISOString(),
    }).eq("id", jobRow!.id);

    // KAI.18.5 — Apollo Query Log (transparência total)
    try {
      await sb.from("apollo_query_logs").insert({
        organization_id: prospect.organization_id,
        prospect_id,
        endpoint: endpointUsed ?? "mixed_people/api_search",
        mode,
        request_payload: {
          domain,
          person_titles: titlesToUse,
          custom_titles_used: customTitles.length > 0,
          trigger_source,
          bypass_cache: bypassCache,
        },
        request_headers_safe: { "x-api-key": "***", "Content-Type": "application/json" },
        response_status: attempts.find((a) => a.endpoint === endpointUsed)?.status ?? 200,
        response_body: { people_sample: people.slice(0, 3), attempts, organization: orgEnrichment ? { name: orgEnrichment.name, domain } : null },
        apollo_request_id: null,
        people_returned: people.length,
        people_recommended: recommendedCount,
        people_hidden: hiddenCount,
        hidden_reasons: {
          domain_mismatch: domainMismatchCount,
          role_mismatch: titleMismatchCount,
          company_phone_only: companyPhoneOnlyCount,
        },
        credits_used,
        cache_status: bypassCache ? "bypass" : "miss",
        fallback_used: attempts.length > 1,
        status: "ok",
      });
    } catch (e) {
      console.warn("[apollo_query_logs] insert failed", e);
    }

    await trackEvent(sb, prospect.organization_id, "apollo_enrichment_completed", {
      prospect_id, job_id: jobRow?.id, ...response_summary, credits_used,
      mode, people_returned: people.length, recommended: recommendedCount, hidden: hiddenCount,
    });
    if (decisionMakers > 0) {
      await trackEvent(sb, prospect.organization_id, "decision_maker_found", {
        prospect_id, job_id: jobRow?.id, count: decisionMakers, top_seniority: topSeniority,
      });
    }

    return new Response(JSON.stringify({
      status: finalStatus,
      mode,
      contacts_found: inserted,
      people_returned: people.length,
      people_recommended: recommendedCount,
      people_hidden: hiddenCount,
      decision_makers_found: decisionMakers,
      max_contact_score: maxScore,
      endpoint_used: endpointUsed,
      attempts,
      response_summary,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("run-apollo-enrichment error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
