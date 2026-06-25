import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";
import { sanitizeProspectDomain } from "../_shared/domain-blocklist.ts";



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

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function resolveEventPageUrl(pageUrl: string, rawHref: string | null): string | null {
  if (!rawHref) return null;
  const href = decodeHtmlEntities(rawHref).trim();
  if (!href || href.startsWith("javascript:void")) return null;

  const modalMatch = href.match(/openRemoteModal\('([^']+)'/i);
  if (modalMatch?.[1]) {
    try {
      const base = new URL(pageUrl);
      return new URL(modalMatch[1].replace(/^\/+/, ""), `${base.origin}/`).toString();
    } catch {
      return null;
    }
  }

  try {
    return new URL(href, pageUrl).toString();
  } catch {
    return null;
  }
}

function htmlToLightweightMarkdown(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const withSemanticBreaks = withoutScripts
    .replace(/<h[2-4][^>]*>\s*(?:<a[^>]*>)?\s*([^<]+?)\s*(?:<\/a>)?\s*<\/h[2-4]>/gi, "\n## $1\n")
    .replace(/<div[^>]*class="[^"]*stand[^"]*"[^>]*>\s*Stand:\s*([^<]+?)\s*<\/div>/gi, "\nStand: $1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|section|article|ul|ol)>/gi, "\n");

  return decodeHtmlEntities(withSemanticBreaks)
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function stripHtmlToText(rawHtml: string | null | undefined): string | null {
  if (!rawHtml) return null;
  const text = decodeHtmlEntities(rawHtml)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

function parseNextDataFromHtml(html: string): any | null {
  const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    try {
      return JSON.parse(decodeHtmlEntities(match[1]));
    } catch {
      return null;
    }
  }
}

function collectSwapcardViewIds(nextData: any, pageUrl: string): string[] {
  const ids = new Set<string>();
  // viewId direto da rota
  const queryViewId = nextData?.query?.viewId;
  if (queryViewId) ids.add(String(queryViewId));

  // Última parte do pathname (fallback)
  try {
    const parts = new URL(pageUrl).pathname.split("/").filter(Boolean);
    const last = decodeURIComponent(parts[parts.length - 1] || "");
    if (last && /^[A-Za-z0-9=_-]{6,}$/.test(last)) ids.add(last);
  } catch { /* ignore */ }

  // Varredura recursiva por chaves "viewId" ou objetos com __typename "EventExhibitorListView"
  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const n of node) visit(n); return; }
    for (const [k, v] of Object.entries(node)) {
      if ((k === "viewId" || k === "id") && typeof v === "string" && v.length >= 8 && v.length <= 128) {
        // Heurística: chaves "id" só entram se o objeto parecer uma view
        if (k === "viewId" || /view|exhibitor/i.test(JSON.stringify(node).slice(0, 200))) {
          if (/^[A-Za-z0-9=_-]+$/.test(v)) ids.add(v);
        }
      }
      if (v && typeof v === "object") visit(v);
    }
  };
  visit(nextData);

  return Array.from(ids);
}

function extractSwapcardContext(pageUrl: string, html: string): { eventId: string; eventSlug: string; viewId: string; viewIds: string[]; endpoint: string } | null {
  const nextData = parseNextDataFromHtml(html);
  const eventId = nextData?.props?.event?.id || nextData?.props?.pageProps?.event?.id;
  const eventSlug = nextData?.query?.eventSlug || nextData?.props?.activeEventSlug || nextData?.props?.pageProps?.activeEventSlug;
  const viewIds = collectSwapcardViewIds(nextData, pageUrl);
  const viewId = viewIds[0] || "";

  if (!eventId || !eventSlug || !viewId) return null;
  try {
    const origin = new URL(pageUrl).origin;
    return { eventId, eventSlug, viewId, viewIds, endpoint: `${origin}/api/graphql` };
  } catch {
    return { eventId, eventSlug, viewId, viewIds, endpoint: "https://api.swapcard.com/graphql" };
  }
}

async function fetchEventPageDirect(url: string): Promise<{ html: string; markdown: string }> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    },
  });

  if (!resp.ok) {
    throw new Error(`Direct fetch failed (${resp.status}) for ${url}`);
  }

  const html = await resp.text();
  return {
    html,
    markdown: htmlToLightweightMarkdown(html),
  };
}

async function fetchSwapcardExhibitors(pageUrl: string, html: string): Promise<any[]> {
  const ctx = extractSwapcardContext(pageUrl, html);
  if (!ctx) return [];

  const query = `query EventExhibitorListViewConnectionQuery($viewId: ID!, $endCursor: String, $eventId: ID!, $withEvent: Boolean = true) {
    view: Core_eventExhibitorListView(viewId: $viewId) {
      id
      exhibitors(cursor: { first: 100, after: $endCursor }) {
        nodes {
          id: _id
          name
          type
          logoUrl
          htmlDescription
          withEvent(eventId: $eventId) @include(if: $withEvent) { booth isBookmarked }
        }
        pageInfo { hasNextPage endCursor }
        totalCount
      }
    }
  }`;

  const exhibitors: any[] = [];
  const seen = new Set<string>();
  const viewIds = ctx.viewIds.length > 0 ? ctx.viewIds : [ctx.viewId];
  const diagnostics: { viewId: string; total: number; fetched: number; pages: number }[] = [];

  for (const viewId of viewIds) {
    let cursor: string | null = null;
    let lastTotal = 0;
    let fetchedThisView = 0;
    let pages = 0;
    let consecutiveEmpty = 0;

    // Limite generoso: 200 páginas × 100 = 20k itens (cobre qualquer feira)
    for (let page = 1; page <= 200; page++) {
      pages = page;
      const resp: Response = await fetch(ctx.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/135 Safari/537.36",
          "Origin": new URL(pageUrl).origin,
          "Referer": pageUrl,
          "x-client-platform": "Event App",
          "x-client-version": "2.310.57",
        },
        body: JSON.stringify({
          operationName: "EventExhibitorListViewConnectionQuery",
          variables: { viewId, eventId: ctx.eventId, withEvent: true, endCursor: cursor },
          query,
        }),
      });

      const data: any = await resp.json().catch(() => null);
      if (!resp.ok || data?.errors?.length) {
        // View inválida — pula pra próxima ao invés de quebrar tudo
        if (page === 1) break;
        throw new Error(`Swapcard GraphQL failed (${resp.status}) view=${viewId}: ${JSON.stringify(data?.errors || data).slice(0, 300)}`);
      }

      const connection: any = data?.data?.view?.exhibitors;
      if (!connection) break;
      lastTotal = connection?.totalCount || lastTotal;
      const nodes: any[] = connection?.nodes || [];

      let addedThisPage = 0;
      for (const node of nodes) {
        const name = String(node?.name || "").trim();
        const normalized = normalizeCompanyName(name);
        if (!name || seen.has(normalized)) continue;
        seen.add(normalized);
        addedThisPage++;
        fetchedThisView++;

        const description = stripHtmlToText(node?.htmlDescription);
        const domain = description ? extractDomain(description) : null;
        exhibitors.push({
          company_name: name,
          website: domain ? `https://${domain}` : null,
          category: node?.type || null,
          description,
          booth: node?.withEvent?.booth || null,
          country: null,
          city: null,
          exhibitor_profile_url: null,
          signals: ["swapcard_graphql", "listed_in_official_directory", ...(node?.withEvent?.booth ? ["has_booth"] : [])],
          confidence: 96,
          _source_url: pageUrl,
          _page_type: "exhibitors_list",
          _extraction_method: "swapcard_graphql_cursor",
          _external_id: node?.id || null,
          _logo_url: node?.logoUrl || null,
        });
      }

      // Se a página inteira foi composta de duplicatas, conta como vazia
      if (nodes.length === 0 || addedThisPage === 0) consecutiveEmpty++;
      else consecutiveEmpty = 0;

      const hasNext = !!connection?.pageInfo?.hasNextPage;
      const nextCursor = connection?.pageInfo?.endCursor || null;

      // Continua se: a API diz que tem mais OU ainda não atingimos totalCount desta view
      const shouldContinue = (hasNext && nextCursor)
        || (lastTotal > 0 && fetchedThisView < lastTotal && nextCursor && consecutiveEmpty < 3);

      if (!shouldContinue) break;
      cursor = nextCursor;
    }

    diagnostics.push({ viewId, total: lastTotal, fetched: fetchedThisView, pages });
  }

  // Anexa diagnóstico no primeiro item pra logar lá em cima
  if (exhibitors.length > 0) {
    (exhibitors[0] as any).__swapcard_diagnostics = diagnostics;
  }

  return exhibitors;
}

function extractAzLetterLinks(html: string, pageUrl: string): string[] {
  const links = new Set<string>();
  const matches = html.matchAll(/href=["']([^"']*azletter=[^"']+)["']/gi);
  for (const match of matches) {
    const resolved = resolveEventPageUrl(pageUrl, match[1]);
    if (resolved) links.add(resolved);
  }
  return Array.from(links);
}

function extractAspEventsExhibitorsFromHtml(html: string, pageUrl: string): any[] {
  if (!html) return [];

  const exhibitors: any[] = [];
  const cardPattern = /<li[^>]*class="[^"]*js-library-item[^"]*"[^>]*>[\s\S]*?<h2[^>]*>\s*(?:<a[^>]*href="([^"]*)"[^>]*>)?\s*([^<]{2,120})\s*(?:<\/a>)?\s*<\/h2>[\s\S]*?<div[^>]*class="[^"]*stand[^"]*"[^>]*>\s*Stand:\s*([^<]{1,24})<\/div>[\s\S]*?<\/li>/gi;

  for (const match of html.matchAll(cardPattern)) {
    const rawName = decodeHtmlEntities((match[2] || "").trim()).replace(/\s+/g, " ");
    if (!rawName || rawName.length < 2 || rawName.length > 120) continue;
    if (/^(lista|filtros|pesquisar|loading|todos|all)$/i.test(rawName)) continue;

    exhibitors.push({
      company_name: rawName,
      website: null,
      category: null,
      description: null,
      booth: decodeHtmlEntities((match[3] || "").trim()).toUpperCase(),
      country: null,
      city: null,
      exhibitor_profile_url: resolveEventPageUrl(pageUrl, match[1] || null),
      signals: ["html_card_pattern", "has_booth"],
      confidence: 88,
      _source_url: pageUrl,
      _page_type: "exhibitors_list",
      _extraction_method: "html_card_pattern",
    });
  }

  return exhibitors;
}

