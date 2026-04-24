import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";


const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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

    const executeRun = async () => {
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
    };

    if (searchType === "event") {
      EdgeRuntime.waitUntil(executeRun());

      return new Response(
        JSON.stringify({
          run_id: run.id,
          status: "running",
          async: true,
          message: "Lead sourcing iniciado em background",
        }),
        {
          status: 202,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return await executeRun();

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

// ── Event Firecrawl Handler (v2 — distributed scraping + chunked extraction) ──

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
  // ── Sanitização defensiva da URL do evento ──
  // Protege contra inputs como "https://x.com/lista e validar que ..."
  // Também garante protocolo e remove caracteres finais perigosos.
  const rawEventUrl = String(config.event_url || "").trim();
  const firstToken = rawEventUrl.split(/\s+/)[0] || "";
  const trimmedTrailing = firstToken.replace(/[",;]+$/g, "");
  const ensuredProtocol = /^https?:\/\//i.test(trimmedTrailing) ? trimmedTrailing : (trimmedTrailing ? `https://${trimmedTrailing}` : "");

  let eventUrl = "";
  try {
    if (ensuredProtocol) {
      const u = new URL(ensuredProtocol);
      if (["http:", "https:"].includes(u.protocol) && u.hostname.includes(".")) {
        eventUrl = u.toString();
      }
    }
  } catch {
    eventUrl = "";
  }

  const eventName = config.event_name || "Evento";
  const executionLog: any[] = [];

  // Detailed metrics
  const metrics: Record<string, any> = {
    pages_discovered: 0,
    profile_links_discovered: 0,
    list_pages_scraped: 0,
    profile_pages_scraped: 0,
    scrape_failures: 0,
    ai_chunks_processed: 0,
    exhibitors_extracted_raw: 0,
    html_hybrid_extracted: 0,
    markdown_pattern_extracted: 0,
    deduped_in_run: 0,
    discarded_below_score: 0,
    score_threshold_used: scoreThreshold,
    persisted_prospects: 0,
    auto_imported: 0,
    sanitized_event_url: eventUrl,
    raw_event_url: rawEventUrl,
  };

  if (!eventUrl) {
    const errorMsg = rawEventUrl
      ? `URL do evento inválida: "${rawEventUrl.substring(0, 120)}". Cole apenas o link completo da página de expositores.`
      : "URL do evento é obrigatória.";
    await logRunEvent(supabase, organizationId, run.id, "error", errorMsg, { rawEventUrl });
    await supabase.from("playbook_runs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error_summary: errorMsg,
      execution_time_ms: Date.now() - startTime,
      stats: metrics,
    }).eq("id", run.id);
    return new Response(JSON.stringify({ error: errorMsg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (rawEventUrl !== eventUrl) {
    await logRunEvent(supabase, organizationId, run.id, "info", "URL do evento normalizada", { rawEventUrl, eventUrl });
  }

  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) {
    await supabase.from("playbook_runs").update({ status: "failed", finished_at: new Date().toISOString(), error_summary: "FIRECRAWL_API_KEY not configured", execution_time_ms: Date.now() - startTime }).eq("id", run.id);
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
    source_metadata: { ...config, sanitized_event_url: eventUrl },
  }).select().single();

  // ── Step 1: Map — discover all URLs ──
  await logRunEvent(supabase, organizationId, run.id, "info", "Mapeando URL do evento", { eventUrl });
  let discoveredUrls: string[] = [];
  try {
    const formattedUrl = eventUrl.startsWith("http") ? eventUrl : `https://${eventUrl}`;
    const mapResp = await fetch("https://api.firecrawl.dev/v1/map", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: formattedUrl, limit: 5000, includeSubdomains: false }),
    });
    const mapData = await mapResp.json();
    discoveredUrls = mapData.links || mapData.data?.links || [];

    // Targeted search maps
    const searchTerms = ["exhibitor", "expositor", "brand", "marca"];
    for (const term of searchTerms) {
      try {
        const searchMapResp = await fetch("https://api.firecrawl.dev/v1/map", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: formattedUrl, limit: 5000, includeSubdomains: false, search: term }),
        });
        const searchMapData = await searchMapResp.json();
        const extraLinks = searchMapData.links || searchMapData.data?.links || [];
        for (const link of extraLinks) {
          if (!discoveredUrls.includes(link)) discoveredUrls.push(link);
        }
      } catch (searchErr) {
        console.warn("Search map fallback error:", searchErr);
      }
    }

    metrics.pages_discovered = discoveredUrls.length;
    executionLog.push({ step: "firecrawl_map", pages_discovered: discoveredUrls.length, at: new Date().toISOString() });
    await logRunEvent(supabase, organizationId, run.id, "info", `${discoveredUrls.length} páginas descobertas`, { pages: discoveredUrls.length });
  } catch (err) {
    console.error("Firecrawl map error:", err);
    await logRunEvent(supabase, organizationId, run.id, "error", "Erro no mapeamento Firecrawl", { error: String(err) });
  }

  // ── Step 2: Classify URLs ──
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
  let relevantPages = classified.filter(p => p.page_type !== "irrelevant" && p.page_type !== "unknown");

  // ── Step 2b: Detect pagination ──
  const listPages = relevantPages.filter(p => p.page_type === "exhibitors_list");
  const paginatedUrls = new Set<string>();

  for (const page of listPages) {
    const numericMatch = page.url.match(/([?&](page|p|pg|pagina)=)(\d+)/i);
    if (numericMatch) {
      const prefix = page.url.substring(0, page.url.indexOf(numericMatch[0]));
      const paramPart = numericMatch[1];
      const pageNum = parseInt(numericMatch[3]);
      const maxPage = Math.max(pageNum, 50);
      for (let i = 1; i <= maxPage; i++) {
        paginatedUrls.add(prefix + paramPart + i + page.url.substring(page.url.indexOf(numericMatch[0]) + numericMatch[0].length));
      }
    }
    const pathMatch = page.url.match(/(\/(?:page|pagina))\/([\d]+)/i);
    if (pathMatch) {
      const base = page.url.substring(0, page.url.indexOf(pathMatch[0]));
      const suffix = page.url.substring(page.url.indexOf(pathMatch[0]) + pathMatch[0].length);
      const maxPage = Math.max(parseInt(pathMatch[2]), 50);
      for (let i = 1; i <= maxPage; i++) paginatedUrls.add(`${base}${pathMatch[1]}/${i}${suffix}`);
    }
    const letterMatch = page.url.match(/([?&](letter|letra|alpha)=)([A-Za-z])/i);
    if (letterMatch) {
      const prefix = page.url.substring(0, page.url.indexOf(letterMatch[0]));
      const paramPart = letterMatch[1];
      const suffix = page.url.substring(page.url.indexOf(letterMatch[0]) + letterMatch[0].length);
      for (let c = 65; c <= 90; c++) paginatedUrls.add(`${prefix}${paramPart}${String.fromCharCode(c)}${suffix}`);
    }
    const alphaPathMatch = page.url.match(/(\/(?:exhibitor|expositor|brand|marca)[es]*)\/([\dA-Z])(?:\/|$)/i);
    if (alphaPathMatch) {
      const base = page.url.substring(0, page.url.indexOf(alphaPathMatch[0]));
      const pathPrefix = alphaPathMatch[1];
      const suffix = page.url.substring(page.url.indexOf(alphaPathMatch[0]) + alphaPathMatch[0].length);
      for (let c = 65; c <= 90; c++) paginatedUrls.add(`${base}${pathPrefix}/${String.fromCharCode(c)}${suffix}`);
      for (let n = 0; n <= 9; n++) paginatedUrls.add(`${base}${pathPrefix}/${n}${suffix}`);
    }
  }

  const existingUrls = new Set(relevantPages.map(p => p.url));
  let paginatedAdded = 0;
  for (const pUrl of paginatedUrls) {
    if (!existingUrls.has(pUrl)) { relevantPages.push({ url: pUrl, page_type: "exhibitors_list" }); paginatedAdded++; }
  }

  if (paginatedAdded > 0) {
    await logRunEvent(supabase, organizationId, run.id, "info", `${paginatedAdded} páginas de paginação geradas`, { paginatedAdded });
  }

  // ── Fallback SPA: garantir que o eventUrl em si seja sempre uma página de lista ──
  // Sites Angular/React (ex: bettshow.com) frequentemente expõem zero links no map.
  // Sem isto, listPagesToScrape ficaria vazio e nunca entraríamos nas estratégias de SPA.
  const formattedEventUrl = eventUrl.startsWith("http") ? eventUrl : `https://${eventUrl}`;
  if (!existingUrls.has(formattedEventUrl) && !relevantPages.some(p => p.url === formattedEventUrl)) {
    relevantPages.push({ url: formattedEventUrl, page_type: "exhibitors_list" });
    await logRunEvent(supabase, organizationId, run.id, "info", "URL principal adicionada como página de lista (fallback SPA)", { eventUrl: formattedEventUrl });
  }

  // Count profile links from map
  const profilePages = relevantPages.filter(p => p.page_type === "exhibitor_profile");
  metrics.profile_links_discovered = profilePages.length;

  for (const page of classified.filter(p => p.page_type !== "irrelevant")) {
    await supabase.from("source_pages").insert({
      organization_id: organizationId, lead_source_id: source?.id,
      playbook_run_id: run.id,
      url: page.url, page_type: page.page_type, status: "discovered",
    });
  }

  executionLog.push({ step: "classify_pages", total: classified.length, relevant: relevantPages.length, profiles_from_map: profilePages.length, paginated_added: paginatedAdded, at: new Date().toISOString() });
  await logRunEvent(supabase, organizationId, run.id, "info", `${relevantPages.length} páginas relevantes (${profilePages.length} perfis, ${listPages.length + paginatedAdded} listas)`, { relevant: relevantPages.length });

  // ── Step 3: Scrape list pages first (get HTML too for link extraction) ──
  const listPagesToScrape = relevantPages.filter(p => p.page_type === "exhibitors_list");
  const scrapedContents: Array<{ url: string; markdown: string; html: string; page_type: string }> = [];
  const profileLinksFromHtml = new Set<string>();

  // Scrape ALL list pages (no hard cap)
  const maxListPages = Math.min(listPagesToScrape.length, 100);
  await logRunEvent(supabase, organizationId, run.id, "info", `Scraping ${maxListPages} list pages`, { total_list_pages: listPagesToScrape.length });

  for (let i = 0; i < maxListPages; i++) {
    const page = listPagesToScrape[i];
    try {
      const scrollActions: any[] = [];
      for (let s = 0; s < 60; s++) {
        scrollActions.push({ type: "scroll", direction: "down", amount: 5 });
        scrollActions.push({ type: "wait", milliseconds: 1200 });
      }
      const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url: page.url,
          formats: ["markdown", "html"],
          onlyMainContent: true,
          waitFor: 2000,
          actions: scrollActions,
          timeout: 120000,
        }),
      });
      const scrapeData = await scrapeResp.json();
      const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
      const html = scrapeData.data?.html || scrapeData.html || "";

      if (markdown || html) {
        scrapedContents.push({ url: page.url, markdown, html, page_type: page.page_type });
        metrics.list_pages_scraped++;

        // Extract exhibitor profile links from HTML
        const linkMatches = html.matchAll(/href=["']([^"']*(?:exhibitor|expositor|brand|empresa|company)[^"']*)/gi);
        for (const m of linkMatches) {
          let href = m[1];
          if (href.startsWith("/")) {
            try { const u = new URL(page.url); href = u.origin + href; } catch {}
          }
          if (href.startsWith("http")) profileLinksFromHtml.add(href);
        }

        // Also extract from markdown links [text](url)
        const mdLinkMatches = markdown.matchAll(/\[([^\]]*)\]\(([^)]*(?:exhibitor|expositor|brand)[^)]*)\)/gi);
        for (const m of mdLinkMatches) {
          let href = m[2];
          if (href.startsWith("/")) {
            try { const u = new URL(page.url); href = u.origin + href; } catch {}
          }
          if (href.startsWith("http")) profileLinksFromHtml.add(href);
        }

        await supabase.from("source_pages").update({ status: "scraped", raw_content: markdown.substring(0, 10000) }).eq("url", page.url).eq("lead_source_id", source?.id);
      }
    } catch (err) {
      console.error(`Scrape error for ${page.url}:`, err);
      metrics.scrape_failures++;
      await supabase.from("source_pages").update({ status: "failed" }).eq("url", page.url).eq("lead_source_id", source?.id);
      await logRunEvent(supabase, organizationId, run.id, "warn", `Falha ao scrape: ${page.url}`, { error: String(err) });
    }
  }

  // ── Step 3a: SPA A-Z filter re-scrape strategy ──
  // Detecta SPA quando: poucos URLs no map OU poucos chars retornados no scrape inicial.
  // Isso cobre Angular/React/Vue (ex: bettshow.com) que renderizam tudo via JS.
  const totalScrapedChars = scrapedContents.reduce((acc, c) => acc + (c.markdown?.length || 0) + (c.html?.length || 0), 0);
  const isSpaLike = (discoveredUrls.length <= 5) || (metrics.list_pages_scraped >= 1 && totalScrapedChars < 2000);
  if (isSpaLike && scrapedContents.length > 0) {
    const firstContent = scrapedContents[0];
    const firstHtml = firstContent.html || "";
    const firstMd = firstContent.markdown || "";

    // Detect A-Z filter links in HTML or markdown
    const hasAlphaFilter = /class="[^"]*(?:alpha|letter|filter|az)[^"]*"/i.test(firstHtml) ||
      /(?:data-letter|data-filter)="[A-Z]"/i.test(firstHtml) ||
      /<a[^>]*>[A-Z]<\/a>/g.test(firstHtml) ||
      /(?:filtrar|filter).*(?:por letra|by letter|a-z)/i.test(firstHtml) ||
      /\b[A-Z]\b\s*\|\s*\b[A-Z]\b\s*\|\s*\b[A-Z]\b/.test(firstMd); // "A | B | C" in markdown

    // For known SPA event hosts, force the A-Z strategy even without explicit detection
    const eventHost = (() => { try { return new URL(formattedEventUrl).hostname.toLowerCase(); } catch { return ""; } })();
    const knownSpaHosts = ["bettshow.com", "brasil.bettshow.com"];
    const forceAlphaStrategy = knownSpaHosts.some(h => eventHost.endsWith(h));

    if (hasAlphaFilter || forceAlphaStrategy) {
      await logRunEvent(supabase, organizationId, run.id, "info", "SPA detectada com filtro A-Z, fazendo scrapes por letra (stealth proxy)");

      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
      for (const letter of letters) {
        try {
          const letterActions: any[] = [
            { type: "wait", milliseconds: 2500 },
            { type: "click", selector: `a[data-letter="${letter}"], a[data-filter="${letter}"], a[href*="letter=${letter}"], a[href*="letra=${letter}"], button[data-letter="${letter}"], .alpha-filter a:has-text("${letter}"), .filter-letter:has-text("${letter}"), a.letter-filter[href*="${letter.toLowerCase()}"], li:has-text("${letter}") > a` },
            { type: "wait", milliseconds: 3500 },
          ];
          // Scroll after clicking to trigger lazy loaders
          for (let s = 0; s < 30; s++) {
            letterActions.push({ type: "scroll", direction: "down", amount: 5 });
            letterActions.push({ type: "wait", milliseconds: 800 });
          }

          // Use Firecrawl v2 with stealth proxy for better SPA rendering
          const scrapeResp = await fetch("https://api.firecrawl.dev/v2/scrape", {
            method: "POST",
            headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              url: firstContent.url,
              formats: ["markdown", "html"],
              onlyMainContent: false,
              waitFor: 4000,
              actions: letterActions,
              proxy: "stealth",
              timeout: 180000,
            }),
          });
          const scrapeData = await scrapeResp.json();
          const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
          const html = scrapeData.data?.html || scrapeData.html || "";
          if ((markdown && markdown.length > 100) || (html && html.length > 500)) {
            scrapedContents.push({ url: `${firstContent.url}#letter-${letter}`, markdown, html, page_type: "exhibitors_list" });
          }
        } catch (letterErr) {
          console.warn(`A-Z scrape failed for letter ${letter}:`, letterErr);
        }
      }
      await logRunEvent(supabase, organizationId, run.id, "info", `Scrapes A-Z concluídos, total de ${scrapedContents.length} conteúdos`);
    } else {
      // No A-Z filter found — do a deep scrape with stealth proxy + 120 scrolls
      await logRunEvent(supabase, organizationId, run.id, "info", "SPA sem filtro A-Z detectado, fazendo scrape profundo com stealth proxy");
      try {
        const deepScrollActions: any[] = [];
        for (let s = 0; s < 120; s++) {
          deepScrollActions.push({ type: "scroll", direction: "down", amount: 5 });
          deepScrollActions.push({ type: "wait", milliseconds: 1000 });
        }
        const scrapeResp = await fetch("https://api.firecrawl.dev/v2/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            url: firstContent.url,
            formats: ["markdown", "html"],
            onlyMainContent: false,
            waitFor: 4000,
            actions: deepScrollActions,
            proxy: "stealth",
            timeout: 300000,
          }),
        });
        const scrapeData = await scrapeResp.json();
        const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
        const html = scrapeData.data?.html || scrapeData.html || "";
        if (markdown && markdown.length > firstContent.markdown.length * 1.1) {
          scrapedContents[0] = { ...firstContent, markdown, html: html || firstContent.html };
          await logRunEvent(supabase, organizationId, run.id, "info", `Deep scroll trouxe ${markdown.length} chars vs ${firstContent.markdown.length} original`);
        }
      } catch (deepErr) {
        console.warn("Deep scroll scrape failed:", deepErr);
      }
    }
  }

  // Merge profile links from HTML with those from map
  const allProfileUrls = new Set<string>(profilePages.map(p => p.url));
  for (const link of profileLinksFromHtml) {
    allProfileUrls.add(link);
  }
  metrics.profile_links_discovered = allProfileUrls.size;

  await logRunEvent(supabase, organizationId, run.id, "info", `${metrics.list_pages_scraped} list pages scraped, ${allProfileUrls.size} profile links discovered (${profileLinksFromHtml.size} from HTML)`, {
    list_pages_scraped: metrics.list_pages_scraped,
    profile_links_total: allProfileUrls.size,
    profile_links_from_html: profileLinksFromHtml.size,
  });

  // ── Step 3b: Scrape exhibitor profile pages (up to 500) ──
  const profilesToScrape = Array.from(allProfileUrls).slice(0, 500);
  if (profilesToScrape.length > 0) {
    await logRunEvent(supabase, organizationId, run.id, "info", `Scraping ${profilesToScrape.length} exhibitor profiles`);

    // Batch scrape profiles (lightweight, no scroll needed)
    for (const profileUrl of profilesToScrape) {
      try {
        const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: profileUrl, formats: ["markdown"], onlyMainContent: true, waitFor: 1000 }),
        });
        const scrapeData = await scrapeResp.json();
        const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
        if (markdown && markdown.length > 50) {
          scrapedContents.push({ url: profileUrl, markdown, html: "", page_type: "exhibitor_profile" });
          metrics.profile_pages_scraped++;
        }
      } catch (err) {
        metrics.scrape_failures++;
      }
    }

    await logRunEvent(supabase, organizationId, run.id, "info", `${metrics.profile_pages_scraped} profiles scraped successfully`);
  }

  executionLog.push({ step: "scraping_complete", list_scraped: metrics.list_pages_scraped, profiles_scraped: metrics.profile_pages_scraped, scrape_failures: metrics.scrape_failures, at: new Date().toISOString() });

  // ── Step 4: AI extraction with CHUNKING ──
  const allExhibitors: any[] = [];
  const CHUNK_SIZE = 40000; // chars per AI call

  for (const scraped of scrapedContents) {
    const content = scraped.markdown;
    if (!content || content.length < 30) continue;

    // Split into chunks if content is large
    const chunks: string[] = [];
    if (content.length <= CHUNK_SIZE) {
      chunks.push(content);
    } else {
      // Split at paragraph boundaries
      let pos = 0;
      while (pos < content.length) {
        let end = Math.min(pos + CHUNK_SIZE, content.length);
        if (end < content.length) {
          // Find a good split point (double newline or single newline)
          const lastDoubleNl = content.lastIndexOf("\n\n", end);
          const lastNl = content.lastIndexOf("\n", end);
          if (lastDoubleNl > pos + CHUNK_SIZE * 0.5) end = lastDoubleNl;
          else if (lastNl > pos + CHUNK_SIZE * 0.5) end = lastNl;
        }
        chunks.push(content.substring(pos, end));
        pos = end;
      }
    }

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      try {
        const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-5-mini",
            messages: [
              {
                role: "system",
                content: `Você é o Caramelo Agent, executando extração de expositores de evento.
Extraia TODAS as empresas expositoras mencionadas no conteúdo. Não pule nenhuma.
Extraia apenas empresas reais. Nunca invente dados.
Marque confidence com base na evidência disponível.
${icpContext}`,
              },
              {
                role: "user",
                content: `Extraia TODAS as empresas expositoras desta página (${eventName}).
URL: ${scraped.url}
Tipo: ${scraped.page_type}
Chunk ${ci + 1}/${chunks.length} (${chunk.length} chars):

${chunk}`,
              },
            ],
            tools: [{
              type: "function",
              function: {
                name: "extract_exhibitors",
                description: "Extract ALL exhibitor companies from event page content",
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
          await logRunEvent(supabase, organizationId, run.id, "warn", `Erro na extração AI chunk ${ci + 1}: ${aiResp.status}`, { url: scraped.url });
        }
        metrics.ai_chunks_processed++;
      } catch (err) {
        console.error(`AI extraction error for ${scraped.url} chunk ${ci}:`, err);
        await logRunEvent(supabase, organizationId, run.id, "warn", `Erro na extração AI: ${scraped.url}`, { error: String(err) });
      }
    }
  }

  metrics.exhibitors_extracted_raw = allExhibitors.length;
  executionLog.push({ step: "ai_extraction", chunks_processed: metrics.ai_chunks_processed, exhibitors_extracted: allExhibitors.length, at: new Date().toISOString() });
  await logRunEvent(supabase, organizationId, run.id, "info", `${allExhibitors.length} expositores extraídos de ${metrics.ai_chunks_processed} chunks`);

  // ── Step 4b: Hybrid HTML extraction fallback ──
  // If AI extracted few results but HTML has many repeated patterns, extract deterministically
  if (allExhibitors.length < 50 && scrapedContents.length > 0) {
    await logRunEvent(supabase, organizationId, run.id, "info", "AI extraiu poucos resultados, tentando extração híbrida do HTML");
    let htmlCandidates = 0;

    for (const scraped of scrapedContents) {
      const html = scraped.html || "";
      const markdown = scraped.markdown || "";
      if (!html && !markdown) continue;

      // Strategy 1: Extract company names from repeated card-like HTML patterns
      // Look for repeated elements with company-like text
      const cardPatterns = [
        // Common exhibitor card patterns
        /<(?:h[2-4]|strong|b|span|div|a)[^>]*class="[^"]*(?:exhibitor|company|brand|nome|title|name)[^"]*"[^>]*>([^<]{3,80})<\//gi,
        // Links with exhibitor/company names
        /<a[^>]*>([A-Z][A-Za-zÀ-ÿ\s&.,'-]{2,60})<\/a>/g,
        // Strong/bold text that looks like company names (at least 3 chars, starts with uppercase)
        /<(?:strong|b)>([A-Z][A-Za-zÀ-ÿ\s&.,'-]{2,60})<\/(?:strong|b)>/g,
      ];

      const htmlNames = new Set<string>();
      for (const pattern of cardPatterns) {
        const matches = html.matchAll(pattern);
        for (const m of matches) {
          const name = m[1].trim();
          if (name.length >= 3 && name.length <= 80 && /[A-ZÀ-Ÿ]/.test(name[0])) {
            htmlNames.add(name);
          }
        }
      }

      // Strategy 2: Extract from markdown lines that look like company entries
      const mdLines = markdown.split("\n");
      for (const line of mdLines) {
        const trimmed = line.trim();
        // Lines that are short, start with uppercase, look like a company name
        if (trimmed.length >= 3 && trimmed.length <= 80 && /^[A-ZÀ-Ÿ]/.test(trimmed) && !/^#{1,6}\s/.test(trimmed)) {
          // Filter out common non-company text
          if (!/^(Home|Menu|Contact|Login|Sign|About|Privacy|Terms|FAQ|Search|Filter|Page|Next|Prev|Ver|Mais|Todos|All|Show)/i.test(trimmed)) {
            htmlNames.add(trimmed.replace(/\*\*/g, "").trim());
          }
        }
        // Also extract from markdown list items: - **Company Name**
        const listMatch = trimmed.match(/^[-*]\s+\*?\*?([A-ZÀ-Ÿ][A-Za-zÀ-ÿ\s&.,'-]{2,60})\*?\*?\s*$/);
        if (listMatch) htmlNames.add(listMatch[1].trim());
      }

      // Add HTML-extracted names that aren't already in allExhibitors
      const existingNames = new Set(allExhibitors.map((e: any) => normalizeCompanyName(e.company_name || "")));
      for (const name of htmlNames) {
        const normalized = normalizeCompanyName(name);
        if (!existingNames.has(normalized) && normalized.length >= 3) {
          allExhibitors.push({
            company_name: name,
            website: null,
            category: null,
            description: null,
            booth: null,
            country: null,
            city: null,
            exhibitor_profile_url: null,
            signals: ["html_extracted"],
            confidence: 40,
            _source_url: scraped.url,
            _page_type: scraped.page_type,
            _extraction_method: "html_hybrid",
          });
          existingNames.add(normalized);
          htmlCandidates++;
        }
      }
    }

    if (htmlCandidates > 0) {
      await logRunEvent(supabase, organizationId, run.id, "info", `Extração híbrida: ${htmlCandidates} candidatos adicionais do HTML`, { htmlCandidates });
      metrics.exhibitors_extracted_raw = allExhibitors.length;
    }
  }

  // ── Step 5: Deduplicate intra-run and apply score threshold ──
  const seenNames = new Set<string>();
  const seenDomains = new Set<string>();
  const seenProfileUrls = new Set<string>();
  let prospectsCreated = 0;

  const candidates: Array<{
    candidateKey: string;
    companyName: string;
    normalizedName: string;
    domain: string | null;
    website: string | null;
    dedupe: DedupeResult;
    rawData: any;
    sourceUrl: string | null;
    country: string | null;
    city: string | null;
    industry: string | null;
    summary: string | null;
    confidence: number | null;
    exhibitorProfileUrl: string | null;
    booth: string | null;
    icpFit: number;
    signalScore: number;
    dataQuality: number;
    sourceTrust: number;
    grade: string;
    totalScore: number;
    eventBonus: number;
    exSignals: string[];
  }> = [];

  for (const ex of allExhibitors) {
    const companyName = ex.company_name?.trim();
    if (!companyName || companyName.length < 2) continue;

    const normalizedName = normalizeCompanyName(companyName);

    // Intra-run dedupe by name + domain + profile URL
    if (seenNames.has(normalizedName)) { metrics.deduped_in_run++; continue; }

    const domain = extractDomain(ex.website || "");
    if (domain && seenDomains.has(domain)) { metrics.deduped_in_run++; continue; }

    const profileUrl = ex.exhibitor_profile_url || null;
    if (profileUrl && seenProfileUrls.has(profileUrl)) { metrics.deduped_in_run++; continue; }

    seenNames.add(normalizedName);
    if (domain) seenDomains.add(domain);
    if (profileUrl) seenProfileUrls.add(profileUrl);

    const website = ex.website || (domain ? `https://${domain}` : null);
    const exSignals: string[] = ex.signals || [];

    exSignals.push("participates_in_events");
    if (ex._page_type === "exhibitors_list" || ex._page_type === "exhibitor_profile") exSignals.push("listed_in_official_directory");
    if (ex.booth) exSignals.push("has_booth");
    if (exSignals.some((s: string) => /demo|showcase|product/i.test(s))) exSignals.push("has_product_showcase");

    let eventBonus = 0;
    if (exSignals.includes("listed_in_official_directory")) eventBonus += 10;
    if (ex.exhibitor_profile_url) eventBonus += 10;
    if (ex.booth) eventBonus += 5;
    if (website) eventBonus += 10;
    if (ex.description && ex.description.length > 30) eventBonus += 5;
    if (exSignals.includes("has_product_showcase") || exSignals.some((s: string) => /demo|live/i.test(s))) eventBonus += 10;

    // Event-optimized scoring: event exhibitors are inherently high-quality leads
    const icpFit = Math.min(100, (ex.confidence || 50) + eventBonus);
    const dataQuality = Math.min(100, (website ? 20 : 0) + (ex.city ? 10 : 0) + (ex.description ? 10 : 0) + (companyName ? 10 : 0) + (ex.category ? 5 : 0) + (ex.booth ? 5 : 0));
    const signalScore = Math.min(100, exSignals.length * 12);
    // Event source trust is HIGH — companies paid to be listed in an official event directory
    const sourceTrust = 85;
    // Weighted average: source trust and ICP fit matter more for events
    const totalScore = Math.round((icpFit * 0.3 + signalScore * 0.2 + dataQuality * 0.15 + sourceTrust * 0.35) * 1);
    const grade = gradeFromScore(totalScore);

    // ── Apply score threshold ──
    if (scoreThreshold > 0 && totalScore < scoreThreshold) {
      metrics.discarded_below_score++;
      continue;
    }

    const dedupe = await dedupeProspect(supabase, organizationId, normalizedName, domain, ex.city || null, accounts);

    candidates.push({
      candidateKey: crypto.randomUUID(),
      companyName,
      normalizedName,
      domain,
      website,
      dedupe,
      rawData: ex,
      sourceUrl: ex._source_url || eventUrl,
      country: ex.country || null,
      city: ex.city || null,
      industry: ex.category || null,
      summary: ex.description || null,
      confidence: ex.confidence || null,
      exhibitorProfileUrl: ex.exhibitor_profile_url || null,
      booth: ex.booth || null,
      icpFit,
      signalScore,
      dataQuality,
      sourceTrust,
      grade,
      totalScore,
      eventBonus,
      exSignals: [...new Set(exSignals)],
    });
  }

  const candidateBatches = chunkArray(candidates, 25);

  for (let batchIndex = 0; batchIndex < candidateBatches.length; batchIndex++) {
    const batch = candidateBatches[batchIndex];
    const prospectRows = batch.map((candidate) => ({
      organization_id: organizationId,
      playbook_run_id: run.id,
      icp_profile_id: icpId,
      source_id: source?.id || null,
      company_name: candidate.companyName,
      normalized_company_name: candidate.normalizedName,
      website: candidate.website,
      normalized_domain: candidate.domain,
      industry: candidate.industry,
      country: candidate.country,
      city: candidate.city,
      summary: candidate.summary,
      status: "review_pending",
      confidence: candidate.confidence,
      source_label: eventName,
      source_url: candidate.sourceUrl,
      raw_data: { ...candidate.rawData, _candidate_key: candidate.candidateKey },
      event_name: eventName,
      event_url: eventUrl,
      exhibitor_profile_url: candidate.exhibitorProfileUrl,
      booth: candidate.booth,
      matched_account_id: candidate.dedupe.matched_account_id,
      dedupe_status: candidate.dedupe.dedupe_status,
      duplicate_candidate: candidate.dedupe.duplicate_candidate,
      review_needed: candidate.dedupe.review_needed,
      approval_status: "pending",
    }));

    let insertedProspects: Array<{ id: string; raw_data: any }> = [];

    const { data: bulkInsertedProspects, error: bulkInsertError } = await supabase
      .from("prospects")
      .insert(prospectRows)
      .select("id, raw_data");

    if (bulkInsertError) {
      console.error("Bulk prospect insert error:", bulkInsertError);

      for (const row of prospectRows) {
        const { data: singleInserted, error: singleInsertError } = await supabase
          .from("prospects")
          .insert(row)
          .select("id, raw_data")
          .single();

        if (singleInsertError) {
          console.error("Single prospect insert error:", singleInsertError);
          continue;
        }

        insertedProspects.push(singleInserted);
      }
    } else {
      insertedProspects = bulkInsertedProspects || [];
    }

    const prospectIdByCandidateKey = new Map<string, string>();
    for (const inserted of insertedProspects) {
      const candidateKey = inserted.raw_data?._candidate_key;
      if (candidateKey) prospectIdByCandidateKey.set(candidateKey, inserted.id);
    }

    prospectsCreated += insertedProspects.length;
    metrics.persisted_prospects = prospectsCreated;
    metrics.prospects_created = prospectsCreated;
    metrics.prospects_count = prospectsCreated;

    const scoreRows = batch
      .map((candidate) => {
        const prospectId = prospectIdByCandidateKey.get(candidate.candidateKey);
        if (!prospectId) return null;

        return {
          organization_id: organizationId,
          prospect_id: prospectId,
          icp_fit_score: candidate.icpFit,
          signal_score: candidate.signalScore,
          data_quality_score: candidate.dataQuality,
          source_trust_score: candidate.sourceTrust,
          penalty_score: 0,
          reasoning: {
            summary: `Expositor do evento ${eventName}. Score ${candidate.totalScore}: ${candidate.exSignals.slice(0, 5).join(", ")}`,
            signals: candidate.exSignals,
            event_bonus: candidate.eventBonus,
            dedupe: candidate.dedupe.match_type ? { status: candidate.dedupe.dedupe_status, match_type: candidate.dedupe.match_type } : null,
          },
          grade: candidate.grade,
        };
      })
      .filter(Boolean);

    if (scoreRows.length > 0) {
      const { error: scoreInsertError } = await supabase.from("prospect_scores").insert(scoreRows);
      if (scoreInsertError) {
        console.error("Bulk score insert error:", scoreInsertError);
        for (const scoreRow of scoreRows) {
          await supabase.from("prospect_scores").insert(scoreRow);
        }
      }
    }

    const signalRows = batch.flatMap((candidate) => {
      const prospectId = prospectIdByCandidateKey.get(candidate.candidateKey);
      if (!prospectId) return [];

      return candidate.exSignals.map((sig) => ({
        organization_id: organizationId,
        prospect_id: prospectId,
        signal_type: sig,
        signal_value: "true",
        weight: sig === "listed_in_official_directory" ? 10 : sig === "has_booth" ? 5 : sig === "participates_in_events" ? 10 : sig === "has_product_showcase" ? 10 : 5,
        confidence: candidate.confidence || 50,
        source_reference: `firecrawl_event_${eventName}`,
      }));
    });

    for (const signalChunk of chunkArray(signalRows, 200)) {
      if (!signalChunk.length) continue;
      const { error: signalInsertError } = await supabase.from("prospect_signals").insert(signalChunk);
      if (signalInsertError) {
        console.error("Bulk signal insert error:", signalInsertError);
        for (const signalRow of signalChunk) {
          await supabase.from("prospect_signals").insert(signalRow);
        }
      }
    }

    await supabase.from("playbook_runs").update({
      stats: { ...metrics },
      execution_time_ms: Date.now() - startTime,
    }).eq("id", run.id);

    await logRunEvent(
      supabase,
      organizationId,
      run.id,
      "info",
      `Persistência em lote ${batchIndex + 1}/${candidateBatches.length}`,
      {
        persisted_prospects: prospectsCreated,
        candidate_count: candidates.length,
        batch_size: batch.length,
      }
    );
  }

  metrics.persisted_prospects = prospectsCreated;
  metrics.prospects_created = prospectsCreated;
  metrics.prospects_count = prospectsCreated;
  executionLog.push({ step: "prospects_created", count: prospectsCreated, deduped: metrics.deduped_in_run, discarded_by_score: metrics.discarded_below_score, at: new Date().toISOString() });

  // Auto-import eligible prospects
  const importRules = config.importRules || {};
  const autoImported = await autoImportEligibleProspects(supabase, organizationId, run.id, importRules);
  metrics.auto_imported = autoImported;

  const elapsed = Date.now() - startTime;

  // Warn if we extracted but persisted 0
  if (prospectsCreated === 0 && metrics.exhibitors_extracted_raw > 0) {
    const warnMsg = metrics.discarded_below_score > 0
      ? `⚠️ ${metrics.exhibitors_extracted_raw} expositores extraídos mas TODOS removidos pelo score threshold (${scoreThreshold}). Considere reduzir o threshold.`
      : `⚠️ ${metrics.exhibitors_extracted_raw} expositores extraídos mas 0 persistidos. Verifique dedupe e threshold.`;
    await logRunEvent(supabase, organizationId, run.id, "warn", warnMsg, { scoreThreshold, extracted: metrics.exhibitors_extracted_raw, discarded: metrics.discarded_below_score });
  }

  await logRunEvent(supabase, organizationId, run.id, "info", `Concluído: ${prospectsCreated} prospects de ${allExhibitors.length} expositores extraídos`, metrics);

  const finalStatus = prospectsCreated === 0 && metrics.exhibitors_extracted_raw > 0 ? "completed_empty" : "completed";

  await supabase.from("playbook_runs").update({
    status: finalStatus,
    finished_at: new Date().toISOString(),
    stats: metrics,
    execution_log: executionLog,
    execution_time_ms: elapsed,
    error_summary: prospectsCreated === 0 && metrics.exhibitors_extracted_raw > 0
      ? `${metrics.exhibitors_extracted_raw} expositores extraídos, 0 persistidos (threshold: ${scoreThreshold}, descartados: ${metrics.discarded_below_score})`
      : null,
  }).eq("id", run.id);

  return new Response(
    JSON.stringify({ run_id: run.id, prospects_count: prospectsCreated, stats: metrics }),
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
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5-mini",
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
