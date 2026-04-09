import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Normalization helpers ──────────────────────────────────────────

const SUFFIXES_RE = /\b(ltda|s\.?a\.?|me|eireli|epp|ss|s\/a|sociedade\s+an[oô]nima|limitada)\s*\.?\s*$/i;

function normalizeCompanyName(raw: string): string {
  let n = raw.trim().replace(/\s+/g, " ");
  n = n.replace(SUFFIXES_RE, "").trim();
  return n.toLowerCase();
}

function extractDomain(line: string): string | null {
  const urlMatch = line.match(/https?:\/\/([^\s/]+)/i);
  if (urlMatch) return urlMatch[1].toLowerCase().replace(/^www\./, "");
  const domainMatch = line.match(/([a-z0-9-]+\.[a-z]{2,})/i);
  if (domainMatch && domainMatch[1].includes(".")) return domainMatch[1].toLowerCase();
  return null;
}

function extractDomainFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

// ── Run Events helper ──────────────────────────────────────────────

async function logRunEvent(
  supabase: any,
  organizationId: string,
  runId: string,
  level: string,
  message: string,
  payload: any = {}
) {
  try {
    await supabase.from("run_events").insert({
      workspace_id: organizationId,
      playbook_run_id: runId,
      level,
      message,
      payload,
    });
  } catch (err) {
    console.error("Failed to log run event:", err);
  }
}

// ── Deterministic scoring for manual import ────────────────────────

interface IcpContext {
  segment?: string;
  industries?: string[];
  geoTargets?: Array<{ state?: string; city?: string }>;
  keywords?: string[];
}

function scoreManualProspect(
  companyName: string,
  domain: string | null,
  website: string | null,
  city: string | null,
  icp: IcpContext | null
): { icpFit: number; signal: number; dataQuality: number; sourceTrust: number; penalty: number; signals: string[]; confidence: number } {
  let icpFit = 0;
  let dataQuality = 0;
  let penalty = 0;
  const signals: string[] = [];

  if (companyName) dataQuality += 10;
  if (domain) { dataQuality += 10; signals.push("has_domain"); }
  if (website) { dataQuality += 5; signals.push("has_website"); }
  if (city) dataQuality += 5;

  if (!domain && !website && !city) {
    penalty += 10;
    signals.push("name_only_input");
  }

  if (icp) {
    const nameLower = companyName.toLowerCase();
    const keywords = icp.keywords || [];
    if (keywords.some(k => nameLower.includes(k.toLowerCase()))) {
      icpFit += 20;
      signals.push("matched_icp_keyword");
    }
    if (icp.segment && nameLower.includes(icp.segment.toLowerCase())) {
      icpFit += 10;
    }
    if (city && icp.geoTargets?.length) {
      const cityLower = city.toLowerCase();
      if (icp.geoTargets.some(g => g.city?.toLowerCase() === cityLower || g.state?.toLowerCase() === cityLower)) {
        icpFit += 10;
        signals.push("matched_geo_keyword");
      }
    }
  }

  const confidence = Math.min(100, dataQuality + icpFit);
  return { icpFit, signal: 0, dataQuality, sourceTrust: 50, penalty, signals, confidence };
}

function gradeFromScore(score: number): string {
  if (score >= 70) return "A";
  if (score >= 50) return "B";
  if (score >= 30) return "C";
  return "D";
}

function recommendAction(grade: string, hasWebsite: boolean): string {
  if (grade === "A") return hasWebsite ? "Pesquisar contatos e abordar" : "Validar website e abordar";
  if (grade === "B") return "Enriquecer dados antes de abordar";
  if (grade === "C") return "Verificar fit manualmente";
  return "Baixa prioridade — reavaliar";
}

// ── Deduplication against accounts ─────────────────────────────────

interface DedupeResult {
  dedupe_status: string;
  duplicate_candidate: boolean;
  review_needed: boolean;
  matched_account_id: string | null;
  match_type: string | null;
}

async function dedupeProspect(
  supabase: any,
  organizationId: string,
  normalizedName: string,
  domain: string | null,
  city: string | null,
  accounts: any[]
): Promise<DedupeResult> {
  const noMatch: DedupeResult = {
    dedupe_status: "no_match",
    duplicate_candidate: false,
    review_needed: false,
    matched_account_id: null,
    match_type: null,
  };

  if (!accounts.length) return noMatch;

  if (domain) {
    for (const acc of accounts) {
      const accDomain = extractDomainFromUrl(acc.website);
      if (accDomain && accDomain === domain) {
        return {
          dedupe_status: "strong_match",
          duplicate_candidate: true,
          review_needed: false,
          matched_account_id: acc.id,
          match_type: "domain_exact",
        };
      }
    }
  }

  for (const acc of accounts) {
    const accName1 = normalizeCompanyName(acc.razao_social || "");
    const accName2 = acc.nome_fantasia ? normalizeCompanyName(acc.nome_fantasia) : "";

    if (accName1 === normalizedName || (accName2 && accName2 === normalizedName)) {
      return {
        dedupe_status: "strong_match",
        duplicate_candidate: true,
        review_needed: false,
        matched_account_id: acc.id,
        match_type: "name_exact",
      };
    }

    if (normalizedName.length >= 5) {
      if (accName1.includes(normalizedName) || normalizedName.includes(accName1) && accName1.length >= 5) {
        return {
          dedupe_status: "possible_match",
          duplicate_candidate: true,
          review_needed: true,
          matched_account_id: acc.id,
          match_type: "name_partial",
        };
      }
      if (accName2 && (accName2.includes(normalizedName) || normalizedName.includes(accName2)) && accName2.length >= 5) {
        return {
          dedupe_status: "possible_match",
          duplicate_candidate: true,
          review_needed: true,
          matched_account_id: acc.id,
          match_type: "name_partial",
        };
      }
    }
  }

  if (city) {
    const cityLower = city.toLowerCase();
    for (const acc of accounts) {
      if (acc.cidade?.toLowerCase() === cityLower) {
        const accName1 = normalizeCompanyName(acc.razao_social || "");
        const accName2 = acc.nome_fantasia ? normalizeCompanyName(acc.nome_fantasia) : "";
        const prefix = normalizedName.substring(0, Math.min(8, normalizedName.length));
        if (prefix.length >= 5 && (accName1.startsWith(prefix) || accName2.startsWith(prefix))) {
          return {
            dedupe_status: "possible_match",
            duplicate_candidate: true,
            review_needed: true,
            matched_account_id: acc.id,
            match_type: "name_city",
          };
        }
      }
    }
  }

  return noMatch;
}