// ── SPA shell detection (proteção contra capturas de Angular/React vazios) ──
// Detecta quando uma página é apenas o "casco" do bundle JS sem conteúdo renderizado.
// Crítico para sites como app.informamarkets.com.br (Angular) que servem 400KB de
// HTML mas <2KB de markdown real — qualquer parser/paginação em cima disso é lixo.
function detectSpaFramework(html: string): "angular" | "react" | "vue" | "unknown" | "none" {
  if (!html) return "none";
  if (/ng-version=|<app-root|ng-app=|_ngcontent/i.test(html)) return "angular";
  if (/data-reactroot|__NEXT_DATA__|id=["']root["'][^>]*>\s*<\/div>|react-helmet/i.test(html)) return "react";
  if (/data-server-rendered|__NUXT__|<div id=["']app["'][^>]*>\s*<\/div>/i.test(html)) return "vue";
  return "unknown";
}

function isEmptyShell(html: string, markdown: string): boolean {
  const md = markdown || "";
  const ht = html || "";
  // Markdown rico = não é shell, independente do HTML
  if (md.length >= 5000) return false;
  // Markdown pobre + framework SPA detectado = shell
  const fw = detectSpaFramework(ht);
  if (fw === "angular" || fw === "react" || fw === "vue") return true;
  // Markdown muito pobre (<1500 chars) + HTML grande (>50KB) = quase certamente shell genérico
  if (md.length < 1500 && ht.length > 50000) return true;
  // <noscript> aviso explícito = shell
  if (/<noscript[^>]*>[^<]*(?:enable\s+javascript|habilite\s+o?\s*javascript)/i.test(ht)) return true;
  return false;
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
      // @ts-ignore - EdgeRuntime is a Supabase Edge global not in default Deno types
      (globalThis as any).EdgeRuntime?.waitUntil
        ? (globalThis as any).EdgeRuntime.waitUntil(executeRun())
        : executeRun();

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
        website: sanitizeProspectDomain(domain) ? website : null,
        normalized_domain: sanitizeProspectDomain(domain),
        status: "review_pending",
        confidence: score.confidence,
        source_label: "Lista Importada",
        review_needed: !sanitizeProspectDomain(domain) || grade === "C" || grade === "D" || dedupe.review_needed,
        recommended_next_action: !sanitizeProspectDomain(domain) ? "verify_domain" : recommended,
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

  // ── Step 0: Provider detection (ExpoFP, etc.) ──
  // Some events embed a SaaS floor plan (ExpoFP) instead of listing exhibitors in HTML.
  // Hitting their public data endpoint is faster, cheaper and more accurate than scraping.
  // If detection succeeds, we pre-populate `allExhibitors` and let Steps 1-4 no-op
  // (discoveredUrls stays empty → no Firecrawl spend → no AI chunking).
  const allExhibitors: any[] = [];
  let providerUsed: string = "firecrawl";
  // Hard run-level timeout (Firecrawl/AI fallback can otherwise hang for hours).
  const MAX_RUN_MS = 5 * 60 * 1000;
  const isTimeoutExceeded = () => (Date.now() - startTime) > MAX_RUN_MS;
  try {
    const { tryExpoFPFromUrl } = await import("./providers/index.ts");
    const expofp = await tryExpoFPFromUrl(eventUrl);
    if (expofp.detection) {
      await logRunEvent(supabase, organizationId, run.id, "info", "ExpoFP detectado na página do evento", {
        subdomain: expofp.detection.subdomain,
        origin: expofp.detection.origin,
      });
      if (expofp.result && expofp.result.exhibitors.length > 0) {
        const r = expofp.result;
        for (const ex of r.exhibitors) {
          allExhibitors.push({
            company_name: ex.name,
            website: null,
            category: ex.categories[0] || null,
            description: null,
            booth: null,
            country: ex.country,
            city: null,
            exhibitor_profile_url: ex.source_url,
            signals: ["expofp_official", ex.country ? "has_country" : null, ex.categories.length > 0 ? "has_category" : null].filter(Boolean) as string[],
            confidence: 95,
            _source_url: ex.source_url,
            _page_type: "expofp_data",
            _extraction_method: "expofp_data_js",
            _expofp_external_id: ex.external_id,
            _expofp_categories: ex.categories,
          });
        }
        providerUsed = "expofp";
        metrics.exhibitors_extracted_raw = allExhibitors.length;
        metrics.html_hybrid_extracted = allExhibitors.length;
        (metrics as any).provider = "expofp";
        (metrics as any).expofp_subdomain = expofp.detection.subdomain;
        (metrics as any).expofp_data_version = r.data_version;
        (metrics as any).expofp_event_title = r.event_title;
        (metrics as any).expofp_exhibitors_count = r.exhibitors_count;
        (metrics as any).expofp_with_country = r.with_country;
        (metrics as any).expofp_with_categories = r.with_categories;
        await logRunEvent(supabase, organizationId, run.id, "info",
          `ExpoFP forneceu ${r.exhibitors_count} expositores (${r.with_country} c/ país, ${r.with_categories} c/ categoria) — pulando Firecrawl`,
          { provider: "expofp", count: r.exhibitors_count }
        );
      } else if (expofp.error) {
        await logRunEvent(supabase, organizationId, run.id, "warn",
          "ExpoFP detectado mas fetch falhou — caindo para Firecrawl",
          { error: expofp.error }
        );
      }
    }
  } catch (providerErr) {
    await logRunEvent(supabase, organizationId, run.id, "warn",
      "Erro ao tentar provider ExpoFP — seguindo com Firecrawl",
      { error: String(providerErr) }
    );
  }

  // ── Step 0b: Informa Markets / Swapcard provider ──
  // Marketing pages (e.g. fispalfoodservice.com.br) link to app.informamarkets.com.br;
  // the helper follows that link automatically and paginates the public GraphQL.
  if (allExhibitors.length === 0) {
    try {
      const { tryInformaMarketsFromUrl } = await import("./providers/index.ts");
      const informa = await tryInformaMarketsFromUrl(eventUrl);
      if (informa.detection) {
        await logRunEvent(supabase, organizationId, run.id, "info", "Informa Markets detectado", {
          event_slug: informa.detection.eventSlug,
          view_id: informa.detection.viewId,
          resolved_url: informa.resolved_url ?? eventUrl,
        });
        if (informa.result && informa.result.exhibitors.length > 0) {
          for (const ex of informa.result.exhibitors) {
            allExhibitors.push({
              company_name: ex.name,
              website: null,
              category: ex.categories[0] || null,
              description: null,
              booth: ex.raw?.withEvent?.booth ?? null,
              country: ex.country,
              city: null,
              exhibitor_profile_url: ex.source_url,
              signals: [
                "informa_markets_official",
                ex.country ? "has_country" : null,
                ex.categories.length > 0 ? "has_category" : null,
              ].filter(Boolean) as string[],
              confidence: 95,
              _source_url: ex.source_url,
              _page_type: "informa_markets_graphql",
              _extraction_method: "informa_markets_graphql",
              _logo_url: ex.raw?.logoUrl || null,
              _informa_external_id: ex.external_id,
              _informa_categories: ex.categories,
            });
          }
          providerUsed = "informa-markets";
          metrics.exhibitors_extracted_raw = allExhibitors.length;
          metrics.html_hybrid_extracted = allExhibitors.length;
          (metrics as any).provider = "informa-markets";
          (metrics as any).informa_view_id = informa.result.view_id;
          (metrics as any).informa_event_id = informa.result.event_id;
          (metrics as any).informa_total_count = informa.result.total_count;
          (metrics as any).informa_pages_fetched = informa.result.pages_fetched;
          (metrics as any).informa_resolved_url = informa.resolved_url ?? eventUrl;
          await logRunEvent(supabase, organizationId, run.id, "info",
            `Informa Markets forneceu ${informa.result.exhibitors.length}/${informa.result.total_count ?? "?"} expositores em ${informa.result.pages_fetched} páginas — pulando Firecrawl`,
            { provider: "informa-markets", count: informa.result.exhibitors.length }
          );
        } else if (informa.error) {
          await logRunEvent(supabase, organizationId, run.id, "warn",
            "Informa Markets detectado mas GraphQL falhou — caindo para Firecrawl",
            { error: informa.error }
          );
        }
      }
    } catch (providerErr) {
      await logRunEvent(supabase, organizationId, run.id, "warn",
        "Erro ao tentar provider Informa Markets — seguindo com Firecrawl",
        { error: String(providerErr) }
      );
    }
  }

  // ── Step 0c: NürnbergMesse Brasil Vitrine provider ──
  // FCE Cosmetique/Pharma and similar vitrine.* catalogues are Next.js shells backed by
  // api-one.nm-brasil.com.br. Use their public catalogue API directly instead of AI/Firecrawl.
  if (allExhibitors.length === 0) {
    try {
      const { tryNmBrasilFromUrl } = await import("./providers/index.ts");
      const nmBrasil = await tryNmBrasilFromUrl(eventUrl);
      if (nmBrasil.detection) {
        await logRunEvent(supabase, organizationId, run.id, "info", "NürnbergMesse Brasil Vitrine detectado", {
          layout: nmBrasil.detection.layout,
          fair_ids: nmBrasil.detection.fair_ids,
        });
        if (nmBrasil.result && nmBrasil.result.exhibitors.length > 0) {
          for (const ex of nmBrasil.result.exhibitors) {
            allExhibitors.push({
              company_name: ex.name,
              website: ex.website,
              category: ex.category,
              description: ex.description,
              booth: ex.booth,
              country: null,
              city: null,
              exhibitor_profile_url: ex.source_url,
              signals: [
                "nm_brasil_official",
                "listed_in_official_directory",
                ex.booth ? "has_booth" : null,
                ex.website ? "has_website" : null,
                ex.category ? "has_category" : null,
              ].filter(Boolean) as string[],
              confidence: 96,
              _source_url: ex.source_url,
              _page_type: "exhibitors_list",
              _extraction_method: "nm_brasil_public_api",
              _logo_url: ex.logo_url,
              _nm_brasil_external_id: ex.external_id,
              _nm_brasil_fair_id: ex.fair_id,
              _nm_brasil_fair_name: ex.fair_name,
              _nm_brasil_categories: ex.categories,
            });
          }
          providerUsed = "nm-brasil";
          metrics.exhibitors_extracted_raw = allExhibitors.length;
          metrics.html_hybrid_extracted = allExhibitors.length;
          (metrics as any).provider = "nm-brasil";
          (metrics as any).nm_brasil_layout = nmBrasil.result.layout;
          (metrics as any).nm_brasil_total_count = nmBrasil.result.total_count;
          (metrics as any).nm_brasil_active_count = nmBrasil.result.active_count;
          (metrics as any).nm_brasil_pages_fetched = nmBrasil.result.pages_fetched;
          await logRunEvent(supabase, organizationId, run.id, "info",
            `NürnbergMesse Brasil forneceu ${nmBrasil.result.active_count}/${nmBrasil.result.total_count} expositores ativos — pulando Firecrawl`,
            { provider: "nm-brasil", count: nmBrasil.result.active_count, total: nmBrasil.result.total_count }
          );
        } else if (nmBrasil.error) {
          await logRunEvent(supabase, organizationId, run.id, "warn",
            "NürnbergMesse Brasil detectado mas API falhou — caindo para SPA/Firecrawl",
            { error: nmBrasil.error }
          );
        }
      }
    } catch (providerErr) {
      await logRunEvent(supabase, organizationId, run.id, "warn",
        "Erro ao tentar provider NürnbergMesse Brasil — seguindo com SPA/Firecrawl",
        { error: String(providerErr) }
      );
    }
  }

  // ── Step 0d: WordPress DRTS (Directories Pro) provider ──
  // Sites como exposec.tmp.br/directory-2026/ renderizam todos os expositores
  // server-side em uma única página HTML. Um fetch só resolve 100% — sem SPA,
  // sem detail crawl, sem Firecrawl.
  if (allExhibitors.length === 0) {
    try {
      const { tryDrtsFromUrl } = await import("./providers/index.ts");
      const drts = await tryDrtsFromUrl(eventUrl);
      if (drts.detection) {
        await logRunEvent(supabase, organizationId, run.id, "info", "DRTS (WordPress Directories Pro) detectado", {
          origin: drts.detection.origin,
          extracted: drts.result?.exhibitors.length ?? 0,
        });
        if (drts.result && drts.result.exhibitors.length > 0) {
          for (const ex of drts.result.exhibitors) {
            allExhibitors.push({
              company_name: ex.name,
              website: null,
              category: null,
              description: null,
              booth: ex.estande,
              country: null,
              city: ex.rua,
              exhibitor_profile_url: ex.source_url,
              signals: [
                "drts_directory_official",
                "listed_in_official_directory",
                ex.estande ? "has_booth" : null,
              ].filter(Boolean) as string[],
              confidence: 94,
              _source_url: ex.source_url || eventUrl,
              _page_type: "exhibitors_list",
              _extraction_method: "drts_directory_html",
            });
          }
          providerUsed = "drts-directory";
          metrics.exhibitors_extracted_raw = allExhibitors.length;
          metrics.html_hybrid_extracted = allExhibitors.length;
          (metrics as any).provider = "drts-directory";
          (metrics as any).drts_total_count = drts.result.total_count;
          await logRunEvent(supabase, organizationId, run.id, "info",
            `DRTS forneceu ${drts.result.exhibitors.length} expositores em uma única página — pulando Firecrawl`,
            { provider: "drts-directory", count: drts.result.exhibitors.length }
          );
        } else if (drts.error) {
          await logRunEvent(supabase, organizationId, run.id, "warn",
            "DRTS detectado mas extração falhou — caindo para SPA/Firecrawl",
            { error: drts.error }
          );
        }
      }
    } catch (providerErr) {
      await logRunEvent(supabase, organizationId, run.id, "warn",
        "Erro ao tentar provider DRTS — seguindo com SPA/Firecrawl",
        { error: String(providerErr) }
      );
    }
  }

  // ── Step 0e: Francal / TOTVS RM Cloud provider ──
  // Sites do grupo Francal (Naturaltech, Fispal Food, Bio Brazil Fair, etc.)
  // populam a tabela de expositores via uma única chamada AJAX a um endpoint
  // TOTVS RM público. O HTML inicial vem vazio — qualquer scrape de markdown
  // captura lixo (menu, footer). Um fetch direto ao TOTVS resolve 100%.
  if (allExhibitors.length === 0) {
    try {
      const { tryFrancalTotvsFromUrl } = await import("./providers/index.ts");
      const francal = await tryFrancalTotvsFromUrl(eventUrl);
      if (francal.detection) {
        await logRunEvent(supabase, organizationId, run.id, "info", "Francal/TOTVS detectado", {
          codigo_feira: francal.detection.codigo_feira,
          detection_source: francal.detection.source,
          extracted: francal.result?.exhibitors.length ?? 0,
        });
        if (francal.result && francal.result.exhibitors.length > 0) {
          for (const ex of francal.result.exhibitors) {
            allExhibitors.push({
              company_name: ex.name,
              website: ex.website,
              category: null,
              description: ex.product,
              booth: ex.booth,
              country: null,
              city: null,
              exhibitor_profile_url: null,
              signals: [
                "francal_totvs_official",
                "listed_in_official_directory",
                ex.booth ? "has_booth" : null,
                ex.website ? "has_website" : null,
              ].filter(Boolean) as string[],
              confidence: 96,
              _source_url: eventUrl,
              _page_type: "exhibitors_list",
              _extraction_method: "francal_totvs_api",
            });
          }
          providerUsed = "francal-totvs";
          metrics.exhibitors_extracted_raw = allExhibitors.length;
          metrics.html_hybrid_extracted = allExhibitors.length;
          (metrics as any).provider = "francal-totvs";
          (metrics as any).francal_codigo_feira = francal.result.codigo_feira;
          (metrics as any).francal_total_count = francal.result.total_count;
          await logRunEvent(supabase, organizationId, run.id, "info",
            `Francal/TOTVS forneceu ${francal.result.exhibitors.length} expositores (CODIGO_FEIRA=${francal.result.codigo_feira}) — pulando Firecrawl`,
            { provider: "francal-totvs", count: francal.result.exhibitors.length },
          );
        } else if (francal.error) {
          // API Francal indisponível: NÃO cai para Firecrawl (o conteúdo nunca
          // chega via HTML — gastaria créditos à toa). Loga warn e segue; o
          // Step 0f/Firecrawl genérico ainda pode salvar via outros padrões,
          // mas o esperado é falhar limpo com 0 leads.
          await logRunEvent(supabase, organizationId, run.id, "warn",
            "Francal/TOTVS detectado mas API falhou — conteúdo não está no HTML, fallbacks tendem a retornar lixo",
            { error: francal.error, codigo_feira: francal.detection.codigo_feira },
          );
        }
      }
    } catch (providerErr) {
      await logRunEvent(supabase, organizationId, run.id, "warn",
        "Erro ao tentar provider Francal/TOTVS — seguindo com SPA/Firecrawl",
        { error: String(providerErr) },
      );
    }
  }

  // ── Step 0e2: InfraFM / IEG Brasil provider ──
  // Páginas infrafm.com.br carregam expositores via fetch() a um JSON estático
  // em images.infrafm.com.br/arquivos/exhibitors_<hash>.json. HTML inicial é
  // só um <div id="exhibitors_logotypes"></div> vazio — markdown/Firecrawl
  // captura menu/CTA/banners como "leads".
  if (allExhibitors.length === 0) {
    try {
      const { tryInfraFmFromUrl } = await import("./providers/index.ts");
      const infrafm = await tryInfraFmFromUrl(eventUrl);
      if (infrafm.detection) {
        await logRunEvent(supabase, organizationId, run.id, "info", "InfraFM detectado", {
          json_url: infrafm.detection.json_url,
          extracted: infrafm.result?.exhibitors.length ?? 0,
        });
        if (infrafm.result && infrafm.result.exhibitors.length > 0) {
          for (const ex of infrafm.result.exhibitors) {
            allExhibitors.push({
              company_name: ex.name,
              website: null,
              category: null,
              description: ex.description,
              booth: null,
              country: null,
              city: null,
              exhibitor_profile_url: ex.profile_url,
              signals: [
                "infrafm_official",
                "listed_in_official_directory",
                ex.logo ? "has_logo" : null,
                ex.profile_url ? "has_profile_url" : null,
              ].filter(Boolean) as string[],
              confidence: 96,
              _source_url: eventUrl,
              _page_type: "exhibitors_list",
              _extraction_method: "infrafm_json",
            });
          }
          providerUsed = "infrafm";
          metrics.exhibitors_extracted_raw = allExhibitors.length;
          metrics.html_hybrid_extracted = allExhibitors.length;
          (metrics as any).provider = "infrafm";
          (metrics as any).infrafm_json_url = infrafm.result.json_url;
          (metrics as any).infrafm_total_count = infrafm.result.total_count;
          await logRunEvent(supabase, organizationId, run.id, "info",
            `InfraFM forneceu ${infrafm.result.exhibitors.length} expositores — pulando Firecrawl`,
            { provider: "infrafm", count: infrafm.result.exhibitors.length },
          );
        } else if (infrafm.error) {
          await logRunEvent(supabase, organizationId, run.id, "warn",
            "InfraFM detectado mas fetch do JSON falhou — conteúdo não está no HTML, fallbacks tendem a retornar lixo",
            { error: infrafm.error, json_url: infrafm.detection.json_url },
          );
        }
      }
    } catch (providerErr) {
      await logRunEvent(supabase, organizationId, run.id, "warn",
        "Erro ao tentar provider InfraFM — seguindo com SPA/Firecrawl",
        { error: String(providerErr) },
      );
    }
  }

  // ── Step 0e3: MundoGEO / DroneShow / SpaceBR / Expo eVTOL provider ──
  // mundogeo.com/feiras2026/ (e variantes anuais) lista expositores como HTML
  // estático puro no padrão "<BOOTH> – <b>NAME</b> – <a href=...>site</a><br>".
  // Firecrawl+IA quebra esse padrão tratando "site" como texto solto. Regex
  // determinístico extrai 100% em uma requisição.
  if (allExhibitors.length === 0) {
    try {
      const { tryMundoGeoFromUrl } = await import("./providers/index.ts");
      const mg = await tryMundoGeoFromUrl(eventUrl);
      if (mg.detection) {
        await logRunEvent(supabase, organizationId, run.id, "info", "MundoGEO/DroneShow detectado", {
          host: mg.detection.host,
          extracted: mg.result?.exhibitors.length ?? 0,
        });
        if (mg.result && mg.result.exhibitors.length > 0) {
          for (const ex of mg.result.exhibitors) {
            allExhibitors.push({
              company_name: ex.name,
              website: ex.website,
              category: null,
              description: null,
              booth: ex.booth,
              country: null,
              city: null,
              exhibitor_profile_url: null,
              signals: [
                "mundogeo_official",
                "listed_in_official_directory",
                ex.booth ? "has_booth" : null,
                ex.website ? "has_website" : null,
              ].filter(Boolean) as string[],
              confidence: 96,
              _source_url: eventUrl,
              _page_type: "exhibitors_list",
              _extraction_method: "mundogeo_html_regex",
            });
          }
          providerUsed = "mundogeo";
          metrics.exhibitors_extracted_raw = allExhibitors.length;
          metrics.html_hybrid_extracted = allExhibitors.length;
          (metrics as any).provider = "mundogeo";
          (metrics as any).mundogeo_host = mg.detection.host;
          (metrics as any).mundogeo_total_count = mg.result.total_count;
          await logRunEvent(supabase, organizationId, run.id, "info",
            `MundoGEO forneceu ${mg.result.exhibitors.length} expositores — pulando Firecrawl`,
            { provider: "mundogeo", count: mg.result.exhibitors.length },
          );
        } else if (mg.error) {
          await logRunEvent(supabase, organizationId, run.id, "warn",
            "MundoGEO detectado mas extração não retornou resultados",
            { error: mg.error },
          );
        }
      }
    } catch (providerErr) {
      await logRunEvent(supabase, organizationId, run.id, "warn",
        "Erro ao tentar provider MundoGEO — seguindo com SPA/Firecrawl",
        { error: String(providerErr) },
      );
    }
  }

  // ── Step 0e2: Informa Connect (marketing sites) provider ──
  // Informa Markets também opera sites de marketing Next.js (abfexpo.com.br,
  // fispalfoodservice.com.br, hospitalar.com etc.) que renderizam
  // `informa-exhibitor-list-module` vazio no SSR e buscam expositores via
  // api-connect.informamarkets.com. Endpoint público, sem auth.
  if (allExhibitors.length === 0) {
    try {
      const { tryInformaConnectFromUrl } = await import("./providers/index.ts");
      const ic = await tryInformaConnectFromUrl(eventUrl);
      if (ic.detection) {
        await logRunEvent(supabase, organizationId, run.id, "info", "Informa Connect detectado", {
          edition_code: ic.detection.editionCode,
          event_site_url: ic.detection.eventSiteUrl,
        });
        if (ic.result && ic.result.exhibitors.length > 0) {
          for (const ex of ic.result.exhibitors) {
            allExhibitors.push({
              company_name: ex.name,
              website: ex.website,
              category: ex.categories[0] || null,
              description: null,
              booth: ex.booth,
              country: ex.country,
              city: ex.city,
              exhibitor_profile_url: ex.source_url,
              signals: [
                "informa_connect_official",
                "listed_in_official_directory",
                ex.country ? "has_country" : null,
                ex.categories.length > 0 ? "has_category" : null,
                ex.website ? "has_website" : null,
                ex.booth ? "has_booth" : null,
              ].filter(Boolean) as string[],
              confidence: 95,
              _source_url: ex.source_url,
              _page_type: "informa_connect_listings",
              _extraction_method: "informa_connect_api",
              _logo_url: ex.logo_url,
              _informa_connect_external_id: ex.external_id,
              _informa_connect_categories: ex.categories,
            });
          }
          providerUsed = "informa-connect";
          metrics.exhibitors_extracted_raw = allExhibitors.length;
          metrics.html_hybrid_extracted = allExhibitors.length;
          (metrics as any).provider = "informa-connect";
          (metrics as any).informa_connect_edition_code = ic.result.edition_code;
          (metrics as any).informa_connect_total_count = ic.result.total_count;
          (metrics as any).informa_connect_pages_fetched = ic.result.pages_fetched;
          await logRunEvent(supabase, organizationId, run.id, "info",
            `Informa Connect forneceu ${ic.result.exhibitors.length}/${ic.result.total_count ?? "?"} expositores em ${ic.result.pages_fetched} páginas — pulando Firecrawl`,
            { provider: "informa-connect", count: ic.result.exhibitors.length },
          );
        } else if (ic.error) {
          await logRunEvent(supabase, organizationId, run.id, "warn",
            "Informa Connect detectado mas API falhou — caindo para próximo provider",
            { error: ic.error },
          );
        }
      }
    } catch (providerErr) {
      await logRunEvent(supabase, organizationId, run.id, "warn",
        "Erro ao tentar provider Informa Connect — seguindo com SPA/Firecrawl",
        { error: String(providerErr) },
      );
    }
  }

  // ── Step 0f: Generic SPA (Next.js / Nuxt / React) provider ──
  // For sites where the initial HTML is an empty shell + spinner (e.g. vitrine.fcecosmetique.com.br).
  // Tries hydrated payload (__NEXT_DATA__, RSC) first, then internal API sniffing.
  // Only runs when no deterministic provider above matched.
  if (allExhibitors.length === 0) {
    try {
      const { tryGenericSpaFromUrl } = await import("./providers/index.ts");
      const spa = await tryGenericSpaFromUrl(eventUrl);
      if (spa.detection) {
        await logRunEvent(supabase, organizationId, run.id, "info", "SPA detectado (Next.js/Nuxt/React)", {
          framework: spa.detection.framework,
          layer: spa.layer,
          endpoints_probed: spa.endpoints_probed?.length ?? 0,
          extracted: spa.exhibitors.length,
        });
        if (spa.exhibitors.length >= 20 && (spa.layer === 2 || spa.layer === 3)) {
          for (const ex of spa.exhibitors) {
            allExhibitors.push({
              company_name: ex.name,
              website: ex.website,
              category: ex.category,
              description: ex.description,
              booth: ex.booth,
              country: ex.country,
              city: ex.city,
              exhibitor_profile_url: ex.source_url,
              signals: [
                "spa_hydrated_payload",
                ex.country ? "has_country" : null,
                ex.category ? "has_category" : null,
                ex.website ? "has_website" : null,
              ].filter(Boolean) as string[],
              confidence: spa.layer === 2 ? 92 : 88,
              _source_url: ex.source_url,
              _page_type: "spa_payload",
              _extraction_method: spa.layer === 2 ? "spa_hydrated_payload" : "spa_internal_api",
              _logo_url: ex.logo_url,
              _spa_external_id: ex.external_id,
              _spa_framework: spa.detection.framework,
            });
          }
          providerUsed = "spa-nextjs";
          metrics.exhibitors_extracted_raw = allExhibitors.length;
          metrics.html_hybrid_extracted = allExhibitors.length;
          (metrics as any).provider = "spa-nextjs";
          (metrics as any).spa_framework = spa.detection.framework;
          (metrics as any).spa_extraction_layer = spa.layer;
          (metrics as any).spa_endpoints_probed = spa.endpoints_probed?.length ?? 0;
          await logRunEvent(supabase, organizationId, run.id, "info",
            `SPA provider extraiu ${spa.exhibitors.length} expositores (camada ${spa.layer}) — pulando Firecrawl`,
            { provider: "spa-nextjs", framework: spa.detection.framework, count: spa.exhibitors.length }
          );
        } else {
          await logRunEvent(supabase, organizationId, run.id, "warn",
            "SPA detectado mas extração determinística não atingiu o threshold — caindo para Firecrawl",
            { framework: spa.detection.framework, extracted: spa.exhibitors.length, error: spa.error }
          );
        }
      }
    } catch (providerErr) {
      await logRunEvent(supabase, organizationId, run.id, "warn",
        "Erro ao tentar provider SPA — seguindo com Firecrawl",
        { error: String(providerErr) }
      );
    }
  }

  // ── Step 0g: Logo-wall provider (sponsor/partner pages) ──
  // For static pages that render a grid of <a href="external"><img></a> with no
  // company name in the surrounding text (e.g. expertxp.com.br/patrocinadores).
  // The AI/markdown extractor on these pages captures sponsorship tier titles
  // (DIAMANTE, OURO, PRATA…) as if they were companies — pure garbage. This
  // deterministic provider reads the DOM, dedupes by external domain, and skips
  // Firecrawl entirely when it finds ≥6 logos.
  if (allExhibitors.length === 0) {
    try {
      const { tryLogoWallFromUrl } = await import("./providers/index.ts");
      const lw = await tryLogoWallFromUrl(eventUrl);
      if (lw.result && lw.result.sponsors.length >= 6) {
        for (const s of lw.result.sponsors) {
          allExhibitors.push({
            company_name: s.name,
            website: s.website,
            category: null,
            description: null,
            booth: null,
            country: null,
            city: null,
            exhibitor_profile_url: s.source_url,
            signals: [
              "logo_wall",
              "external_domain",
              s.tier ? "has_tier" : null,
            ].filter(Boolean) as string[],
            confidence: 80,
            _source_url: s.source_url,
            _page_type: "sponsor_wall",
            _extraction_method: "logo_wall_dom",
            _logo_url: s.logo_url,
            _sponsor_tier: s.tier,
          });
        }
        providerUsed = "logo-wall";
        metrics.exhibitors_extracted_raw = allExhibitors.length;
        metrics.html_hybrid_extracted = allExhibitors.length;
        (metrics as any).provider = "logo-wall";
        (metrics as any).logo_wall_density = lw.result.detection.density;
        await logRunEvent(supabase, organizationId, run.id, "info",
          `Logo-wall extraiu ${lw.result.sponsors.length} patrocinadores via DOM — pulando Firecrawl`,
          { provider: "logo-wall", count: lw.result.sponsors.length }
        );
      } else if (lw.error) {
        await logRunEvent(supabase, organizationId, run.id, "warn",
          "Logo-wall provider falhou no fetch — seguindo com Firecrawl",
          { error: lw.error }
        );
      }
    } catch (providerErr) {
      await logRunEvent(supabase, organizationId, run.id, "warn",
        "Erro ao tentar provider logo-wall — seguindo com Firecrawl",
        { error: String(providerErr) }
      );
    }
  }

  (metrics as any).provider = providerUsed;
  const providerHandled = allExhibitors.length > 0;
  const expofpHandled = providerHandled; // legacy var name used downstream

  // ── Step 1: Map — discover all URLs ──
  let discoveredUrls: string[] = [];
  if (!expofpHandled) {
  await logRunEvent(supabase, organizationId, run.id, "info", "Mapeando URL do evento", { eventUrl });
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
    if (isTimeoutExceeded()) {
      await logRunEvent(supabase, organizationId, run.id, "warn", "Tempo limite excedido durante scrape — retornando resultados parciais", { scraped_so_far: scrapedContents.length });
      break;
    }
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

  let totalScrapedChars = scrapedContents.reduce((acc, c) => acc + (c.markdown?.length || 0) + (c.html?.length || 0), 0);

  // Flag global: a URL principal foi detectada como shell vazio de SPA?
  // Usado para evitar caminhos inúteis (paginação brute-force, parser de markdown
  // contra shell genérico) e priorizar render via Firecrawl com proxy stealth.
  let baseIsEmptyShell = false;
  let baseSpaFramework: string = "none";

  if (scrapedContents.length === 0 || totalScrapedChars < 5000) {
    try {
      const directContent = await fetchEventPageDirect(formattedEventUrl);
      const directIsShell = isEmptyShell(directContent.html, directContent.markdown);
      baseSpaFramework = detectSpaFramework(directContent.html);

      const directPage = {
        url: formattedEventUrl,
        markdown: directContent.markdown,
        html: directContent.html,
        page_type: "exhibitors_list",
      };

      const existingIndex = scrapedContents.findIndex((item) => item.url === formattedEventUrl);
      if (existingIndex >= 0) {
        const currentSize = (scrapedContents[existingIndex].markdown?.length || 0) + (scrapedContents[existingIndex].html?.length || 0);
        const directSize = (directPage.markdown?.length || 0) + (directPage.html?.length || 0);
        if (directSize > currentSize) scrapedContents[existingIndex] = directPage;
      } else {
        scrapedContents.push(directPage);
        metrics.list_pages_scraped++;
      }

      if (directIsShell) {
        baseIsEmptyShell = true;
        await logRunEvent(supabase, organizationId, run.id, "warn", `Shell vazio de SPA detectado (${baseSpaFramework}), exigirá render via JavaScript`, {
          framework: baseSpaFramework,
          markdown_chars: directContent.markdown.length,
          html_chars: directContent.html.length,
        });
      }

      totalScrapedChars = scrapedContents.reduce((acc, c) => acc + (c.markdown?.length || 0) + (c.html?.length || 0), 0);
      await logRunEvent(supabase, organizationId, run.id, "info", "Fallback direto do site aplicado com sucesso", {
        fetched_url: formattedEventUrl,
        html_chars: directContent.html.length,
        markdown_chars: directContent.markdown.length,
        az_links_found: extractAzLetterLinks(directContent.html, formattedEventUrl).length,
        is_empty_shell: directIsShell,
        spa_framework: baseSpaFramework,
      });
    } catch (directErr) {
      await logRunEvent(supabase, organizationId, run.id, "warn", "Fallback direto do site falhou", { error: String(directErr) });
    }
  }

  // ── Step 2c (pós-scrape): Paginação a partir do HTML capturado ──
  // Sites de eventos (Bett, etc.) frequentemente listam expositores em ?page=1..N.
  // Quando a URL inicial não tem ?page=, o Step 2b não dispara. Aqui detectamos:
  // (a) links explícitos ?page=N no HTML; (b) brute-force ?page=2..MAX como fallback.
  try {
    const paginationCandidates = new Set<string>();
    let maxDetectedPage = 1;

    for (const scraped of scrapedContents) {
      const html = scraped.html || "";
      if (!html) continue;
      // Detecta links ?page=N (ou &page=N) no HTML
      const pageLinkRegex = /[?&](?:page|pagina|p|pg)=(\d{1,3})/gi;
      let m: RegExpExecArray | null;
      while ((m = pageLinkRegex.exec(html)) !== null) {
        const n = parseInt(m[1], 10);
        if (n > 0 && n <= 100) maxDetectedPage = Math.max(maxDetectedPage, n);
      }
    }

    // Se detectou links de paginação OU a URL parece uma listagem de expositores,
    // gera URLs ?page=2..MAX (mínimo 15 para sites como Bett que têm ~15 páginas).
    // GUARD: se a página-base é shell vazio de SPA, brute-force ?page=N só vai
    // capturar 14× o mesmo shell (visto na run da Feimec). Só paginamos se há
    // evidência REAL de paginação no HTML capturado (maxDetectedPage > 1).
    const baseUrl = formattedEventUrl.split("#")[0].split("?")[0];
    const looksLikeListing = /lista-de-expositores|expositores|exhibitors|exhibitor-list|exposants|aussteller/i.test(formattedEventUrl);
    const shouldPaginate = maxDetectedPage > 1 || (looksLikeListing && scrapedContents.length > 0 && !baseIsEmptyShell);

    if (shouldPaginate) {
      const targetMax = Math.max(maxDetectedPage, 15);
      for (let i = 2; i <= targetMax; i++) {
        const pageUrl = `${baseUrl}?page=${i}`;
        if (!scrapedContents.some(s => s.url === pageUrl)) {
          paginationCandidates.add(pageUrl);
        }
      }
    }

    if (paginationCandidates.size > 0) {
      await logRunEvent(supabase, organizationId, run.id, "info", `Iniciando paginação: ${paginationCandidates.size} páginas adicionais (max detectado: ${maxDetectedPage})`, {
        max_detected_page: maxDetectedPage,
        pages_to_fetch: paginationCandidates.size,
      });

      let paginationSuccess = 0;
      let consecutiveEmpty = 0;
      const sortedPages = Array.from(paginationCandidates).sort((a, b) => {
        const na = parseInt(a.match(/page=(\d+)/)?.[1] || "0");
        const nb = parseInt(b.match(/page=(\d+)/)?.[1] || "0");
        return na - nb;
      });

      for (const pageUrl of sortedPages) {
        if (consecutiveEmpty >= 3) {
          await logRunEvent(supabase, organizationId, run.id, "info", "Paginação interrompida: 3 páginas vazias consecutivas", { last_url: pageUrl });
          break;
        }
        try {
          const direct = await fetchEventPageDirect(pageUrl);
          const sizeOk = (direct.html?.length || 0) > 1000;
          if (!sizeOk) {
            consecutiveEmpty++;
            continue;
          }
          // Valida se a página tem conteúdo real (não só shell HTML)
          const hasContent = /stand|expositor|exhibitor|booth|estande/i.test(direct.html || direct.markdown);
          if (!hasContent) {
            consecutiveEmpty++;
            continue;
          }
          scrapedContents.push({
            url: pageUrl,
            markdown: direct.markdown,
            html: direct.html,
            page_type: "exhibitors_list",
          });
          paginationSuccess++;
          consecutiveEmpty = 0;
        } catch (_e) {
          consecutiveEmpty++;
        }
      }

      totalScrapedChars = scrapedContents.reduce((acc, c) => acc + (c.markdown?.length || 0) + (c.html?.length || 0), 0);
      await logRunEvent(supabase, organizationId, run.id, "info", `Paginação concluída: ${paginationSuccess} páginas extras capturadas`, {
        pages_captured: paginationSuccess,
        total_scraped_chars: totalScrapedChars,
      });
    }
  } catch (pagErr) {
    await logRunEvent(supabase, organizationId, run.id, "warn", "Erro na paginação automática", { error: String(pagErr) });
  }

  // ── Step 3a: SPA strategy (A-Z filter OU Infinite-Scroll Aggressive) ──
  // Detecta SPA quando: poucos URLs no map, poucos chars retornados, OU shell vazio detectado.
  // Cobre Angular/React/Vue (ex: bettshow.com / app.informamarkets.com.br).
  const isSpaLike = baseIsEmptyShell
    || (discoveredUrls.length <= 5)
    || (metrics.list_pages_scraped >= 1 && totalScrapedChars < 2000);

  // ── Step 3a-PRE: Native JSON API Probe ──
  // Muitas SPAs (ex: ABRINT) consomem uma API REST pública que devolve a lista
  // completa de expositores em uma única chamada. Antes de gastar Firecrawl em
  // A-Z ou infinite-scroll, tentamos descobrir e chamar essa API diretamente.
  // Se conseguir, injeta o resultado como markdown sintético em scrapedContents
  // e o pipeline existente (parser → AI → dedup) segue normal.
  // Falha silenciosa: se nada for encontrado, o fluxo A-Z / infinite-scroll roda
  // exatamente como antes (zero regressão para Feimec/Bett/Feicon).
  if (isSpaLike) {
    try {
      const apiResult = await tryNativeApiProbe(formattedEventUrl, supabase, organizationId, run.id);
      if (apiResult && apiResult.exhibitors.length >= 5) {
        scrapedContents.push({
          url: apiResult.endpoint,
          markdown: apiResult.markdown,
          html: "",
          page_type: "exhibitors_list",
        });
        totalScrapedChars += apiResult.markdown.length;
        metrics.list_pages_scraped += 1;
        await logRunEvent(supabase, organizationId, run.id, "info",
          `Native API capturou ${apiResult.exhibitors.length} expositores em 1 chamada — pulando A-Z/scroll`,
          { endpoint: apiResult.endpoint, count: apiResult.exhibitors.length });
        // Marca para pular A-Z e infinite-scroll abaixo (já temos tudo)
        (scrapedContents as any).__nativeApiSucceeded = true;
      }
    } catch (apiErr) {
      await logRunEvent(supabase, organizationId, run.id, "info",
        "Native API probe não encontrou endpoint utilizável, continuando com estratégias padrão",
        { detail: String(apiErr).slice(0, 200) });
    }
  }

  if (isSpaLike && scrapedContents.length > 0 && !(scrapedContents as any).__nativeApiSucceeded) {
    const firstContent = scrapedContents[0];
    const firstHtml = firstContent.html || "";
    const firstMd = firstContent.markdown || "";

    // Heurística A-Z RIGOROSA — exige evidência concreta de seletores reais,
    // não apenas presença de letras isoladas no DOM (causa falsos positivos
    // em qualquer página com menu de navegação ou breadcrumbs).
    const azDataAttrCount = (firstHtml.match(/(?:data-letter|data-filter)="[A-Z]"/gi) || []).length;
    const azClassCount = (firstHtml.match(/class="[^"]*(?:alpha-filter|letter-filter|az-filter|filter-az)[^"]*"/gi) || []).length;
    const hasAlphaFilter = azDataAttrCount >= 5 // pelo menos 5 letras com data-* atributo
      || azClassCount >= 1
      || /(?:filtrar|filter)\s+(?:por letra|by letter|alphabetically|a-z)/i.test(firstHtml);

    // For known SPA event hosts, force the A-Z strategy even without explicit detection
    const eventHost = (() => { try { return new URL(formattedEventUrl).hostname.toLowerCase(); } catch { return ""; } })();
    const knownAzHosts = ["bettshow.com", "brasil.bettshow.com"];
    const forceAlphaStrategy = knownAzHosts.some(h => eventHost.endsWith(h));

    if (hasAlphaFilter || forceAlphaStrategy) {
      await logRunEvent(supabase, organizationId, run.id, "info", "SPA detectada com filtro A-Z, fazendo scrapes por letra (stealth proxy)", {
        az_data_attrs_found: azDataAttrCount,
        az_classes_found: azClassCount,
        forced_by_host: forceAlphaStrategy,
      });

      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
      for (const letter of letters) {
        try {
          const letterActions: any[] = [
            { type: "wait", milliseconds: 2500 },
            { type: "click", selector: `a[data-letter="${letter}"], a[data-filter="${letter}"], a[href*="letter=${letter}"], a[href*="letra=${letter}"], button[data-letter="${letter}"], .alpha-filter a:has-text("${letter}"), .filter-letter:has-text("${letter}"), a.letter-filter[href*="${letter.toLowerCase()}"], li:has-text("${letter}") > a` },
            { type: "wait", milliseconds: 3500 },
          ];
          for (let s = 0; s < 30; s++) {
            letterActions.push({ type: "scroll", direction: "down", amount: 5 });
            letterActions.push({ type: "wait", milliseconds: 800 });
          }

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
      // ── Infinite-Scroll Resiliente (para SPAs com paginação por scroll, ex: Feimec) ──
      // Estratégia: rodadas curtas e CONSTANTES (não cumulativas), para não estourar
      // o orçamento interno do Firecrawl (que retorna payload vazio quando satura).
      // Cada rodada faz ~25 scrolls com amount alto + waits curtos (~20s de ações).
      // Resposta vazia é tratada como FALHA TRANSIENTE (retry), não como "fim do conteúdo".
      // Hard-stop por tempo de parede em 6 min como rede de segurança.
      await logRunEvent(supabase, organizationId, run.id, "info", "SPA com infinite-scroll detectado, iniciando captura resiliente (stealth proxy)", {
        spa_framework: baseSpaFramework,
        base_is_empty_shell: baseIsEmptyShell,
      });

      const isFirecrawlEmpty = (sd: any): boolean => {
        const md = sd?.data?.markdown ?? sd?.markdown ?? "";
        const ht = sd?.data?.html ?? sd?.html ?? "";
        return (md.length === 0) && (ht.length < 1000);
      };

      let bestMarkdown = firstContent.markdown || "";
      let bestHtml = firstContent.html || "";
      let prevSize = bestMarkdown.length;
      const growthPerRound: number[] = [];
      let smallGrowthStreak = 0;
      let emptyStreak = 0;
      const MAX_ROUNDS = 8;
      const SCROLLS_PER_ROUND = 25;
      const PHASE_BUDGET_MS = 6 * 60 * 1000; // 6 min hard-stop
      const phaseStart = Date.now();

      const buildScrollActions = (): any[] => {
        const acts: any[] = [
          { type: "wait", milliseconds: 3000 },
          // Pula direto para o fundo para forçar carregamento incremental antes dos scrolls
          { type: "scroll", direction: "down", amount: 30 },
          { type: "wait", milliseconds: 1500 },
        ];
        for (let s = 0; s < SCROLLS_PER_ROUND; s++) {
          acts.push({ type: "scroll", direction: "down", amount: 10 });
          acts.push({ type: "wait", milliseconds: 600 });
        }
        return acts;
      };

      const callScrape = async (waitFor: number, useStealth: boolean) => {
        const body: any = {
          url: firstContent.url,
          formats: ["markdown", "html"],
          onlyMainContent: false,
          waitFor,
          actions: buildScrollActions(),
          timeout: 110000,
        };
        if (useStealth) body.proxy = "stealth";
        const resp = await fetch("https://api.firecrawl.dev/v2/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return await resp.json();
      };

      for (let round = 1; round <= MAX_ROUNDS; round++) {
        const elapsed = Date.now() - phaseStart;
        if (elapsed >= PHASE_BUDGET_MS) {
          await logRunEvent(supabase, organizationId, run.id, "info", `Infinite-scroll hard-stop por tempo (${Math.round(elapsed/1000)}s)`, {
            rounds_executed: round - 1,
          });
          break;
        }

        let attempt = 0;
        let scrapeData: any = null;
        let usedFallback = false;
        // Retry interno: 1ª tentativa stealth+5s; se vier vazio, tenta sem stealth+8s
        for (attempt = 1; attempt <= 2; attempt++) {
          try {
            const useStealth = attempt === 1;
            const waitFor = attempt === 1 ? 5000 : 8000;
            scrapeData = await callScrape(waitFor, useStealth);
            if (!isFirecrawlEmpty(scrapeData)) {
              if (attempt === 2) usedFallback = true;
              break;
            }
            await logRunEvent(supabase, organizationId, run.id, "warn", `Rodada ${round}: resposta vazia do Firecrawl (tentativa ${attempt}/2, stealth=${useStealth})`, {
              round,
              attempt,
              proxy_mode: useStealth ? "stealth" : "default",
            });
          } catch (callErr) {
            await logRunEvent(supabase, organizationId, run.id, "warn", `Rodada ${round} tentativa ${attempt} falhou`, { error: String(callErr) });
            scrapeData = null;
          }
        }

        if (!scrapeData || isFirecrawlEmpty(scrapeData)) {
          emptyStreak++;
          await logRunEvent(supabase, organizationId, run.id, "warn", `Rodada ${round}/${MAX_ROUNDS}: Firecrawl entregou vazio mesmo com fallback (empty_streak=${emptyStreak})`);
          // 3 vazias seguidas = desiste (provavelmente bloqueio persistente)
          if (emptyStreak >= 3) {
            await logRunEvent(supabase, organizationId, run.id, "warn", "Infinite-scroll abortado: 3 respostas vazias seguidas");
            break;
          }
          continue;
        }
        emptyStreak = 0;

        const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
        const html = scrapeData.data?.html || scrapeData.html || "";
        const newSize = markdown.length;

        // Persistência incremental — sempre que melhorar, salva no scrapedContents[0]
        if (newSize > bestMarkdown.length) {
          bestMarkdown = markdown;
          bestHtml = html || bestHtml;
          scrapedContents[0] = { ...firstContent, markdown: bestMarkdown, html: bestHtml };
        }

        const growth = prevSize === 0 ? 1 : (newSize - prevSize) / Math.max(prevSize, 1);
        growthPerRound.push(Math.round(growth * 1000) / 10);
        await logRunEvent(supabase, organizationId, run.id, "info", `Infinite-scroll rodada ${round}/${MAX_ROUNDS}: ${newSize} chars (crescimento ${(growth * 100).toFixed(1)}%)`, {
          round,
          chars: newSize,
          growth_pct: Math.round(growth * 1000) / 10,
          scrolls: SCROLLS_PER_ROUND,
          used_fallback: usedFallback,
          accumulated_phase_ms: Date.now() - phaseStart,
        });

        // Early-stop SÓ quando há resposta válida (>1000 chars) e crescimento <5% duas vezes seguidas
        if (newSize > 1000 && growth < 0.05) {
          smallGrowthStreak++;
          if (smallGrowthStreak >= 2) {
            await logRunEvent(supabase, organizationId, run.id, "info", `Infinite-scroll early-stop: 2 rodadas consecutivas com crescimento <5%`, {
              final_chars: newSize,
              rounds_executed: round,
            });
            break;
          }
        } else {
          smallGrowthStreak = 0;
        }
        prevSize = newSize;
      }

      // Fallback de último recurso: se ainda estamos com payload pequeno, tenta via /crawl
      if (bestMarkdown.length < 5000) {
        try {
          await logRunEvent(supabase, organizationId, run.id, "info", "Scroll progressivo não progrediu, tentando fallback via /crawl");
          const crawlResp = await fetch("https://api.firecrawl.dev/v2/crawl", {
            method: "POST",
            headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              url: firstContent.url,
              limit: 5,
              maxDepth: 0,
              scrapeOptions: {
                formats: ["markdown", "html"],
                onlyMainContent: false,
                waitFor: 6000,
                actions: buildScrollActions(),
              },
            }),
          });
          const crawlInit = await crawlResp.json();
          const crawlId = crawlInit?.id || crawlInit?.data?.id;
          if (crawlId) {
            // Polling curto: até 90s
            const pollStart = Date.now();
            let crawlDone = false;
            while (Date.now() - pollStart < 90000 && !crawlDone) {
              await new Promise(r => setTimeout(r, 5000));
              const statusResp = await fetch(`https://api.firecrawl.dev/v2/crawl/${crawlId}`, {
                headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}` },
              });
              const statusData = await statusResp.json();
              if (statusData?.status === "completed" || statusData?.status === "failed") {
                crawlDone = true;
                const docs = statusData?.data || [];
                for (const doc of docs) {
                  const md = doc?.markdown || "";
                  if (md.length > bestMarkdown.length) {
                    bestMarkdown = md;
                    bestHtml = doc?.html || bestHtml;
                  }
                }
                await logRunEvent(supabase, organizationId, run.id, "info", `Fallback /crawl finalizado: ${docs.length} docs, melhor markdown ${bestMarkdown.length} chars`, {
                  status: statusData?.status,
                });
              }
            }
          }
        } catch (crawlErr) {
          await logRunEvent(supabase, organizationId, run.id, "warn", "Fallback /crawl falhou", { error: String(crawlErr) });
        }
      }

      // Persiste resultado final e re-avalia shell
      if (bestMarkdown.length > (firstContent.markdown || "").length * 1.1) {
        scrapedContents[0] = { ...firstContent, markdown: bestMarkdown, html: bestHtml };
        totalScrapedChars = scrapedContents.reduce((acc, c) => acc + (c.markdown?.length || 0) + (c.html?.length || 0), 0);
        if (baseIsEmptyShell && bestMarkdown.length >= 5000) {
          baseIsEmptyShell = false;
          await logRunEvent(supabase, organizationId, run.id, "info", "Shell preenchido com sucesso via infinite-scroll resiliente", {
            final_markdown_chars: bestMarkdown.length,
            growth_per_round: growthPerRound,
          });
        }
      } else {
        await logRunEvent(supabase, organizationId, run.id, "warn", "Infinite-scroll resiliente não trouxe conteúdo novo significativo", {
          original_chars: (firstContent.markdown || "").length,
          best_chars: bestMarkdown.length,
          growth_per_round: growthPerRound,
        });
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

  // ── Step 3c: Deterministic Markdown Pattern Parser ──
  // Captura padrões muito comuns em sites de evento já no markdown,
  // sem depender da AI. Padrões cobertos:
  //   "## NOME DA EMPRESA\n...\nStand: XYZ"   (Bett, ASP Events e similares)
  //   "### NOME DA EMPRESA\n...Stand: XYZ"
  //   "## NOME DA EMPRESA\n...Booth: XYZ"
  //   "- **NOME DA EMPRESA**" em listas com logos antes
  // Roda ANTES da AI. Se já trouxer muitos resultados, a AI ainda roda
  // e os duplicados são removidos pelo dedupe intra-run mais adiante.
  // allExhibitors already declared at Step 0 (provider detection)

  const swapcardHtml = scrapedContents.find((item) => /swapcard|__NEXT_DATA__|Core_EventExhibitorListView/i.test(item.html || ""))?.html || scrapedContents[0]?.html || "";
  let swapcardCompleted = false;
  if (swapcardHtml) {
    try {
      const swapcardExhibitors = await fetchSwapcardExhibitors(formattedEventUrl, swapcardHtml);
      if (swapcardExhibitors.length > 0) {
        const diagnostics = (swapcardExhibitors[0] as any).__swapcard_diagnostics;
        if (diagnostics) delete (swapcardExhibitors[0] as any).__swapcard_diagnostics;
        allExhibitors.push(...swapcardExhibitors);
        metrics.html_hybrid_extracted += swapcardExhibitors.length;
        metrics.exhibitors_extracted_raw = allExhibitors.length;
        await logRunEvent(supabase, organizationId, run.id, "info", `Swapcard GraphQL extraiu ${swapcardExhibitors.length} expositores via cursor`, {
          count: swapcardExhibitors.length,
          extraction_method: "swapcard_graphql_cursor",
          views_diagnostics: diagnostics,
        });
        // Provider determinístico entregou lista completa — pular AI loop e
        // fallback HTML híbrido. Persistência avança imediatamente.
        if (swapcardExhibitors.length >= 20) {
          swapcardCompleted = true;
          (metrics as any).provider = "swapcard_late";
          (metrics as any).deterministic_skip_ai = true;
          // Heartbeat: garante que o watchdog não mate o run nem fique zumbi.
          await supabase.from("playbook_runs").update({
            stats: { ...metrics },
            last_heartbeat_at: new Date().toISOString(),
          }).eq("id", run.id);
          await logRunEvent(supabase, organizationId, run.id, "info",
            "Provider determinístico (Swapcard) completo, pulando loop de IA e fallback HTML",
            { count: swapcardExhibitors.length });
        }
      }
    } catch (swapcardErr) {
      await logRunEvent(supabase, organizationId, run.id, "warn", "Extração Swapcard GraphQL falhou; mantendo fallback por scroll/AI", { error: String(swapcardErr) });
    }
  }

  for (const scraped of scrapedContents) {
    // GUARD: pular shells vazios — H2/H3 do menu/UI viram falsos positivos
    // (ex: 32 "expositores" extraídos do shell Angular da Feimec).
    if (isEmptyShell(scraped.html || "", scraped.markdown || "")) continue;

    const htmlExhibitors = extractAspEventsExhibitorsFromHtml(scraped.html || "", scraped.url);
    if (htmlExhibitors.length > 0) {
      allExhibitors.push(...htmlExhibitors);
      metrics.html_hybrid_extracted += htmlExhibitors.length;
    }

    const md = scraped.markdown || "";
    if (!md || md.length < 30) continue;

    // Padrão 1: cabeçalhos H2/H3 de empresa seguidos opcionalmente por "Stand:" ou "Booth:"
    // Ex.: "## 3B SCIENTIFIC\n\nStand: P160"
    const headingPattern = /^(?:#{2,4})\s+([^\n#][^\n]{1,120})\s*$([\s\S]{0,400}?)(?=^(?:#{1,6})\s|\n\n-\s|$)/gm;
    const matches = md.matchAll(headingPattern);
    for (const m of matches) {
      const rawName = (m[1] || "").trim()
        .replace(/^\*+|\*+$/g, "")
        .replace(/\s+/g, " ");
      const block = m[2] || "";

      // Filtros mínimos para não capturar cabeçalhos genéricos
      if (rawName.length < 2 || rawName.length > 120) continue;
      if (/^(lista|menu|home|filtros|pesquisar|sobre|contato|setores|segmento|patrocinador|patrocinadores|expositores|exhibitors|loading|todos)$/i.test(rawName)) continue;
      if (/^[\d\W]+$/.test(rawName)) continue;

      const standMatch = block.match(/(?:Stand|Booth|Estande)\s*[:#]?\s*([A-Z0-9-]{1,12})/i);
      const booth = standMatch ? standMatch[1].toUpperCase() : null;

      allExhibitors.push({
        company_name: rawName,
        website: null,
        category: null,
        description: null,
        booth,
        country: null,
        city: null,
        exhibitor_profile_url: null,
        signals: booth ? ["markdown_pattern", "has_booth"] : ["markdown_pattern"],
        confidence: booth ? 75 : 60,
        _source_url: scraped.url,
        _page_type: scraped.page_type,
        _extraction_method: "markdown_pattern",
      });
    }
  }

  metrics.markdown_pattern_extracted = allExhibitors.length;
  if (allExhibitors.length > 0) {
    await logRunEvent(supabase, organizationId, run.id, "info", `Parser de markdown extraiu ${allExhibitors.length} expositores antes da AI`, { count: allExhibitors.length });
  }

  // ── Step 4: AI extraction with CHUNKING ──
  // (allExhibitors já pode conter resultados do parser de markdown — AI só complementa)
  // WATCHDOG: timeout global de 6min no loop completo de IA. Se estourar,
  // continua com o que já foi extraído (parser markdown + html híbrido + fallback Step 4b).
  // Evita travas como a da Feimec (13min sem resposta exigindo Force Complete).
  // SKIP: se o provider determinístico (Swapcard) entregou >= 20 expositores,
  // o loop de IA é redundante e responsável por timeouts silenciosos (FISPAL).
  const CHUNK_SIZE = 40000;
  const AI_PHASE_TIMEOUT_MS = 6 * 60 * 1000;
  let aiPhaseTimedOut = false;
  const aiPhaseStart = Date.now();

  if (swapcardCompleted) {
    await logRunEvent(supabase, organizationId, run.id, "info",
      `AI loop pulado: provider determinístico já entregou ${allExhibitors.length} expositores`);
  } else {

  const aiLoop = (async () => {
  for (const scraped of scrapedContents) {
    if (Date.now() - aiPhaseStart > AI_PHASE_TIMEOUT_MS) { aiPhaseTimedOut = true; break; }
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
      if (isTimeoutExceeded()) {
        await logRunEvent(supabase, organizationId, run.id, "warn", "Tempo limite excedido durante extração IA — retornando resultados parciais", { chunks_done: ci, chunks_total: chunks.length });
        break;
      }
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
  })();

  const aiTimeout = new Promise<void>((resolve) => setTimeout(() => { aiPhaseTimedOut = true; resolve(); }, AI_PHASE_TIMEOUT_MS + 5000));
  await Promise.race([aiLoop, aiTimeout]);

  if (aiPhaseTimedOut) {
    await logRunEvent(supabase, organizationId, run.id, "warn", "Watchdog: extração IA excedeu 6min, prosseguindo com resultados parciais", {
      exhibitors_so_far: allExhibitors.length,
      chunks_processed: metrics.ai_chunks_processed,
    });
  }

  metrics.exhibitors_extracted_raw = allExhibitors.length;
  executionLog.push({ step: "ai_extraction", chunks_processed: metrics.ai_chunks_processed, exhibitors_extracted: allExhibitors.length, at: new Date().toISOString() });
  await logRunEvent(supabase, organizationId, run.id, "info", `${allExhibitors.length} expositores extraídos de ${metrics.ai_chunks_processed} chunks`);
  } // end if (!swapcardCompleted) — closes Step 4 wrapper

  // ── Step 4b: Hybrid HTML extraction fallback ──
  // If AI extracted few results but HTML has many repeated patterns, extract deterministically
  if (!swapcardCompleted && allExhibitors.length < 50 && scrapedContents.length > 0) {
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
  } // end if (!expofpHandled) — closes the Firecrawl block opened in Step 1

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
    const stableProviderId = ex._informa_connect_external_id ? `informa-connect:${ex._informa_connect_external_id}` : null;

    // Intra-run dedupe by name + domain + profile URL
    const nameDedupeKey = stableProviderId ? `${normalizedName}::${stableProviderId}` : normalizedName;
    if (seenNames.has(nameDedupeKey)) { metrics.deduped_in_run++; continue; }

    const domain = extractDomain(ex.website || "");
    if (!stableProviderId && domain && seenDomains.has(domain)) { metrics.deduped_in_run++; continue; }

    const profileUrl = ex.exhibitor_profile_url || null;
    if (profileUrl && seenProfileUrls.has(profileUrl)) { metrics.deduped_in_run++; continue; }

    seenNames.add(nameDedupeKey);
    if (!stableProviderId && domain) seenDomains.add(domain);
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

  // Persist a single batch (used for parallel execution)
  const persistBatch = async (batch: typeof candidates, batchIndex: number) => {
    const prospectRows = batch.map((candidate) => ({
      organization_id: organizationId,
      playbook_run_id: run.id,
      icp_profile_id: icpId,
      source_id: source?.id || null,
      company_name: candidate.companyName,
      normalized_company_name: candidate.normalizedName,
      website: sanitizeProspectDomain(candidate.domain) ? candidate.website : null,
      normalized_domain: sanitizeProspectDomain(candidate.domain),
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
      console.error(`[batch ${batchIndex}] Bulk prospect insert error:`, bulkInsertError);
      // Fall back to individual inserts to recover from partial failures
      for (const row of prospectRows) {
        const { data: singleInserted, error: singleInsertError } = await supabase
          .from("prospects")
          .insert(row)
          .select("id, raw_data")
          .single();
        if (singleInsertError) {
          console.error(`[batch ${batchIndex}] Single prospect insert error:`, singleInsertError);
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
        console.error(`[batch ${batchIndex}] Bulk score insert error:`, scoreInsertError);
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
        console.error(`[batch ${batchIndex}] Bulk signal insert error:`, signalInsertError);
        for (const signalRow of signalChunk) {
          await supabase.from("prospect_signals").insert(signalRow);
        }
      }
    }

    return insertedProspects.length;
  };

  // Process batches in parallel groups (4 at a time) with live heartbeat
  const PARALLEL_CONCURRENCY = 4;
  for (let i = 0; i < candidateBatches.length; i += PARALLEL_CONCURRENCY) {
    const slice = candidateBatches.slice(i, i + PARALLEL_CONCURRENCY);
    const results = await Promise.allSettled(
      slice.map((batch, idx) => persistBatch(batch, i + idx))
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        prospectsCreated += result.value;
      } else {
        console.error("Batch persistence failed:", result.reason);
      }
    }

    metrics.persisted_prospects = prospectsCreated;
    metrics.prospects_created = prospectsCreated;
    metrics.prospects_count = prospectsCreated;

    // Live heartbeat: update stats AND last_heartbeat_at so the watchdog won't kill us
    await supabase.from("playbook_runs").update({
      stats: { ...metrics },
      execution_time_ms: Date.now() - startTime,
      last_heartbeat_at: new Date().toISOString(),
    }).eq("id", run.id);

    const completedBatches = Math.min(i + PARALLEL_CONCURRENCY, candidateBatches.length);
    await logRunEvent(
      supabase,
      organizationId,
      run.id,
      "info",
      `Persistidos ${prospectsCreated}/${candidates.length} (lotes ${completedBatches}/${candidateBatches.length})`,
      {
        persisted_prospects: prospectsCreated,
        candidate_count: candidates.length,
        batches_done: completedBatches,
        batches_total: candidateBatches.length,
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
      website: sanitizeProspectDomain(domain) ? website : null,
      normalized_domain: sanitizeProspectDomain(domain),
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
      review_needed: !sanitizeProspectDomain(domain) || dedupe.review_needed,
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

// ─────────────────────────────────────────────────────────────────────────────
// Native API Probe — descobre endpoints REST públicos em SPAs (ABRINT-like)
// ─────────────────────────────────────────────────────────────────────────────
// Estratégia ADITIVA: roda apenas quando isSpaLike=true, nunca substitui as
// estratégias A-Z (Bett) ou infinite-scroll (Feimec). Se falhar, o pipeline
// segue para o fluxo padrão sem regressão.
//
// 1. Baixa o HTML da landing page → extrai os bundles JS (<script src>)
// 2. Procura por endpoints com palavras-chave (expositores/exhibitors/exhibitors-list)
//    e hosts API candidatos (api.<domain>, mesmo host /api/...)
// 3. Tenta cada combinação, valida payload JSON com >=5 itens contendo "name"
// 4. Retorna lista normalizada como markdown sintético compatível com o parser
async function tryNativeApiProbe(
  eventUrl: string,
  supabase: any,
  organizationId: string,
  runId: string,
): Promise<{ endpoint: string; markdown: string; exhibitors: any[] } | null> {
  const u = new URL(eventUrl);
  const baseHost = u.origin;
  const apiHostGuesses = new Set<string>([
    `https://api.${u.hostname.replace(/^www\./, "")}`,
    baseHost,
  ]);

  // 1. Baixa landing page
  const landingResp = await fetch(eventUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!landingResp.ok) return null;
  const landingHtml = await landingResp.text();

  // 2. Extrai URLs dos bundles JS
  const scriptSrcs = Array.from(landingHtml.matchAll(/<script[^>]+src=["']([^"']+\.js)["']/g))
    .map((m) => m[1])
    .map((src) => src.startsWith("http") ? src : new URL(src, baseHost).toString())
    .slice(0, 5); // limite de bundles

  // 3. Concatena conteúdo dos bundles e procura por endpoints/hosts
  let bundlesContent = "";
  for (const src of scriptSrcs) {
    try {
      const r = await fetch(src, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (r.ok) bundlesContent += "\n" + (await r.text());
    } catch { /* ignora bundle individual */ }
  }

  // Hosts adicionais descobertos no JS (ex: api.abrint.com.br)
  const hostMatches = bundlesContent.matchAll(/https:\/\/api\.[a-z0-9.-]+\.[a-z]{2,}/gi);
  for (const hm of hostMatches) apiHostGuesses.add(hm[0]);

  // Caminhos prováveis para listagem de expositores
  const pathGuesses = [
    "/api/expositores",
    "/api/exhibitors",
    "/api/v1/expositores",
    "/api/v1/exhibitors",
    "/api/v1.0/expositores",
    "/api/v1.0/exhibitors",
    "/api/exhibitors-list",
    "/api/expositores-lista",
  ];

  // Detecta paths reais nos bundles também (ex: `/api/foo/bar`)
  const pathMatches = bundlesContent.matchAll(/["'`](\/api\/[a-z0-9_/.-]*(?:expositor|exhibitor)[a-z0-9_/-]*)["'`]/gi);
  for (const pm of pathMatches) {
    const p = pm[1].split("$")[0].replace(/\/$/, ""); // remove template literals
    if (p && !pathGuesses.includes(p)) pathGuesses.push(p);
  }

  await logRunEvent(supabase, organizationId, runId, "info", "Native API probe iniciado", {
    api_hosts: Array.from(apiHostGuesses),
    paths_to_try: pathGuesses.length,
  });

  // 4. Testa combinações host × path
  for (const host of apiHostGuesses) {
    for (const path of pathGuesses) {
      const endpoint = `${host}${path}`;
      try {
        const resp = await fetch(endpoint, {
          headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
        });
        if (!resp.ok) continue;
        const ct = resp.headers.get("content-type") || "";
        if (!ct.includes("json")) continue;

        const json = await resp.json();
        // Aceita {data: [...]}, {items: [...]}, [...], {success, data: [...]}
        let list: any[] = [];
        if (Array.isArray(json)) list = json;
        else if (Array.isArray(json?.data)) list = json.data;
        else if (Array.isArray(json?.items)) list = json.items;
        else if (Array.isArray(json?.exhibitors)) list = json.exhibitors;
        else if (Array.isArray(json?.expositores)) list = json.expositores;

        // Valida: precisa ter >=5 itens com algo que pareça nome de empresa
        if (list.length < 5) continue;
        const nameKeys = ["name", "nome", "company", "empresa", "razao_social", "title"];
        const validItems = list.filter((it) =>
          it && typeof it === "object" && nameKeys.some((k) => typeof it[k] === "string" && it[k].length > 1)
        );
        if (validItems.length < 5) continue;

        // 5. Converte para markdown sintético compatível com o parser existente
        const lines: string[] = [`# Expositores (extraídos via API ${endpoint})`, ""];
        for (const it of validItems) {
          const name = nameKeys.map((k) => it[k]).find((v) => typeof v === "string" && v.trim().length > 1);
          if (!name) continue;
          const website = it.website || it.url || it.site || "";
          const description = it.description || it.descricao || it.descriptionPortuguese || it.about || "";
          const segment = it.segment || it.segmento || it.category || it.categoria || "";
          const location = it.location || it.localizacao || it.booth || it.stand || it.estande || "";

          lines.push(`## ${String(name).trim()}`);
          if (website) lines.push(`Website: ${website}`);
          if (segment) lines.push(`Segmento: ${segment}`);
          if (location) lines.push(`Estande: ${location}`);
          if (description) lines.push(String(description).substring(0, 500));
          lines.push("");
        }

        return {
          endpoint,
          markdown: lines.join("\n"),
          exhibitors: validItems,
        };
      } catch { /* tenta próximo */ }
    }
  }

  return null;
}
