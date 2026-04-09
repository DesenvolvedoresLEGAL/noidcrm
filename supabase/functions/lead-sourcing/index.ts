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

  // Match 1: exact domain
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

  // Match 2: normalized name similarity
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

    // Partial match: one contains the other (min 5 chars to avoid false positives)
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

  // Match 3: name + city
  if (city) {
    const cityLower = city.toLowerCase();
    for (const acc of accounts) {
      if (acc.cidade?.toLowerCase() === cityLower) {
        const accName1 = normalizeCompanyName(acc.razao_social || "");
        const accName2 = acc.nome_fantasia ? normalizeCompanyName(acc.nome_fantasia) : "";
        // Check if names share significant overlap (first 5+ chars)
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

    // Pre-load accounts for dedupe
    const { data: orgAccounts } = await supabase
      .from("accounts")
      .select("id, razao_social, nome_fantasia, website, cidade")
      .eq("organization_id", organization_id)
      .is("deleted_at", null)
      .limit(1000);
    const accounts = orgAccounts || [];

    // ── MANUAL IMPORT: deterministic processing ────────────────────
    if (searchType === "import" || searchType === "manual_import") {
      return await handleManualImport(supabase, run, organization_id, icpId, icpData, config, scoreThreshold, accounts);
    }

    // ── EVENT with Firecrawl ───────────────────────────────────────
    if (searchType === "event") {
      return await handleEventFirecrawl(supabase, run, organization_id, icpId, config, icpContext, scoreThreshold, accounts);
    }

    // ── OTHER TYPES: AI-powered ────────────────────────────────────
    return await handleAIPowered(supabase, run, organization_id, icpId, searchType, config, icpContext, scoreThreshold, accounts);

  } catch (error) {
    console.error("lead-sourcing error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Manual Import Handler ──────────────────────────────────────────

async function handleManualImport(
  supabase: any,
  run: any,
  organizationId: string,
  icpId: string | null,
  icpData: any,
  config: any,
  scoreThreshold: number,
  accounts: any[]
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

    // Dedupe against accounts
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
        // Dedupe fields
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

  const stats = {
    raw_items: rawItems,
    valid_items: lines.length,
    invalid_items: invalidItems.length,
    prospects_created: prospectsCreated,
    duplicates_in_input: duplicatesInInput,
  };

  await supabase.from("playbook_runs").update({
    status: "completed",
    finished_at: new Date().toISOString(),
    stats,
    execution_log: executionLog,
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
  accounts: any[]
) {
  const eventUrl = config.event_url;
  const eventName = config.event_name || "Evento";
  const executionLog: any[] = [];

  if (!eventUrl) {
    await supabase.from("playbook_runs").update({ status: "failed", finished_at: new Date().toISOString(), execution_log: [{ step: "validation", error: "event_url is required" }] }).eq("id", run.id);
    return new Response(JSON.stringify({ error: "event_url is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) {
    await supabase.from("playbook_runs").update({ status: "failed", finished_at: new Date().toISOString(), execution_log: [{ step: "config", error: "FIRECRAWL_API_KEY not configured" }] }).eq("id", run.id);
    return new Response(JSON.stringify({ error: "Firecrawl not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  // Create lead_source
  const { data: source } = await supabase.from("lead_sources").insert({
    organization_id: organizationId,
    playbook_run_id: run.id,
    source_type: "event_exhibitors",
    source_label: eventName,
    source_url: eventUrl,
    source_metadata: config,
  }).select().single();

  // Step 1: Map the event URL to discover pages
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
  } catch (err) {
    console.error("Firecrawl map error:", err);
    executionLog.push({ step: "firecrawl_map", error: String(err), at: new Date().toISOString() });
  }

  // Step 2: Classify and filter relevant URLs
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

  // Save all relevant source_pages
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

  // Step 3: Scrape top relevant pages (max 10)
  const pagesToScrape = relevantPages.slice(0, 10);
  const scrapedContents: Array<{ url: string; markdown: string; page_type: string }> = [];

  for (const page of pagesToScrape) {
    try {
      const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: page.url, formats: ["markdown"], onlyMainContent: true }),
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
    }
  }

  executionLog.push({ step: "firecrawl_scrape", pages_scraped: scrapedContents.length, at: new Date().toISOString() });

  // Step 4: AI extraction from scraped content
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
              content: `Extraia todas as empresas expositoras desta página de evento (${eventName}):\n\nURL: ${scraped.url}\nTipo: ${scraped.page_type}\n\nConteúdo:\n${scraped.markdown.substring(0, 15000)}`,
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
      }
    } catch (err) {
      console.error(`AI extraction error for ${scraped.url}:`, err);
    }
  }

  executionLog.push({ step: "ai_extraction", exhibitors_extracted: allExhibitors.length, at: new Date().toISOString() });

  // Step 5: Deduplicate extracted exhibitors and create prospects
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

    // Add event-specific signals
    exSignals.push("participates_in_events");
    if (ex._page_type === "exhibitors_list" || ex._page_type === "exhibitor_profile") exSignals.push("listed_in_official_directory");
    if (ex.booth) exSignals.push("has_booth");
    if (exSignals.some(s => /demo|showcase|product/i.test(s))) exSignals.push("has_product_showcase");

    // Event-specific scoring
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
    const sourceTrust = 70; // Official event directory = high trust
    const totalScore = icpFit + signalScore + dataQuality + sourceTrust;
    const grade = gradeFromScore(Math.round(totalScore / 4));

    // Dedupe
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

    // Create prospect signals
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

  const stats = {
    pages_discovered: discoveredUrls.length,
    pages_scraped: scrapedContents.length,
    exhibitors_extracted: allExhibitors.length,
    prospects_created: prospectsCreated,
  };

  await supabase.from("playbook_runs").update({
    status: "completed",
    finished_at: new Date().toISOString(),
    stats,
    execution_log: executionLog,
  }).eq("id", run.id);

  return new Response(
    JSON.stringify({ run_id: run.id, prospects_count: prospectsCreated, stats }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── AI-powered Handler (geo, directory, seed) ──────────────────────

async function handleAIPowered(
  supabase: any,
  run: any,
  organizationId: string,
  icpId: string | null,
  searchType: string,
  config: any,
  icpContext: string,
  scoreThreshold: number,
  accounts: any[]
) {
  const { data: source } = await supabase
    .from("lead_sources")
    .insert({
      organization_id: organizationId,
      playbook_run_id: run.id,
      source_type: searchType,
      source_label: config.event_name || config.directory_source || config.seed_company || searchType,
      source_url: config.event_url || null,
      source_metadata: config,
    })
    .select()
    .single();

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
  }

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

  let prospectsInserted = 0;
  for (const lead of leads) {
    const normalizedName = (lead.company_name || "").toLowerCase().trim().replace(/\s+/g, " ");
    const normalizedDomain = (lead.website || "").replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();

    // Dedupe against accounts
    const dedupe = await dedupeProspect(supabase, organizationId, normalizedName, normalizedDomain || null, lead.city || null, accounts);

    const { data: prospect, error: prospectError } = await supabase
      .from("prospects")
      .insert({
        organization_id: organizationId,
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
        source_label: config.event_name || config.directory_source || searchType,
        raw_data: lead,
        // Dedupe fields
        matched_account_id: dedupe.matched_account_id,
        dedupe_status: dedupe.dedupe_status,
        duplicate_candidate: dedupe.duplicate_candidate,
        review_needed: dedupe.review_needed,
        approval_status: "pending",
      })
      .select()
      .single();

    if (prospectError) {
      console.error("Insert prospect error:", prospectError);
      continue;
    }

    prospectsInserted++;

    const icpFit = Math.min(100, Math.max(0, lead.icp_fit_score || 0));
    const signalScore = Math.min(100, Math.max(0, lead.signal_score || 0));
    const dataQuality = Math.min(100, Math.max(0, lead.data_quality_score || 50));
    const sourceTrust = Math.min(100, Math.max(0, lead.source_trust_score || 50));

    await supabase.from("prospect_scores").insert({
      organization_id: organizationId,
      prospect_id: prospect.id,
      icp_fit_score: icpFit,
      signal_score: signalScore,
      data_quality_score: dataQuality,
      source_trust_score: sourceTrust,
      penalty_score: 0,
      reasoning: {
        summary: lead.reasoning_summary || lead.summary || "",
        reason: lead.summary || "",
        dedupe: dedupe.match_type ? { status: dedupe.dedupe_status, match_type: dedupe.match_type } : null,
      },
      grade: lead.grade || "C",
    });
  }

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
}