// ── Main handler ───────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();

    // ── RETRY ACTION ─────────────────────────────────────────────
    if (body.action === "retry") {
      return await handleRetry(supabase, body, req);
    }

    const { organization_id, playbook_type, icp_profile_id, input_payload, import_rules } = body;

    const searchType = playbook_type || body.search_type;
    const config = input_payload || body.config || {};
    const icpId = icp_profile_id || body.icp_id || null;
    const scoreThreshold = import_rules?.scoreThreshold ?? config.min_score ?? 50;

    if (!organization_id || !searchType) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user } } = await anonClient.auth.getUser(token);
      userId = user?.id || null;
    }

    let icpData: any = null;
    let icpContext = "";
    if (icpId) {
      const { data: icp } = await supabase
        .from("icp_profiles")
        .select("*")
        .eq("id", icpId)
        .single();
      if (icp) {
        icpData = icp;
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

    const startTime = Date.now();

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

    await logRunEvent(supabase, organization_id, run.id, "info", "Execução iniciada", { searchType, config });

    // Pre-load accounts for dedupe
    const { data: orgAccounts } = await supabase
      .from("accounts")
      .select("id, razao_social, nome_fantasia, website, cidade")
      .eq("organization_id", organization_id)
      .is("deleted_at", null)
      .limit(1000);
    const accounts = orgAccounts || [];

    try {
      if (searchType === "import" || searchType === "manual_import") {
        return await handleManualImport(supabase, run, organization_id, icpId, icpData, config, scoreThreshold, accounts, startTime);
      }

      if (searchType === "event") {
        return await handleEventFirecrawl(supabase, run, organization_id, icpId, config, icpContext, scoreThreshold, accounts, startTime);
      }

      if (searchType === "geo") {
        return await handleGeoSearch(supabase, run, organization_id, icpId, config, icpContext, scoreThreshold, accounts, startTime);
      }

      if (searchType === "directory") {
        return await handleDirectorySearch(supabase, run, organization_id, icpId, config, icpContext, scoreThreshold, accounts, startTime);
      }

      if (searchType === "seed") {
        return await handleSeedExpansion(supabase, run, organization_id, icpId, config, icpContext, scoreThreshold, accounts, startTime);
      }

      // Fallback for unknown types
      throw new Error(`Unknown search type: ${searchType}`);
    } catch (handlerError) {
      const elapsed = Date.now() - startTime;
      const errorMsg = handlerError instanceof Error ? handlerError.message : String(handlerError);
      
      await logRunEvent(supabase, organization_id, run.id, "error", "Execução falhou", { error: errorMsg });
      
      await supabase.from("playbook_runs").update({
        status: "failed",
        finished_at: new Date().toISOString(),
        execution_time_ms: elapsed,
        error_summary: errorMsg.substring(0, 500),
      }).eq("id", run.id);

      throw handlerError;
    }

  } catch (error) {
    console.error("lead-sourcing error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Retry Handler ──────────────────────────────────────────────────

async function handleRetry(supabase: any, body: any, req: Request) {
  const { run_id } = body;
  if (!run_id) {
    return new Response(JSON.stringify({ error: "run_id is required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: originalRun, error } = await supabase
    .from("playbook_runs")
    .select("*")
    .eq("id", run_id)
    .single();

  if (error || !originalRun) {
    return new Response(JSON.stringify({ error: "Run not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Increment retry_count on original
  await supabase.from("playbook_runs").update({
    retry_count: (originalRun.retry_count || 0) + 1,
  }).eq("id", run_id);

  // Re-invoke the function with the same payload
  const payload = originalRun.input_payload || {};
  const retryBody = {
    organization_id: originalRun.organization_id,
    playbook_type: payload.playbookType,
    icp_profile_id: originalRun.icp_profile_id,
    input_payload: payload,
    import_rules: payload.importRules,
  };

  // Recursively handle by creating a new request internally
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const retryResp = await fetch(`${supabaseUrl}/functions/v1/lead-sourcing`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: req.headers.get("Authorization") || `Bearer ${supabaseKey}`,
      apikey: supabaseKey,
    },
    body: JSON.stringify(retryBody),
  });

  const retryData = await retryResp.json();
  return new Response(JSON.stringify({ ...retryData, retried_from: run_id }), {
    status: retryResp.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Manual Import Handler ──────────────────────────────────────────

async function handleManualImport(
  supabase: any,
  run: any,
  organizationId: string,
  icpId: string | null,
  icpData: any,
  config: any,
  scoreThreshold: number,
  accounts: any[],
  startTime: number
) {
  const importList: string = config.import_list || "";
  const lines = importList.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
  const rawItems = importList.split("\n").length;

  const seen = new Set<string>();
  const uniqueLines: string[] = [];
  let duplicatesInInput = 0;

  for (const line of lines) {
    const key = normalizeCompanyName(line);
    if (seen.has(key)) {
      duplicatesInInput++;
      continue;
    }
    seen.add(key);
    uniqueLines.push(line);
  }

  await logRunEvent(supabase, organizationId, run.id, "info", `${uniqueLines.length} linhas únicas de ${lines.length} válidas`, { rawItems, duplicatesInInput });

  const { data: source } = await supabase
    .from("lead_sources")
    .insert({
      organization_id: organizationId,
      playbook_run_id: run.id,
      source_type: "manual_import",
      source_label: "Lista Importada",
      source_metadata: { line_count: uniqueLines.length },
    })
    .select()
    .single();

  const icpCtx: IcpContext | null = icpData ? {
    segment: icpData.segment || undefined,
    industries: icpData.industries || [],
    geoTargets: icpData.geo_targets || [],
    keywords: [...(icpData.keywords_include || []), ...(icpData.pain_points || [])],
  } : null;

  let prospectsCreated = 0;
  const invalidItems: string[] = [];
  const executionLog: any[] = [
    { step: "parse_input", raw_lines: rawItems, valid_lines: lines.length, unique_lines: uniqueLines.length, duplicates: duplicatesInInput, at: new Date().toISOString() },
  ];

  for (const line of uniqueLines) {
    const companyName = line.replace(/https?:\/\/\S+/gi, "").trim() || line;
    const normalizedName = normalizeCompanyName(companyName);
    const domain = extractDomain(line);
    const website = domain ? `https://${domain}` : null;

    if (!companyName || companyName.length < 2) {
      invalidItems.push(line);
      continue;
    }

    const score = scoreManualProspect(companyName, domain, website, null, icpCtx);
    const totalScore = score.icpFit + score.signal + score.dataQuality + score.sourceTrust - score.penalty;
    const grade = gradeFromScore(totalScore);
    const recommended = recommendAction(grade, !!website);

    const dedupe = await dedupeProspect(supabase, organizationId, normalizedName, domain, null, accounts);

    const { data: prospect, error: prospectError } = await supabase
      .from("prospects")
      .insert({
        organization_id: organizationId,
        playbook_run_id: run.id,
        icp_profile_id: icpId,
        source_id: source?.id || null,
        company_name: companyName,
        normalized_company_name: normalizedName,
        website,
        normalized_domain: domain,
        status: "review_pending",
        confidence: score.confidence,
        source_label: "Lista Importada",
        review_needed: grade === "C" || grade === "D" || dedupe.review_needed,
        recommended_next_action: recommended,
        raw_data: { original_line: line },
        matched_account_id: dedupe.matched_account_id,
        dedupe_status: dedupe.dedupe_status,
        duplicate_candidate: dedupe.duplicate_candidate,
        approval_status: "pending",
      })
      .select()
      .single();

    if (prospectError) {
      console.error("Insert prospect error:", prospectError);
      invalidItems.push(line);
      await logRunEvent(supabase, organizationId, run.id, "warn", `Falha ao inserir prospect: ${companyName}`, { error: prospectError.message });
      continue;
    }

    prospectsCreated++;

    await supabase.from("prospect_scores").insert({
      organization_id: organizationId,
      prospect_id: prospect.id,
      icp_fit_score: score.icpFit,
      signal_score: score.signal,
      data_quality_score: score.dataQuality,
      source_trust_score: score.sourceTrust,
      penalty_score: score.penalty,
      reasoning: {
        summary: `Score ${totalScore}: ${score.signals.join(", ") || "dados básicos"}`,
        signals: score.signals,
        dedupe: dedupe.match_type ? { status: dedupe.dedupe_status, match_type: dedupe.match_type } : null,
      },
      grade,
    });

    for (const sig of score.signals) {
      await supabase.from("prospect_signals").insert({
        organization_id: organizationId,
        prospect_id: prospect.id,
        signal_type: sig,
        signal_value: "true",
        weight: sig === "matched_icp_keyword" ? 20 : sig === "name_only_input" ? -10 : 10,
        confidence: score.confidence,
        source_reference: "manual_import_scoring_v1",
      });
    }
  }

  executionLog.push({
    step: "processing_complete",
    prospects_created: prospectsCreated,
    invalid_items: invalidItems.length,
    at: new Date().toISOString(),
  });

  // Auto-import eligible prospects
  const importRules = config.importRules || {};
  const autoImported = await autoImportEligibleProspects(supabase, organizationId, run.id, importRules);

  const elapsed = Date.now() - startTime;
  const stats = {
    raw_items: rawItems,
    valid_items: lines.length,
    invalid_items: invalidItems.length,
    prospects_created: prospectsCreated,
    duplicates_in_input: duplicatesInInput,
    auto_imported: autoImported,
  };

  await logRunEvent(supabase, organizationId, run.id, "info", `Concluído: ${prospectsCreated} prospects criados`, stats);

  await supabase.from("playbook_runs").update({
    status: "completed",
    finished_at: new Date().toISOString(),
    stats,
    execution_log: executionLog,
    execution_time_ms: elapsed,
  }).eq("id", run.id);

  return new Response(
    JSON.stringify({ run_id: run.id, prospects_count: prospectsCreated, stats }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Event Firecrawl Handler ─────────────────────────────────────────

async function handleEventFirecrawl(
  supabase: any,
  run: any,
  organizationId: string,
  icpId: string | null,
  config: any,
  icpContext: string,
  scoreThreshold: number,
  accounts: any[],
  startTime: number
) {
  const eventUrl = config.event_url;
  const eventName = config.event_name || "Evento";
  const executionLog: any[] = [];

  if (!eventUrl) {
    await supabase.from("playbook_runs").update({ status: "failed", finished_at: new Date().toISOString(), execution_log: [{ step: "validation", error: "event_url is required" }], error_summary: "event_url is required", execution_time_ms: Date.now() - startTime }).eq("id", run.id);
    return new Response(JSON.stringify({ error: "event_url is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) {
    await supabase.from("playbook_runs").update({ status: "failed", finished_at: new Date().toISOString(), execution_log: [{ step: "config", error: "FIRECRAWL_API_KEY not configured" }], error_summary: "FIRECRAWL_API_KEY not configured", execution_time_ms: Date.now() - startTime }).eq("id", run.id);
    return new Response(JSON.stringify({ error: "Firecrawl not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const { data: source } = await supabase.from("lead_sources").insert({
    organization_id: organizationId,
    playbook_run_id: run.id,
    source_type: "event_exhibitors",
    source_label: eventName,
    source_url: eventUrl,
    source_metadata: config,
  }).select().single();

  // Step 1: Map
  await logRunEvent(supabase, organizationId, run.id, "info", "Mapeando URL do evento", { eventUrl });
  let discoveredUrls: string[] = [];
  try {
    const formattedUrl = eventUrl.startsWith("http") ? eventUrl : `https://${eventUrl}`;
    const mapResp = await fetch("https://api.firecrawl.dev/v1/map", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: formattedUrl, limit: 200, includeSubdomains: false }),
    });
    const mapData = await mapResp.json();
    discoveredUrls = mapData.links || mapData.data?.links || [];
    executionLog.push({ step: "firecrawl_map", pages_discovered: discoveredUrls.length, at: new Date().toISOString() });
    await logRunEvent(supabase, organizationId, run.id, "info", `${discoveredUrls.length} páginas descobertas`, { pages: discoveredUrls.length });
  } catch (err) {
    console.error("Firecrawl map error:", err);
    executionLog.push({ step: "firecrawl_map", error: String(err), at: new Date().toISOString() });
    await logRunEvent(supabase, organizationId, run.id, "error", "Erro no mapeamento Firecrawl", { error: String(err) });
  }

  // Step 2: Classify
  const relevantKeywords = ["exhibitor", "expositor", "sponsor", "patrocinador", "brand", "marca", "partner", "parceiro", "company", "empresa", "stand", "booth", "list", "directory", "diretorio"];
  const irrelevantKeywords = ["login", "signup", "cart", "checkout", "privacy", "terms", "cookie", "faq", "contact", "contato"];

  const classifyUrl = (url: string): string => {
    const lower = url.toLowerCase();
    if (irrelevantKeywords.some(k => lower.includes(k))) return "irrelevant";
    if (/exhibitor|expositor/.test(lower)) {
      return lower.match(/exhibitor[s-]?\/[^/]+|expositor[es-]?\/[^/]+/) ? "exhibitor_profile" : "exhibitors_list";
    }
    if (/sponsor|patrocinador/.test(lower)) return "sponsor";
    if (relevantKeywords.some(k => lower.includes(k))) return "exhibitors_list";
    return "unknown";
  };

  const classified = discoveredUrls.map(url => ({ url, page_type: classifyUrl(url) }));
  const relevantPages = classified.filter(p => p.page_type !== "irrelevant" && p.page_type !== "unknown");

  for (const page of classified.filter(p => p.page_type !== "irrelevant")) {
    await supabase.from("source_pages").insert({
      organization_id: organizationId,
      lead_source_id: source?.id,
      url: page.url,
      page_type: page.page_type,
      status: "discovered",
    });
  }

  executionLog.push({ step: "classify_pages", total: classified.length, relevant: relevantPages.length, at: new Date().toISOString() });
  await logRunEvent(supabase, organizationId, run.id, "info", `${relevantPages.length} páginas relevantes classificadas`, { total: classified.length, relevant: relevantPages.length });

  // Step 3: Scrape
  const pagesToScrape = relevantPages.slice(0, 10);
  const scrapedContents: Array<{ url: string; markdown: string; page_type: string }> = [];

  for (const page of pagesToScrape) {
    try {
      const isListPage = page.page_type === "exhibitors_list";
      const scrapeBody: any = {
        url: page.url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 2000,
      };
      if (isListPage) {
        // 20 ciclos de scroll (cada um rola 5 viewports) + wait 1.5s = cobre ~100 viewports
        const scrollActions: any[] = [];
        for (let i = 0; i < 20; i++) {
          scrollActions.push({ type: "scroll", direction: "down", amount: 5 });
          scrollActions.push({ type: "wait", milliseconds: 1500 });
        }
        scrapeBody.actions = scrollActions;
        scrapeBody.timeout = 120000; // 2min timeout para páginas grandes
      }
      const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(scrapeBody),
      });
      const scrapeData = await scrapeResp.json();
      const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
      if (markdown) {
        scrapedContents.push({ url: page.url, markdown, page_type: page.page_type });
        await supabase.from("source_pages").update({ status: "scraped", raw_content: markdown }).eq("url", page.url).eq("lead_source_id", source?.id);
      }
    } catch (err) {
      console.error(`Scrape error for ${page.url}:`, err);
      await supabase.from("source_pages").update({ status: "failed" }).eq("url", page.url).eq("lead_source_id", source?.id);
      await logRunEvent(supabase, organizationId, run.id, "warn", `Falha ao scrape: ${page.url}`, { error: String(err) });
    }
  }

  executionLog.push({ step: "firecrawl_scrape", pages_scraped: scrapedContents.length, at: new Date().toISOString() });
  await logRunEvent(supabase, organizationId, run.id, "info", `${scrapedContents.length} páginas extraídas`, { pages_scraped: scrapedContents.length });

  // Step 4: AI extraction
  const allExhibitors: any[] = [];

  for (const scraped of scrapedContents) {
    try {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `Você é o Caramelo Agent, executando um playbook de expositores de evento.
Sua tarefa é identificar empresas expositoras a partir de páginas de evento, lista de marcas, diretórios de expositores e perfis individuais.
Extraia apenas empresas reais com utilidade comercial.
Nunca invente dados.
Sempre marque confidence com base na evidência.
Sinalize website, categoria, cidade, país, booth, perfil do expositor, resumo da empresa e sinais comerciais quando houver.
Retorne somente JSON estruturado.
${icpContext}`,
            },
            {
              role: "user",
              content: `Extraia todas as empresas expositoras desta página de evento (${eventName}):\n\nURL: ${scraped.url}\nTipo: ${scraped.page_type}\n\nConteúdo (${scraped.markdown.length} chars capturados):\n${scraped.markdown.substring(0, 50000)}`,
            },
          ],
          tools: [{
            type: "function",
            function: {
              name: "extract_exhibitors",
              description: "Extract exhibitor companies from event page content",
              parameters: {
                type: "object",
                properties: {
                  exhibitors: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        company_name: { type: "string" },
                        website: { type: "string" },
                        category: { type: "string" },
                        description: { type: "string" },
                        booth: { type: "string" },
                        country: { type: "string" },
                        city: { type: "string" },
                        exhibitor_profile_url: { type: "string" },
                        signals: { type: "array", items: { type: "string" } },
                        confidence: { type: "number" },
                      },
                      required: ["company_name", "signals", "confidence"],
                    },
                  },
                },
                required: ["exhibitors"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "extract_exhibitors" } },
        }),
      });

      if (aiResp.ok) {
        const aiData = await aiResp.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          const parsed = JSON.parse(toolCall.function.arguments);
          const exhibitors = parsed.exhibitors || [];
          for (const ex of exhibitors) {
            ex._source_url = scraped.url;
            ex._page_type = scraped.page_type;
          }
          allExhibitors.push(...exhibitors);
        }
      } else {
        const errText = await aiResp.text();
        console.error("AI extraction error:", aiResp.status, errText);
        await logRunEvent(supabase, organizationId, run.id, "warn", `Erro na extração AI: ${aiResp.status}`, { url: scraped.url });
      }
    } catch (err) {
      console.error(`AI extraction error for ${scraped.url}:`, err);
      await logRunEvent(supabase, organizationId, run.id, "warn", `Erro na extração AI: ${scraped.url}`, { error: String(err) });
    }
  }

  executionLog.push({ step: "ai_extraction", exhibitors_extracted: allExhibitors.length, at: new Date().toISOString() });
  await logRunEvent(supabase, organizationId, run.id, "info", `${allExhibitors.length} expositores extraídos via AI`);

  // Step 5: Deduplicate and create prospects
  const seenNames = new Set<string>();
  let prospectsCreated = 0;

  for (const ex of allExhibitors) {
    const companyName = ex.company_name?.trim();
    if (!companyName || companyName.length < 2) continue;

    const normalizedName = normalizeCompanyName(companyName);
    if (seenNames.has(normalizedName)) continue;
    seenNames.add(normalizedName);

    const domain = extractDomain(ex.website || "");
    const website = ex.website || (domain ? `https://${domain}` : null);
    const exSignals: string[] = ex.signals || [];

    exSignals.push("participates_in_events");
    if (ex._page_type === "exhibitors_list" || ex._page_type === "exhibitor_profile") exSignals.push("listed_in_official_directory");
    if (ex.booth) exSignals.push("has_booth");
    if (exSignals.some(s => /demo|showcase|product/i.test(s))) exSignals.push("has_product_showcase");

    let eventBonus = 0;
    if (exSignals.includes("listed_in_official_directory")) eventBonus += 10;
    if (ex.exhibitor_profile_url) eventBonus += 10;
    if (ex.booth) eventBonus += 5;
    if (website) eventBonus += 10;
    if (ex.description && ex.description.length > 30) eventBonus += 5;
    if (exSignals.includes("has_product_showcase") || exSignals.some(s => /demo|live/i.test(s))) eventBonus += 10;

    const icpFit = Math.min(100, (ex.confidence || 50) + eventBonus);
    const dataQuality = Math.min(100, (website ? 20 : 0) + (ex.city ? 10 : 0) + (ex.description ? 10 : 0) + (companyName ? 10 : 0) + (ex.category ? 5 : 0) + (ex.booth ? 5 : 0));
    const signalScore = Math.min(100, exSignals.length * 10);
    const sourceTrust = 70;
    const totalScore = icpFit + signalScore + dataQuality + sourceTrust;
    const grade = gradeFromScore(Math.round(totalScore / 4));

    const dedupe = await dedupeProspect(supabase, organizationId, normalizedName, domain, ex.city || null, accounts);

    const { data: prospect, error: prospectError } = await supabase.from("prospects").insert({
      organization_id: organizationId,
      playbook_run_id: run.id,
      icp_profile_id: icpId,
      source_id: source?.id || null,
      company_name: companyName,
      normalized_company_name: normalizedName,
      website,
      normalized_domain: domain,
      industry: ex.category || null,
      country: ex.country || null,
      city: ex.city || null,
      summary: ex.description || null,
      status: "review_pending",
      confidence: ex.confidence || null,
      source_label: eventName,
      source_url: ex._source_url || eventUrl,
      raw_data: ex,
      event_name: eventName,
      event_url: eventUrl,
      exhibitor_profile_url: ex.exhibitor_profile_url || null,
      booth: ex.booth || null,
      matched_account_id: dedupe.matched_account_id,
      dedupe_status: dedupe.dedupe_status,
      duplicate_candidate: dedupe.duplicate_candidate,
      review_needed: dedupe.review_needed,
      approval_status: "pending",
    }).select().single();

    if (prospectError) {
      console.error("Insert prospect error:", prospectError);
      continue;
    }

    prospectsCreated++;

    await supabase.from("prospect_scores").insert({
      organization_id: organizationId,
      prospect_id: prospect.id,
      icp_fit_score: icpFit,
      signal_score: signalScore,
      data_quality_score: dataQuality,
      source_trust_score: sourceTrust,
      penalty_score: 0,
      reasoning: {
        summary: `Expositor do evento ${eventName}. Score ${Math.round(totalScore / 4)}: ${exSignals.slice(0, 5).join(", ")}`,
        signals: exSignals,
        event_bonus: eventBonus,
        dedupe: dedupe.match_type ? { status: dedupe.dedupe_status, match_type: dedupe.match_type } : null,
      },
      grade,
    });

    const uniqueSignals = [...new Set(exSignals)];
    for (const sig of uniqueSignals) {
      const weight = sig === "listed_in_official_directory" ? 10 : sig === "has_booth" ? 5 : sig === "participates_in_events" ? 10 : sig === "has_product_showcase" ? 10 : 5;
      await supabase.from("prospect_signals").insert({
        organization_id: organizationId,
        prospect_id: prospect.id,
        signal_type: sig,
        signal_value: "true",
        weight,
        confidence: ex.confidence || 50,
        source_reference: `firecrawl_event_${eventName}`,
      });
    }
  }

  executionLog.push({ step: "prospects_created", count: prospectsCreated, at: new Date().toISOString() });

  // Auto-import eligible prospects
  const importRules = config.importRules || {};
  const autoImported = await autoImportEligibleProspects(supabase, organizationId, run.id, importRules);

  const elapsed = Date.now() - startTime;
  const stats = {
    pages_discovered: discoveredUrls.length,
    pages_scraped: scrapedContents.length,
    exhibitors_extracted: allExhibitors.length,
    prospects_created: prospectsCreated,
    auto_imported: autoImported,
  };

  await logRunEvent(supabase, organizationId, run.id, "info", `Concluído: ${prospectsCreated} prospects de ${allExhibitors.length} expositores`, stats);

  await supabase.from("playbook_runs").update({
    status: "completed",
    finished_at: new Date().toISOString(),
    stats,
    execution_log: executionLog,
    execution_time_ms: elapsed,
  }).eq("id", run.id);

  return new Response(
    JSON.stringify({ run_id: run.id, prospects_count: prospectsCreated, stats }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Shared: Firecrawl Search + AI Extract pipeline ────────────────

async function firecrawlSearch(apiKey: string, query: string, limit = 8): Promise<any[]> {
  const resp = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit, lang: "pt-br", country: "BR", scrapeOptions: { formats: ["markdown"] } }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Firecrawl search error: ${resp.status} - ${JSON.stringify(data)}`);
  return data.data || [];
}

async function firecrawlScrape(apiKey: string, url: string): Promise<string> {
  const formatted = url.startsWith("http") ? url : `https://${url}`;
  const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url: formatted, formats: ["markdown"], onlyMainContent: true }),
  });
  const data = await resp.json();
  return data.data?.markdown || data.markdown || "";
}

async function aiExtractCompanies(
  lovableKey: string,
  systemPrompt: string,
  userPrompt: string,
  toolName: string,
  toolDesc: string,
  extraProps: Record<string, any> = {},
  extraRequired: string[] = []
): Promise<any[]> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      tools: [{
        type: "function",
        function: {
          name: toolName,
          description: toolDesc,
          parameters: {
            type: "object",
            properties: {
              companies: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    company_name: { type: "string" },
                    website: { type: "string" },
                    industry: { type: "string" },
                    city: { type: "string" },
                    state: { type: "string" },
                    description: { type: "string" },
                    confidence: { type: "number" },
                    signals: { type: "array", items: { type: "string" } },
                    ...extraProps,
                  },
                  required: ["company_name", "confidence", "signals", ...extraRequired],
                },
              },
            },
            required: ["companies"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: toolName } },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    if (resp.status === 429) throw new Error("RATE_LIMITED");
    if (resp.status === 402) throw new Error("CREDITS_EXHAUSTED");
    throw new Error(`AI error ${resp.status}: ${errText.substring(0, 300)}`);
  }

  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    const parsed = JSON.parse(toolCall.function.arguments);
    return parsed.companies || [];
  }
  return [];
}

async function saveProspectsFromExtraction(
  supabase: any,
  companies: any[],
  organizationId: string,
  runId: string,
  icpId: string | null,
  sourceId: string | null,
  sourceLabel: string,
  playbookSignals: string[],
  accounts: any[],
  bonusCalc: (c: any) => number,
) {
  const seenNames = new Set<string>();
  let created = 0;

  for (const c of companies) {
    const name = c.company_name?.trim();
    if (!name || name.length < 2) continue;
    const normalizedName = normalizeCompanyName(name);
    if (seenNames.has(normalizedName)) continue;
    seenNames.add(normalizedName);

    const domain = extractDomain(c.website || "");
    const website = c.website || (domain ? `https://${domain}` : null);
    const allSignals = [...new Set([...(c.signals || []), ...playbookSignals])];
    const bonus = bonusCalc(c);

    const icpFit = Math.min(100, (c.confidence || 50) + bonus);
    const dataQuality = Math.min(100, (website ? 20 : 0) + (c.city ? 10 : 0) + (c.description ? 10 : 0) + (name ? 10 : 0) + (c.industry ? 5 : 0));
    const signalScore = Math.min(100, allSignals.length * 10);
    const sourceTrust = 65;
    const totalScore = Math.round((icpFit + signalScore + dataQuality + sourceTrust) / 4);
    const grade = gradeFromScore(totalScore);

    const dedupe = await dedupeProspect(supabase, organizationId, normalizedName, domain, c.city || null, accounts);

    const { data: prospect, error: err } = await supabase.from("prospects").insert({
      organization_id: organizationId,
      playbook_run_id: runId,
      icp_profile_id: icpId,
      source_id: sourceId,
      company_name: name,
      normalized_company_name: normalizedName,
      website,
      normalized_domain: domain,
      industry: c.industry || null,
      city: c.city || null,
      state: c.state || null,
      country: c.country || "Brasil",
      summary: c.description || c.similarity_reason || null,
      status: "review_pending",
      confidence: c.confidence || null,
      source_label: sourceLabel,
      raw_data: c,
      matched_account_id: dedupe.matched_account_id,
      dedupe_status: dedupe.dedupe_status,
      duplicate_candidate: dedupe.duplicate_candidate,
      review_needed: dedupe.review_needed,
      approval_status: "pending",
    }).select().single();

    if (err) { console.error("Insert prospect error:", err); continue; }
    created++;

    await supabase.from("prospect_scores").insert({
      organization_id: organizationId,
      prospect_id: prospect.id,
      icp_fit_score: icpFit,
      signal_score: signalScore,
      data_quality_score: dataQuality,
      source_trust_score: sourceTrust,
      penalty_score: 0,
      reasoning: {
        summary: `Score ${totalScore}: ${allSignals.slice(0, 5).join(", ")}`,
        signals: allSignals,
        dedupe: dedupe.match_type ? { status: dedupe.dedupe_status, match_type: dedupe.match_type } : null,
      },
      grade,
    });

    for (const sig of allSignals) {
      await supabase.from("prospect_signals").insert({
        organization_id: organizationId,
        prospect_id: prospect.id,
        signal_type: sig,
        signal_value: "true",
        weight: 10,
        confidence: c.confidence || 50,
        source_reference: `${sourceLabel}_v1`,
      });
    }
  }
  return created;
}

// ── Auto-Import: CRM creation + round robin ───────────────────────

async function autoImportEligibleProspects(
  supabase: any,
  organizationId: string,
  runId: string,
  importRules: any,
) {
  if (!importRules?.autoImport) return 0;

  const threshold = importRules.scoreThreshold ?? 50;
  const autoCreateOpp = importRules.autoCreateOpportunity !== false;
  const autoAssign = importRules.autoAssignOwner !== false;

  // Fetch prospects for this run with their scores
  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, company_name, website, normalized_domain, industry, city, state, country, email_public, phone_public, summary, confidence, raw_data, matched_account_id, dedupe_status, playbook_run_id")
    .eq("playbook_run_id", runId)
    .eq("organization_id", organizationId)
    .in("status", ["review_pending"])
    .eq("approval_status", "pending");

  if (!prospects?.length) return 0;

  const { data: scores } = await supabase
    .from("prospect_scores")
    .select("prospect_id, icp_fit_score, signal_score, data_quality_score, source_trust_score, grade")
    .in("prospect_id", prospects.map((p: any) => p.id));

  const scoreMap: Record<string, any> = {};
  for (const s of (scores || [])) scoreMap[s.prospect_id] = s;

  // Filter eligible
  const eligible = prospects.filter((p: any) => {
    const sc = scoreMap[p.id];
    if (!sc) return false;
    const totalScore = Math.round((sc.icp_fit_score + sc.signal_score + sc.data_quality_score + sc.source_trust_score) / 4);
    return totalScore >= threshold && (p.confidence || 0) >= 60;
  });

  if (!eligible.length) return 0;

  // Round robin: get SDR list
  let assignedUserId: string | null = null;
  if (autoAssign) {
    const { data: sdrSellers } = await supabase
      .from("sellers")
      .select("id, user_id, name")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("role", "SDR")
      .order("name", { ascending: true });

    if (sdrSellers?.length) {
      const { data: lastOpp } = await supabase
        .from("opportunities")
        .select("owner_user_id")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextIndex = 0;
      if (lastOpp?.owner_user_id) {
        const lastIdx = sdrSellers.findIndex((s: any) => s.user_id === lastOpp.owner_user_id);
        if (lastIdx >= 0) nextIndex = (lastIdx + 1) % sdrSellers.length;
      }
      assignedUserId = sdrSellers[nextIndex].user_id;
    } else {
      // Fallback: any active seller
      const { data: any } = await supabase.from("sellers").select("user_id").eq("organization_id", organizationId).eq("is_active", true).limit(1).maybeSingle();
      assignedUserId = any?.user_id || null;
    }

    if (!assignedUserId) {
      const { data: admin } = await supabase.from("organization_members").select("user_id").eq("organization_id", organizationId).eq("status", "active").in("org_role", ["owner", "admin"]).limit(1).maybeSingle();
      assignedUserId = admin?.user_id || null;
    }
  }

  // Get pipeline for auto-import
  let pipelineId: string | null = null;
  let stageId: string | null = null;
  if (autoCreateOpp) {
    let { data: pipeline } = await supabase.from("pipelines").select("id").eq("organization_id", organizationId).eq("pipeline_type", "qualification").limit(1).maybeSingle();
    if (!pipeline) {
      const { data: fallback } = await supabase.from("pipelines").select("id").eq("organization_id", organizationId).limit(1).maybeSingle();
      pipeline = fallback;
    }
    if (pipeline) {
      pipelineId = pipeline.id;
      const { data: stage } = await supabase.from("stages").select("id").eq("pipeline_id", pipelineId).order("order_index", { ascending: true }).limit(1).maybeSingle();
      stageId = stage?.id || null;
    }
  }

  let imported = 0;
  let currentSdrIndex = -1;

  // If assigning, pre-load SDR list for rotation across prospects
  let sdrList: any[] = [];
  if (autoAssign) {
    const { data: sdrs } = await supabase.from("sellers").select("user_id").eq("organization_id", organizationId).eq("is_active", true).eq("role", "SDR").order("name", { ascending: true });
    sdrList = sdrs || [];
  }

  for (const p of eligible) {
    try {
      // 1. Create or link account
      let accountId = p.matched_account_id;
      if (!accountId) {
        const { data: acc } = await supabase.from("accounts").insert({
          organization_id: organizationId,
          razao_social: p.company_name,
          nome_fantasia: p.company_name,
          website: p.website,
          cidade: p.city,
          uf: p.state,
          segmento: p.industry,
          origem_principal: "lead_sourcing",
          lifecycle_stage: "lead",
        }).select("id").single();
        accountId = acc?.id;
      }

      if (!accountId) continue;

      // 2. Create contact if email/phone available
      let contactId: string | null = null;
      if (p.email_public || p.phone_public) {
        const { data: contact } = await supabase.from("contacts").insert({
          organization_id: organizationId,
          account_id: accountId,
          nome: p.raw_data?.contact_name || p.company_name,
          email: p.email_public,
          telefone: p.phone_public,
          cargo: p.raw_data?.contact_role || null,
        }).select("id").single();
        contactId = contact?.id || null;
      }

      // 3. Create opportunity
      let oppId: string | null = null;
      if (autoCreateOpp && pipelineId && stageId) {
        // Rotate SDR for each prospect
        let ownerUserId = assignedUserId;
        if (sdrList.length > 1) {
          currentSdrIndex = (currentSdrIndex + 1) % sdrList.length;
          ownerUserId = sdrList[currentSdrIndex].user_id;
        }

        const { data: opp } = await supabase.from("opportunities").insert({
          organization_id: organizationId,
          title: `Prospecção: ${p.company_name}`,
          account_id: accountId,
          contact_id: contactId,
          owner_user_id: ownerUserId,
          pipeline_id: pipelineId,
          stage_id: stageId,
          origem: "lead_sourcing",
          fonte: "caramelo",
          status: "open",
          temperature: scoreMap[p.id]?.grade === "A" ? "hot" : scoreMap[p.id]?.grade === "B" ? "warm" : "cold",
          prospect_id: p.id,
          playbook_run_id: runId,
          source_metadata: { source: "lead_sourcing", run_id: runId, auto_imported: true },
        }).select("id").single();
        oppId = opp?.id || null;
      }

      // 4. Update prospect status
      await supabase.from("prospects").update({
        status: "converted",
        approval_status: "imported",
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", p.id);

      imported++;
    } catch (err) {
      console.error(`Auto-import error for prospect ${p.id}:`, err);
    }
  }

  if (imported > 0) {
    await logRunEvent(supabase, organizationId, runId, "info", `Auto-import: ${imported} prospects importados automaticamente`, {
      eligible_count: eligible.length, imported_count: imported, threshold, auto_assign: autoAssign, auto_create_opp: autoCreateOpp,
    });
  }

  return imported;
}

// ── Geo Search Handler ─────────────────────────────────────────────

async function handleGeoSearch(
  supabase: any, run: any, organizationId: string, icpId: string | null,
  config: any, icpContext: string, scoreThreshold: number, accounts: any[], startTime: number
) {
  const { segment, city, state } = config;
  if (!segment && !city) throw new Error("Segmento ou cidade são obrigatórios para busca geográfica");

  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const { data: source } = await supabase.from("lead_sources").insert({
    organization_id: organizationId, playbook_run_id: run.id,
    source_type: "geo_search", source_label: `Busca Geográfica: ${segment || ""} ${city || ""} ${state || ""}`.trim(),
    source_metadata: config,
  }).select().single();

  const query = `empresas de ${segment || "tecnologia"} em ${city || ""} ${state || ""} Brasil`;
  await logRunEvent(supabase, organizationId, run.id, "info", "Iniciando busca geográfica via Firecrawl", { query });

  const results = await firecrawlSearch(FIRECRAWL_API_KEY, query, 8);
  await logRunEvent(supabase, organizationId, run.id, "info", `${results.length} resultados de busca encontrados`);

  // Save source pages
  for (const r of results) {
    if (r.url) {
      await supabase.from("source_pages").insert({
        organization_id: organizationId, lead_source_id: source?.id,
        url: r.url, page_type: "search_result", status: "scraped",
        raw_content: r.markdown?.substring(0, 5000) || null,
      });
    }
  }

  const combinedContent = results
    .map((r: any, i: number) => `[Resultado ${i + 1}] URL: ${r.url || "N/A"}\nTítulo: ${r.title || ""}\n${(r.markdown || r.description || "").substring(0, 3000)}`)
    .join("\n\n---\n\n");

  const companies = await aiExtractCompanies(
    LOVABLE_API_KEY,
    `Você é o Caramelo Agent fazendo prospecção geográfica B2B no Brasil.
Extraia empresas REAIS dos resultados de busca. Nunca invente dados.
Foque em empresas do segmento "${segment || "geral"}" na região de ${city || ""} ${state || ""}.
${icpContext}`,
    `Extraia todas as empresas reais encontradas nos seguintes resultados de busca:\n\n${combinedContent.substring(0, 20000)}`,
    "extract_geo_companies",
    "Extract real companies from geographic search results",
  );

  await logRunEvent(supabase, organizationId, run.id, "info", `${companies.length} empresas extraídas via AI`);

  const created = await saveProspectsFromExtraction(
    supabase, companies, organizationId, run.id, icpId, source?.id,
    `Busca Geográfica: ${city || state || segment}`,
    ["geo_targeted", "found_in_search"],
    accounts,
    (c) => {
      let b = 0;
      if (c.website) b += 10;
      if (c.city && city && c.city.toLowerCase().includes(city.toLowerCase())) b += 10;
      if (c.industry && segment && c.industry.toLowerCase().includes(segment.toLowerCase())) b += 15;
      return b;
    },
  );

  const importRules = config.importRules || {};
  const autoImported = await autoImportEligibleProspects(supabase, organizationId, run.id, importRules);

  const elapsed = Date.now() - startTime;
  const stats = { search_results: results.length, companies_extracted: companies.length, prospects_created: created, auto_imported: autoImported };
  await logRunEvent(supabase, organizationId, run.id, "info", `Concluído: ${created} prospects criados`, stats);
  await supabase.from("playbook_runs").update({
    status: "completed", finished_at: new Date().toISOString(), stats,
    execution_log: [{ step: "geo_search", ...stats, at: new Date().toISOString() }],
    execution_time_ms: elapsed,
  }).eq("id", run.id);

  return new Response(JSON.stringify({ run_id: run.id, prospects_count: created, stats }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ── Directory Search Handler ───────────────────────────────────────

async function handleDirectorySearch(
  supabase: any, run: any, organizationId: string, icpId: string | null,
  config: any, icpContext: string, scoreThreshold: number, accounts: any[], startTime: number
) {
  const directorySource = config.directory_source || "diretório";
  const directoryUrl = config.directory_url || null;

  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const { data: source } = await supabase.from("lead_sources").insert({
    organization_id: organizationId, playbook_run_id: run.id,
    source_type: "directory", source_label: `Diretório: ${directorySource}`,
    source_url: directoryUrl, source_metadata: config,
  }).select().single();

  let combinedContent = "";
  let pagesProcessed = 0;

  if (directoryUrl) {
    // Direct URL crawl: Map + Scrape (similar to event handler)
    await logRunEvent(supabase, organizationId, run.id, "info", "Mapeando URL do diretório", { directoryUrl });

    const formatted = directoryUrl.startsWith("http") ? directoryUrl : `https://${directoryUrl}`;
    const mapResp = await fetch("https://api.firecrawl.dev/v1/map", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: formatted, limit: 100, includeSubdomains: false }),
    });
    const mapData = await mapResp.json();
    const urls: string[] = (mapData.links || mapData.data?.links || []).slice(0, 8);

    await logRunEvent(supabase, organizationId, run.id, "info", `${urls.length} páginas encontradas no diretório`);

    for (const u of urls) {
      try {
        const md = await firecrawlScrape(FIRECRAWL_API_KEY, u);
        if (md) {
          combinedContent += `\n\n--- Página: ${u} ---\n${md.substring(0, 3000)}`;
          pagesProcessed++;
          await supabase.from("source_pages").insert({
            organization_id: organizationId, lead_source_id: source?.id,
            url: u, page_type: "directory_page", status: "scraped", raw_content: md.substring(0, 5000),
          });
        }
      } catch (err) {
        console.error(`Scrape error for ${u}:`, err);
        await logRunEvent(supabase, organizationId, run.id, "warn", `Falha ao scrape: ${u}`, { error: String(err) });
      }
    }
  } else {
    // Search-based discovery
    const query = `${directorySource} empresas Brasil lista diretório`;
    await logRunEvent(supabase, organizationId, run.id, "info", "Buscando diretório via Firecrawl Search", { query });

    const results = await firecrawlSearch(FIRECRAWL_API_KEY, query, 8);
    pagesProcessed = results.length;

    for (const r of results) {
      if (r.url) {
        await supabase.from("source_pages").insert({
          organization_id: organizationId, lead_source_id: source?.id,
          url: r.url, page_type: "search_result", status: "scraped",
          raw_content: r.markdown?.substring(0, 5000) || null,
        });
      }
      combinedContent += `\n\n--- ${r.url || ""} ---\n${(r.markdown || r.description || "").substring(0, 3000)}`;
    }
  }

  await logRunEvent(supabase, organizationId, run.id, "info", `${pagesProcessed} páginas processadas, extraindo empresas via AI`);

  const companies = await aiExtractCompanies(
    LOVABLE_API_KEY,
    `Você é o Caramelo Agent extraindo empresas de diretórios B2B.
Extraia empresas REAIS listadas nos resultados. Nunca invente dados.
Fonte: ${directorySource}.
${icpContext}`,
    `Extraia todas as empresas listadas neste diretório/fonte (${directorySource}):\n\n${combinedContent.substring(0, 20000)}`,
    "extract_directory_companies",
    "Extract real companies from directory listings",
  );

  await logRunEvent(supabase, organizationId, run.id, "info", `${companies.length} empresas extraídas via AI`);

  const created = await saveProspectsFromExtraction(
    supabase, companies, organizationId, run.id, icpId, source?.id,
    `Diretório: ${directorySource}`,
    ["listed_in_directory", "has_public_profile"],
    accounts,
    (c) => {
      let b = 0;
      if (c.website) b += 10;
      if (directoryUrl) b += 10; // official directory bonus
      if (c.description && c.description.length > 20) b += 5;
      return b;
    },
  );

  const importRules = config.importRules || {};
  const autoImported = await autoImportEligibleProspects(supabase, organizationId, run.id, importRules);

  const elapsed = Date.now() - startTime;
  const stats = { pages_processed: pagesProcessed, companies_extracted: companies.length, prospects_created: created, auto_imported: autoImported };
  await logRunEvent(supabase, organizationId, run.id, "info", `Concluído: ${created} prospects criados`, stats);
  await supabase.from("playbook_runs").update({
    status: "completed", finished_at: new Date().toISOString(), stats,
    execution_log: [{ step: "directory_search", ...stats, at: new Date().toISOString() }],
    execution_time_ms: elapsed,
  }).eq("id", run.id);

  return new Response(JSON.stringify({ run_id: run.id, prospects_count: created, stats }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ── Seed Expansion Handler ─────────────────────────────────────────

async function handleSeedExpansion(
  supabase: any, run: any, organizationId: string, icpId: string | null,
  config: any, icpContext: string, scoreThreshold: number, accounts: any[], startTime: number
) {
  const seedCompany = config.seed_company;
  if (!seedCompany) throw new Error("Empresa referência é obrigatória para Seed Expansion");

  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const { data: source } = await supabase.from("lead_sources").insert({
    organization_id: organizationId, playbook_run_id: run.id,
    source_type: "seed_expansion", source_label: `Seed: ${seedCompany}`,
    source_metadata: config,
  }).select().single();

  // Step 1: Search for the seed company to get context
  await logRunEvent(supabase, organizationId, run.id, "info", "Buscando contexto da empresa seed", { seedCompany });

  let seedContext = "";
  try {
    const seedResults = await firecrawlSearch(FIRECRAWL_API_KEY, `${seedCompany} empresa Brasil`, 3);
    if (seedResults.length > 0 && seedResults[0].markdown) {
      seedContext = seedResults[0].markdown.substring(0, 3000);
      await supabase.from("source_pages").insert({
        organization_id: organizationId, lead_source_id: source?.id,
        url: seedResults[0].url || seedCompany, page_type: "seed_context", status: "scraped",
        raw_content: seedContext,
      });
    }
  } catch (err) {
    console.error("Seed context search error:", err);
    await logRunEvent(supabase, organizationId, run.id, "warn", "Falha ao buscar contexto da seed", { error: String(err) });
  }

  // Step 2: Search for similar/competitor companies
  await logRunEvent(supabase, organizationId, run.id, "info", "Buscando empresas similares", { seedCompany });

  const queries = [
    `empresas similares a ${seedCompany} Brasil`,
    `concorrentes de ${seedCompany}`,
  ];

  let allSearchResults: any[] = [];
  for (const q of queries) {
    try {
      const results = await firecrawlSearch(FIRECRAWL_API_KEY, q, 5);
      allSearchResults.push(...results);
    } catch (err) {
      console.error(`Search error for query "${q}":`, err);
      await logRunEvent(supabase, organizationId, run.id, "warn", `Falha na busca: ${q}`, { error: String(err) });
    }
  }

  // Dedupe search results by URL
  const seenUrls = new Set<string>();
  allSearchResults = allSearchResults.filter(r => {
    if (!r.url || seenUrls.has(r.url)) return false;
    seenUrls.add(r.url);
    return true;
  });

  await logRunEvent(supabase, organizationId, run.id, "info", `${allSearchResults.length} resultados únicos encontrados`);

  for (const r of allSearchResults) {
    if (r.url) {
      await supabase.from("source_pages").insert({
        organization_id: organizationId, lead_source_id: source?.id,
        url: r.url, page_type: "competitor_result", status: "scraped",
        raw_content: r.markdown?.substring(0, 5000) || null,
      });
    }
  }

  const combinedContent = allSearchResults
    .map((r: any, i: number) => `[Resultado ${i + 1}] URL: ${r.url || ""}\n${(r.markdown || r.description || "").substring(0, 3000)}`)
    .join("\n\n---\n\n");

  const companies = await aiExtractCompanies(
    LOVABLE_API_KEY,
    `Você é o Caramelo Agent fazendo Seed Expansion B2B.
A empresa referência é "${seedCompany}".
${seedContext ? `Contexto da empresa referência:\n${seedContext}\n` : ""}
Sua tarefa: encontrar empresas REAIS similares ou concorrentes da empresa referência.
Para cada empresa, inclua uma "similarity_reason" explicando POR QUE é similar.
Nunca inclua a própria empresa referência na lista.
Nunca invente dados.
${icpContext}`,
    `Com base nos resultados de busca abaixo, extraia empresas reais que são similares ou concorrentes de "${seedCompany}".\n\n${combinedContent.substring(0, 20000)}`,
    "extract_similar_companies",
    "Extract real companies similar to the reference seed company",
    { similarity_reason: { type: "string" } },
    [],
  );

  await logRunEvent(supabase, organizationId, run.id, "info", `${companies.length} empresas similares extraídas via AI`);

  const created = await saveProspectsFromExtraction(
    supabase, companies, organizationId, run.id, icpId, source?.id,
    `Seed: ${seedCompany}`,
    ["similar_to_reference", "same_segment"],
    accounts,
    (c) => {
      let b = 0;
      if (c.website) b += 10;
      if (c.similarity_reason && c.similarity_reason.length > 10) b += 15;
      if (c.industry) b += 10;
      return b;
    },
  );

  const importRules = config.importRules || {};
  const autoImported = await autoImportEligibleProspects(supabase, organizationId, run.id, importRules);

  const elapsed = Date.now() - startTime;
  const stats = { search_results: allSearchResults.length, companies_extracted: companies.length, prospects_created: created, seed_company: seedCompany, auto_imported: autoImported };
  await logRunEvent(supabase, organizationId, run.id, "info", `Concluído: ${created} prospects criados`, stats);
  await supabase.from("playbook_runs").update({
    status: "completed", finished_at: new Date().toISOString(), stats,
    execution_log: [{ step: "seed_expansion", ...stats, at: new Date().toISOString() }],
    execution_time_ms: elapsed,
  }).eq("id", run.id);

  return new Response(JSON.stringify({ run_id: run.id, prospects_count: created, stats }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
